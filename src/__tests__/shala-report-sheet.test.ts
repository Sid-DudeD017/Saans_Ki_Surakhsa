import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  submitComplaint,
  getComplaintStatus,
  uploadEvidencePhoto,
  generateIdempotencyKey,
  type ComplaintPayload,
} from '../lib/api';
import { parseComplaint } from '../../services/command-api/inputs';
import { routeFor } from '../../services/command-api/config';
import { getComplaintStatus as backendGetComplaintStatus } from '../../services/command-api/complaints';
import type { IntakeDeps } from '../../services/command-api/deps';
import { REPORT_I18N, shortenId } from '../app/shala/ReportSheet';

describe('Procedure 8: Build the report sheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: Tiles and Server Routing', () => {
    it('maps all 6 report types to authorized server routes and statutory deadlines', () => {
      // 1. Crop or field fire -> farm_fire -> SDM, District Agriculture Officer · 4 h
      const farmFireRoute = routeFor('farm_fire');
      expect(farmFireRoute.deadlineHours).toBe(4);
      expect(farmFireRoute.penalty).toBe(true);

      // 2. Rubbish burning -> garbage -> Municipal SWM · 12 h
      const garbageRoute = routeFor('garbage');
      expect(garbageRoute.deadlineHours).toBe(12);
      expect(garbageRoute.penalty).toBe(true);

      // 3. Smoky vehicle -> vehicle -> Traffic police · 24 h
      const vehicleRoute = routeFor('vehicle');
      expect(vehicleRoute.deadlineHours).toBe(24);
      expect(vehicleRoute.penalty).toBe(true);

      // 4. Firecrackers -> firecrackers -> Local police · 2 h
      const firecrackersRoute = routeFor('firecrackers');
      expect(firecrackersRoute.deadlineHours).toBe(2);
      expect(firecrackersRoute.penalty).toBe(true);

      // 5. Construction or road dust -> dust -> Municipal body · 24 h
      const dustRoute = routeFor('dust');
      expect(dustRoute.deadlineHours).toBe(24);
      expect(dustRoute.penalty).toBe(true);

      // 6. Factory or kiln smoke -> industrial -> Pollution Control Board · 24 h
      const industrialRoute = routeFor('industrial');
      expect(industrialRoute.deadlineHours).toBe(24);
      expect(industrialRoute.penalty).toBe(true);
    });

    it('backend parseComplaint accepts all 6 citizen types', () => {
      const types = ['farm_fire', 'garbage', 'vehicle', 'firecrackers', 'dust', 'industrial'] as const;
      for (const t of types) {
        const parsed = parseComplaint({
          type: t,
          location: { lat: 30.245, lon: 75.842 },
          description: `Test report for ${t}`,
          evidence: [],
        });
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('Step 2 & 3: Pin Location and Details', () => {
    it('ensures pin coordinates are used in complaint payload rather than school coordinates', async () => {
      const schoolCoords = { lat: 30.245, lon: 75.842 };
      const movedPinCoords = { lat: 30.278, lon: 75.891 }; // Dragged to where smoke actually is

      const payload: ComplaintPayload = {
        category: 'farm_fire',
        description: 'Smoke plume rising behind fields',
        lat: movedPinCoords.lat,
        lon: movedPinCoords.lon,
        school_id: 'school_demo_001',
      };

      const res = await submitComplaint(payload);
      expect(res.status).toBe('received');
      expect(res.ticket_id).toBeDefined();

      const parsed = parseComplaint({
        type: 'farm_fire',
        location: { lat: payload.lat!, lon: payload.lon! },
        description: payload.description,
        evidence: [],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.location.lat).toBe(movedPinCoords.lat);
        expect(parsed.data.location.lon).toBe(movedPinCoords.lon);
        expect(parsed.data.location.lat).not.toBe(schoolCoords.lat);
      }
    });

    it('supports evidence photo metadata with sha256 hash and upload key', async () => {
      const dummyBlob = new Blob(['fake image binary'], { type: 'image/jpeg' });
      const fakeSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const uploadResult = await uploadEvidencePhoto(dummyBlob, fakeSha);
      expect(uploadResult.object_key).toBeDefined();
      expect(uploadResult.media_type).toBe('image/jpeg');
      expect(uploadResult.hash).toBe(fakeSha);

      const complaintBody = {
        type: 'farm_fire',
        location: { lat: 30.266, lon: 76.04 },
        description: 'Thick smoke near canal',
        evidence: [
          {
            object_key: uploadResult.object_key,
            media_type: uploadResult.media_type,
            hash: uploadResult.hash,
            captured_timestamp: new Date().toISOString(),
            location: { lat: 30.266, lon: 76.04 },
          },
        ],
      };

      const parsed = parseComplaint(complaintBody);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.evidence).toHaveLength(1);
        expect(parsed.data.evidence[0].object_key).toBe(uploadResult.object_key);
        expect(parsed.data.evidence[0].hash).toBe(fakeSha);
      }
    });
  });

  describe('Step 4: Status Tracking (P4 read-only GET /v1/complaints/{id})', () => {
    it('returns progression without officer names or other reporters details', async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM complaints')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'c_test_001',
                  type: 'farm_fire',
                  body: { description: 'Smoke seen in north quadrant', evidence: [] },
                  status: 'validated',
                  received_at: new Date('2026-10-09T10:00:00Z'),
                  updated_at: new Date('2026-10-09T10:15:00Z'),
                },
              ],
            });
          }
          if (sql.includes('FROM cases')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const deps: IntakeDeps = {
        db: mockDb as any,
        s3: {} as any,
        config: {} as any,
        now: () => new Date(),
        newId: () => 'id',
        startWorkflow: vi.fn(),
      };

      const res = await backendGetComplaintStatus(deps, 'c_test_001');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBe('c_test_001');
      expect(json.status).toBe('sent_to_officer');
      expect(json.stage_label).toBe('Sent to officer');
      expect(json.explanation).toBeDefined();

      // STRICT PRIVACY: no officer names or personal identities
      expect(json.officer).toBeUndefined();
      expect(json.officer_name).toBeUndefined();
      expect(json.reporter).toBeUndefined();
      expect(json.reporter_name).toBeUndefined();
    });

    it('displays merged notice when report is merged into an existing area fire case', async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM complaints')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'c_merged_002',
                  type: 'farm_fire',
                  body: { description: 'Flames near village edge', evidence: [] },
                  status: 'assigned',
                  received_at: new Date('2026-10-09T10:00:00Z'),
                  updated_at: new Date('2026-10-09T10:30:00Z'),
                },
              ],
            });
          }
          if (sql.includes('FROM cases')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'case_parent_999',
                  status: 'MERGED',
                  updated_at: new Date('2026-10-09T10:30:00Z'),
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const deps: IntakeDeps = {
        db: mockDb as any,
        s3: {} as any,
        config: {} as any,
        now: () => new Date(),
        newId: () => 'id',
        startWorkflow: vi.fn(),
      };

      const res = await backendGetComplaintStatus(deps, 'c_merged_002');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('merged');
      expect(json.explanation).toBe(
        'Someone already reported this fire. Your report was added to it, which helps it get attention.'
      );
    });

    it('answers 404 not_found for non-existent complaint id', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      const deps: IntakeDeps = {
        db: mockDb as any,
        s3: {} as any,
        config: {} as any,
        now: () => new Date(),
        newId: () => 'id',
        startWorkflow: vi.fn(),
      };

      const res = await backendGetComplaintStatus(deps, 'nonexistent_id');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('not_found');
    });

    it('client getComplaintStatus fetches mock status in mock mode', async () => {
      const status = await getComplaintStatus('c_mock_test');
      expect(status.id).toBe('c_mock_test');
      expect(status.status).toBe('received');
      expect(status.stage_label).toBe('Report received');
      expect(status.explanation).toContain('received');
    });
  });
});

