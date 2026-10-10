// Kisan's Help tab (K20, K21, K23): the numbers file may only hold sourced numbers, the farm's district
// picks its offices, and a complaint keeps one ticket per draft.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { GRIEVANCE_SUBTYPES, HELPLINES, TICKET_STEPS, districtAt, farmDistrict, farmPoint, helplinesFor, stepOf } from '../app/kisan/help';
import { mockGrievance } from '../app/kisan/mock';
import { say } from '../app/kisan/strings';
import { subtypeKey } from '../app/kisan/ComplaintSheet';

const p4 = YAML.parse(readFileSync(join(__dirname, '../../packages/contracts/proposals/p4-command.openapi.yaml'), 'utf8'));

describe('helplines.json', () => {
  const all = [...HELPLINES.everywhere, ...Object.values(HELPLINES.districts).flat()];

  it('every number has an official source with a date, and none is a placeholder', () => {
    for (const s of Object.values(HELPLINES.sources)) {
      expect(s.url).toMatch(/^https:\/\/[a-z0-9.-]+\.(gov|nic)\.in\//); // official government sites only
      expect(s.checked_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const line of all) {
      expect(HELPLINES.sources[line.source]).toBeDefined();
      expect(line.number).toMatch(/^[\d-]{3,15}$/);
      expect(line.number).not.toMatch(/0000/);
      for (const l of ['pa', 'hi', 'en'] as const) {
        expect(line.names[l].trim()).not.toBe('');
        expect(line.when[l].trim()).not.toBe('');
      }
    }
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
  });

  it('puts the emergency number first, then the district, then the national farming line', () => {
    expect(helplinesFor('Sangrur').map((l) => l.id)).toEqual(['emergency', 'cao_sangrur', 'ppcb_sangrur', 'kisan_call_centre']);
    expect(helplinesFor('Patiala').map((l) => l.id)).toEqual(['emergency', 'ppcb_patiala', 'kisan_call_centre']);
    expect(helplinesFor(null).map((l) => l.id)).toEqual(['emergency', 'kisan_call_centre']);
  });
});

describe("the farm's district", () => {
  it('uses the same outlines as Command', () => {
    expect(districtAt({ lat: 30.266, lon: 76.04 })).toBe('Sangrur'); // Bhawanigarh
    expect(districtAt({ lat: 30.34, lon: 76.39 })).toBe('Patiala'); // Patiala city
    expect(districtAt({ lat: 28.61, lon: 77.21 })).toBeNull(); // Delhi
  });

  it('comes from GPS, or from a known village', () => {
    expect(farmPoint({ machines: [], location: { lat: 30.27, lon: 76.04 } })).toEqual({ lat: 30.27, lon: 76.04 });
    expect(farmDistrict({ machines: [], location: { village: ' bhawanigarh ' } })).toBe('Sangrur');
    expect(farmPoint({ machines: [], location: { village: 'Nowhere' } })).toBeNull();
    expect(farmDistrict({ machines: [] })).toBeNull();
  });
});

describe('complaints and tickets', () => {
  it("offer exactly the contract's grievance subtypes, each in three languages", () => {
    expect([...GRIEVANCE_SUBTYPES]).toEqual(p4.components.schemas.KisanGrievance.properties.subtype.enum);
    for (const s of GRIEVANCE_SUBTYPES) {
      expect(new Set((['pa', 'hi', 'en'] as const).map((l) => say(subtypeKey(s), l))).size).toBe(3);
    }
  });

  it('one draft, one ticket: resending with the same key gives the same id (demo mode, like Command)', async () => {
    const first = await mockGrievance('draft-key-1234');
    const again = await mockGrievance('draft-key-1234');
    const other = await mockGrievance('draft-key-5678');
    expect(again.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
  });

  it('places every status on the progress bar; a merged report counts as with the officer', () => {
    expect(TICKET_STEPS.map(stepOf)).toEqual([0, 1, 2, 3, 4]);
    expect(stepOf('merged')).toBe(stepOf('case_opened'));
    expect(stepOf('something new')).toBe(0);
    const statuses = p4.components.schemas.ComplaintStatus.properties.status.enum as string[];
    for (const s of statuses) expect(say(`t_${s}` as Parameters<typeof say>[0], 'pa')).not.toBe('');
  });
});
