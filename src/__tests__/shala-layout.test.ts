import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  WORDS,
  getWindCompassDirection,
  formatFiresWindSummary,
} from '../app/shala/airQuality';

const pageSource = readFileSync(join(__dirname, '../app/shala/page.tsx'), 'utf8');

describe('Saans Shala - Section 4 Layout Specification', () => {
  describe('Clutter & Duplication Removal', () => {
    it('removes the P2 MODULE badge from the page header', () => {
      expect(pageSource).not.toContain('P2 MODULE');
    });

    it('removes the developer-style subtitle and Demo Campus Specification header', () => {
      expect(pageSource).not.toContain('Demo Campus Specification');
      expect(pageSource).not.toContain('Real-time CPCB air quality tracking, child-friendly advisories, and school incident reporting.');
      expect(pageSource).not.toContain('School Air Quality & Child Health Intelligence');
    });

    it('removes the Active Role tile from the AQI card', () => {
      // Role tile was removed from Right Now overview card
      expect(pageSource).not.toContain('WORDS.activeRole');
    });

    it('removes the duplicate Today Advisory card (leaving advice solely in What to do today)', () => {
      // Checks that there is only one occurrence of role_advisories summary rendering
      const advisorySummaryOccurrences = (pageSource.match(/role_advisories\[role as keyof typeof advisory\.role_advisories\]\?\.summary/g) || []).length;
      expect(advisorySummaryOccurrences).toBeLessThanOrEqual(2); // One in Right Now 1-line advice, one in RoleAdvisoryCard
      // Check that the duplicate card header is gone from downstream
      expect(pageSource).not.toMatch(/📋 \{WORDS\.todaysAdvisory\[language\]\} \(\{role\.charAt\(0\)/);
    });
  });

  describe('Section Order & Structural Slots', () => {
    it('defines sections in exact specified order: Location Bar -> Right Now -> What to do today -> Next hours -> Around you -> Learn -> Play -> Report', () => {
      const locationBarIdx = pageSource.indexOf('Section A: Location bar');
      const rightNowIdx = pageSource.indexOf('Section B: Right now');
      const whatToDoIdx = pageSource.indexOf('Section C: What to do today');
      const nextHoursIdx = pageSource.indexOf('Section D: Next hours');
      const aroundYouIdx = pageSource.indexOf('Section E: Around you');
      const learnIdx = pageSource.indexOf('Section F: Learn');
      const playIdx = pageSource.indexOf('Section G: Play');
      const reportIdx = pageSource.indexOf('Section H: Report');

      expect(locationBarIdx).toBeGreaterThan(-1);
      expect(rightNowIdx).toBeGreaterThan(locationBarIdx);
      expect(whatToDoIdx).toBeGreaterThan(rightNowIdx);
      expect(nextHoursIdx).toBeGreaterThan(whatToDoIdx);
      expect(aroundYouIdx).toBeGreaterThan(nextHoursIdx);
      expect(learnIdx).toBeGreaterThan(aroundYouIdx);
      expect(playIdx).toBeGreaterThan(learnIdx);
      expect(reportIdx).toBeGreaterThan(playIdx);
    });

    it('provides clearly named slots for Section 5 (hourly forecast) and Section 6 (written summary)', () => {
      expect(pageSource).toContain('{/* SECTION_5_HOURLY_FORECAST_SLOT */}');
      expect(pageSource).toContain('{/* SECTION_6_WRITTEN_SUMMARY_SLOT */}');
    });

    it('does not render placeholder numbers or coming soon messages for next hours when forecast is absent', () => {
      expect(pageSource).not.toContain('coming soon');
      expect(pageSource).not.toContain('Coming soon');
      expect(pageSource).not.toContain('12-hour forecast placeholder');
    });
  });

  describe('Role-Dependent Ordering in What to do today', () => {
    it('orders PrincipalBoard before RoleAdvisoryCard for teacher/principal, and RoleAdvisoryCard first for others', () => {
      expect(pageSource).toContain('const isStaff = role === \'teacher\' || role === \'principal\';');
      expect(pageSource).toMatch(/isStaff \?\s*\(\s*<>[\s\S]*?<Card padding="lg">\s*<PrincipalBoard/);
    });
  });

  describe('Collapsible Sections & Lazy Component Mounting', () => {
    it('defaults Around you and Learn sections to closed', () => {
      expect(pageSource).toContain('const [aroundYouOpen, setAroundYouOpen] = useState(false);');
      expect(pageSource).toContain('const [learnOpen, setLearnOpen] = useState(false);');
      expect(pageSource).toContain('const [detailsOpen, setDetailsOpen] = useState(false);');
    });

    it('renders RedZoneMap only when Around you is shown (opened, or on its own tab)', () => {
      expect(pageSource).toContain("const aroundShown = aroundYouOpen || tab === 'around';");
      expect(pageSource).toContain('{aroundShown && (');
      expect(pageSource).toContain('<RedZoneMap');
    });

    it('renders AirBuddy and GasCards only when Learn is shown (opened, or on its own tab)', () => {
      expect(pageSource).toContain("const learnShown = learnOpen || tab === 'learn';");
      expect(pageSource).toContain('{learnShown && (');
      expect(pageSource).toContain('<AirBuddy');
      expect(pageSource).toContain('<GasCards');
    });
  });

  describe('Wind Direction & Fires Summary Helpers', () => {
    it('maps compass angles to 8-point compass names accurately', () => {
      expect(getWindCompassDirection(0)).toBe('north');
      expect(getWindCompassDirection(45)).toBe('northEast');
      expect(getWindCompassDirection(90)).toBe('east');
      expect(getWindCompassDirection(135)).toBe('southEast');
      expect(getWindCompassDirection(180)).toBe('south');
      expect(getWindCompassDirection(225)).toBe('southWest');
      expect(getWindCompassDirection(270)).toBe('west');
      expect(getWindCompassDirection(315)).toBe('northWest');
      expect(getWindCompassDirection(359)).toBe('north');
    });

    it('formats fires and wind summary string in en, hi, and pa', () => {
      const wind = { speed_kmh: 12.5, direction_deg: 315 };

      // With fires > 0
      const enSummary = formatFiresWindSummary(3, wind, 'en');
      expect(enSummary).toBe('3 fires within 25 km, wind from the north-west');

      const hiSummary = formatFiresWindSummary(3, wind, 'hi');
      expect(hiSummary).toContain('3');
      expect(hiSummary).toContain('उत्तर-पश्चिम');

      const paSummary = formatFiresWindSummary(3, wind, 'pa');
      expect(paSummary).toContain('3');
      expect(paSummary).toContain('ਉੱਤਰ-ਪੱਛਮ');

      // With 0 fires
      const enZero = formatFiresWindSummary(0, wind, 'en');
      expect(enZero).toBe('0 fires within 25 km, wind from the north-west');
    });
  });

  describe('Language completeness for new layout tokens', () => {
    it('has non-empty translations for all new layout words in pa, hi, and en', () => {
      const keys = [
        'rightNow',
        'whatToDoToday',
        'aroundYou',
        'learnAir',
        'playGame',
        'details',
        'actionItems',
        'firesSummary',
        'noFiresSummary',
        'north',
        'northEast',
        'east',
        'southEast',
        'south',
        'southWest',
        'west',
        'northWest',
      ] as const;

      const languages = ['pa', 'hi', 'en'] as const;
      for (const key of keys) {
        for (const lang of languages) {
          expect(WORDS[key][lang]).toBeTruthy();
        }
      }
    });
  });
});