describe('Procedure 9: Apply copy and accessibility rules', () => {
  describe('Developer Wording Replacements', () => {
    it('uses "Send report" instead of "Submit Incident (POST /v1/complaints)"', () => {
      expect(REPORT_I18N.sendReportBtn.en).toBe('Send report');
      expect(REPORT_I18N.sendReportBtn.pa).toBe('ਰਿਪੋਰਟ ਭੇਜੋ');
      expect(REPORT_I18N.sendReportBtn.hi).toBe('रिपोर्ट भेजें');
      expect(REPORT_I18N.sendReportBtn.en).not.toContain('POST /v1');
    });

    it('uses "What is it?" instead of "Pollution Source Category"', () => {
      expect(REPORT_I18N.step1Title.en).toBe('What is it?');
      expect(REPORT_I18N.step1Title.pa).toBe('ਕੀ ਹੈ?');
      expect(REPORT_I18N.step1Title.hi).toBe('क्या है?');
    });

    it('replaces school response desk with officer responsibility and My reports notice', () => {
      expect(REPORT_I18N.step1Subtitle.en).toBe(
        'Your report goes to the officer responsible for this area. You can follow it under My reports.'
      );
      expect(REPORT_I18N.step1Subtitle.pa).toBe(
        'ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਇਸ ਖੇਤਰ ਦੇ ਜ਼ਿੰਮੇਵਾਰ ਅਧਿਕਾਰੀ ਕੋਲ ਜਾਂਦੀ ਹੈ। ਤੁਸੀਂ ਇਸਨੂੰ ਮੇਰੀਆਂ ਰਿਪੋਰਟਾਂ ਵਿੱਚ ਦੇਖ ਸਕਦੇ ਹੋ।'
      );
      expect(REPORT_I18N.step1Subtitle.hi).toBe(
        'आपकी रिपोर्ट इस क्षेत्र के ज़िम्मेदार अधिकारी के पास जाती है। आप इसे मेरी रिपोर्टें में देख सकते हैं।'
      );
      expect(REPORT_I18N.step1Subtitle.en).not.toContain('response desk');
    });

    it('replaces Ticket ID format with shortened reference …d72a format in confirmation', () => {
      expect(shortenId('c_mock_abcdef1234d72a')).toBe('…34d72a');
      expect(shortenId('d72a')).toBe('d72a');

      const formattedEn = REPORT_I18N.reportSentUpdates.en.replace('{ref}', '…d72a');
      expect(formattedEn).toBe("We'll show updates here. Reference …d72a");

      const formattedPa = REPORT_I18N.reportSentUpdates.pa.replace('{ref}', '…d72a');
      expect(formattedPa).toBe('ਅਸੀਂ ਇੱਥੇ ਅੱਪਡੇਟ ਦਿਖਾਵਾਂਗੇ। ਹਵਾਲਾ …d72a');

      const formattedHi = REPORT_I18N.reportSentUpdates.hi.replace('{ref}', '…d72a');
      expect(formattedHi).toBe('हम यहाँ अपडेट दिखाएंगे। संदर्भ …d72a');
    });

    it('uses "Near you" format for location heading', () => {
      expect(REPORT_I18N.nearYou.en).toBe('Near you');
      expect(REPORT_I18N.nearYou.pa).toBe('ਤੁਹਾਡੇ ਨੇੜੇ');
      expect(REPORT_I18N.nearYou.hi).toBe('आपके पास');
    });
  });

  describe('Accessibility & Screen Reader Announcements', () => {
    it('announces all four wizard steps politely to assistive technologies in all 3 languages', () => {
      // Step 1
      expect(REPORT_I18N.stepAnnouncements[1].en).toBe('Step 1 of 4: What is it?');
      expect(REPORT_I18N.stepAnnouncements[1].pa).toBe('ਕਦਮ 1/4: ਕੀ ਹੈ?');
      expect(REPORT_I18N.stepAnnouncements[1].hi).toBe('चरण 1/4: क्या है?');

      // Step 2
      expect(REPORT_I18N.stepAnnouncements[2].en).toBe('Step 2 of 4: Where is the smoke?');
      expect(REPORT_I18N.stepAnnouncements[2].pa).toBe('ਕਦਮ 2/4: ਧੂੰਆਂ ਕਿੱਥੇ ਹੈ?');
      expect(REPORT_I18N.stepAnnouncements[2].hi).toBe('चरण 2/4: धुआँ कहाँ है?');

      // Step 3
      expect(REPORT_I18N.stepAnnouncements[3].en).toBe('Step 3 of 4: Add details and optional photo');
      expect(REPORT_I18N.stepAnnouncements[3].pa).toBe('ਕਦਮ 3/4: ਵੇਰਵੇ ਅਤੇ ਫੋਟੋ');
      expect(REPORT_I18N.stepAnnouncements[3].hi).toBe('चरण 3/4: विवरण और फ़ोटो');

      // Step 4
      expect(REPORT_I18N.stepAnnouncements[4].en).toBe('Step 4 of 4: Check and send your report');
      expect(REPORT_I18N.stepAnnouncements[4].pa).toBe('ਕਦਮ 4/4: ਜਾਂਚੋ ਅਤੇ ਭੇਜੋ');
      expect(REPORT_I18N.stepAnnouncements[4].hi).toBe('चरण 4/4: जाँचें और भेजें');
    });

    it('photo metadata privacy reassures user that location is removed before upload', () => {
      expect(REPORT_I18N.photoExifPrivacy.en).toBe("Your photo's location is removed before upload.");
      expect(REPORT_I18N.photoExifPrivacy.pa).toBe('ਤੁਹਾਡੀ ਫੋਟੋ ਦੀ ਸਥਿਤੀ ਅਪਲੋਡ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਹਟਾ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।');
      expect(REPORT_I18N.photoExifPrivacy.hi).toBe('अपलोड करने से पहले आपकी फोटो की लोकेशन हटा दी जाती है।');
    });
  });
});

