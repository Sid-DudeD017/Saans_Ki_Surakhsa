// K13: the Shop catalogue may only say what a source says.
import { describe, expect, it } from 'vitest';

import { CAPACITY_ACRES_PER_DAY, DECOMPOSER_MIN_WINDOW_DAYS } from '../app/kisan/coverage';
import { SHOP } from '../app/kisan/shop';

const LANGS = ['pa', 'hi', 'en'] as const;

describe('kisan_shop.json', () => {
  it('names every source with a date, and every figure points at one', () => {
    for (const s of Object.values(SHOP.sources)) {
      expect(s.checked_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (s.url !== null) expect(s.url).toMatch(/^https:\/\//);
    }
    const known = new Set(Object.keys(SHOP.sources));
    for (const item of SHOP.items) {
      if (item.acres_per_day !== null) expect(known).toContain(item.acres_source);
      if (item.min_window_days !== undefined) expect(known).toContain(item.min_window_source);
      if (item.price_inr) expect(known).toContain(item.price_inr.source);
      for (const line of item.subsidy) expect(known).toContain(line.source);
      for (const link of item.links) {
        expect(known).toContain(link.source);
        expect(link.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('says everything in Punjabi, Hindi and English', () => {
    for (const item of SHOP.items) {
      for (const l of LANGS) {
        expect(item.names[l].trim()).not.toBe('');
        expect(item.does[l].trim()).not.toBe('');
        for (const line of item.subsidy) if (line.part) expect(line.part[l].trim()).not.toBe('');
        if (item.price_inr) expect(item.price_inr.per[l].trim()).not.toBe('');
      }
    }
  });

  it('uses the same acres per day and decomposer window as the coverage engine', () => {
    for (const item of SHOP.items) {
      if (item.engine_type) expect(item.acres_per_day).toBe(CAPACITY_ACRES_PER_DAY[item.engine_type]);
      if (item.acres_source === 'coverage_engine') expect(item.engine_type).not.toBeNull();
      if (item.kind === 'decomposer') expect(item.min_window_days).toBe(DECOMPOSER_MIN_WINDOW_DAYS);
    }
    // Every machine the check knows can be found in the shop.
    for (const machine of Object.keys(CAPACITY_ACRES_PER_DAY)) {
      expect(SHOP.items.some((i) => i.engine_type === machine)).toBe(true);
    }
  });

  it('subsidies follow the 2025 guidelines: 50% for a farmer, 80% for a CHC, sensible caps', () => {
    for (const item of SHOP.items) {
      for (const { farmer, chc } of item.subsidy) {
        expect([farmer.pct, chc.pct]).toEqual([50, 80]);
        expect(farmer.max_inr[0]).toBeLessThanOrEqual(farmer.max_inr[1]);
        expect(chc.max_inr[0]).toBeGreaterThan(farmer.max_inr[0]); // a CHC's cap is always the larger
      }
    }
    const superSeeder = SHOP.items.find((i) => i.id === 'super_seeder')!;
    expect(superSeeder.subsidy[0].farmer.max_inr).toEqual([120000, 120000]);
  });

  it('never invents a machine price', () => {
    for (const item of SHOP.items.filter((i) => i.kind === 'machine')) expect(item.price_inr).toBeNull();
  });
});
