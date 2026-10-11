// The Machines and Shop tabs' arithmetic on Gurpreet's farm (18 acres, 1 tractor, 20 Oct to 9 Nov, a
// Super Seeder rented for 2 days: 61%, 7 acres short): how many more days close the gap, the season
// strip, and which CHC rental the Shop puts first.
import { describe, expect, it } from 'vitest';

import type { FarmProfile } from '../app/kisan/farmProfile';
import { daysLeft, helperMachine, seasonDays, whatIf } from '../app/kisan/machinePlan';
import { SHOP } from '../app/kisan/shopCatalogue';
import { rankShop, rentOptions, type ChcsFound } from '../app/kisan/shopRank';

const GURPREET: FarmProfile = {
  location: { village: 'Bhawanigarh' },
  paddyAcres: 18,
  tractors: 1,
  harvestDate: '2026-10-20',
  wheatBy: '2026-11-09',
  machines: [{ id: 'a', type: 'super_seeder', count: 1, owned: false, days: 2, addedAt: '2026-10-10T00:00:00Z' }],
};

describe('what if', () => {
  it('1.5 more days of his Super Seeder clear the last 7 acres', () => {
    expect(whatIf(GURPREET)).toEqual({ machine: 'super_seeder', extraDays: 1.5, pct: 100 });
  });

  it('says nothing when there is no gap', () => {
    expect(whatIf({ ...GURPREET, machines: [{ ...GURPREET.machines[0], days: 4 }] })).toBeNull();
  });

  it('with one tractor, more days of one machine can only go so far', () => {
    const big = whatIf({ ...GURPREET, paddyAcres: 200 });
    expect(big!.pct).toBeLessThan(100);
    expect(big!.extraDays).toBeGreaterThan(0);
  });

  it('suggests his rented machine, else his fastest, else a Super Seeder', () => {
    expect(helperMachine({ ...GURPREET, machines: [] })).toBe('super_seeder');
    const owned = (type: 'baler' | 'mulcher_rmb') => ({ id: type, type, count: 1, owned: true, addedAt: '' });
    expect(helperMachine({ ...GURPREET, machines: [owned('mulcher_rmb'), owned('baler')] })).toBe('baler');
    expect(helperMachine({ ...GURPREET, machines: [owned('baler'), ...GURPREET.machines] })).toBe('super_seeder');
  });
});

describe('the season strip', () => {
  it('has a day per day to the deadline: his 2 days first, then rain, the CHC booking, and idle days', () => {
    const days = seasonDays(GURPREET, { rain: ['2026-10-27', '2026-10-28'], chc: ['2026-11-02'] }, '2026-10-21');
    expect(days).toHaveLength(20);
    expect(days[0]).toEqual({ date: '2026-10-20', kind: 'own', past: true });
    expect(days.filter((d) => d.kind === 'own').map((d) => d.date)).toEqual(['2026-10-20', '2026-10-21']);
    expect(days.filter((d) => d.kind === 'rain')).toHaveLength(2);
    expect(days.find((d) => d.date === '2026-11-02')!.kind).toBe('chc');
    expect(days.filter((d) => d.kind === 'idle')).toHaveLength(15);
    expect(days.at(-1)!.date).toBe('2026-11-08');
  });

  it('is empty until the farm card has paddy and both dates', () => {
    expect(seasonDays({ machines: [] })).toEqual([]);
  });

  it('counts the days left to sow wheat', () => {
    expect(daysLeft(GURPREET, '2026-10-10')).toBe(30);
    expect(daysLeft(GURPREET, '2026-11-10')).toBe(-1);
    expect(daysLeft({ machines: [] })).toBeNull();
  });
});

describe("the Shop's best pick", () => {
  const fit = rankShop(GURPREET, SHOP.items)!;
  const chc = (id: string, km: number, machine: string, rate: number, free: number | null, first: string | null) => ({
    chc_id: id,
    name: id,
    distance_km: km,
    machines: [{ machine, cost_per_acre_inr: rate, free_days: free, first_free: first }],
  });
  // The contract's demo CHCs in Gurpreet's season: only CHC A's Super Seeder is free, on 2 Nov.
  const demo: Record<string, ChcsFound> = {
    super_seeder: { chcs: [chc('A', 2, 'super_seeder', 1000, 1, '2026-11-02')] },
    happy_seeder: { chcs: [chc('A', 2, 'happy_seeder', 750, 0, null), chc('B', 6, 'happy_seeder', 750, 0, null)] },
  };

  it('puts the machine that clears most in its free days first, with its cost', () => {
    const [best, ...rest] = rentOptions(fit, SHOP.items, demo);
    expect(best).toMatchObject({ machine: 'super_seeder', chc: { id: 'A' }, acres: 5.5, days: 1, cost: 5500, enough: false, firstFree: '2026-11-02' });
    expect(rest.map((o) => o.machine)).not.toContain('happy_seeder'); // no free day, nothing to offer
  });

  it('prefers one that clears the whole gap, then the cheaper one', () => {
    const more = { ...demo, happy_seeder: { chcs: [...demo.happy_seeder.chcs, chc('C', 20, 'happy_seeder', 750, 5, '2026-10-20')] } };
    const [best] = rentOptions(fit, SHOP.items, more);
    expect(best).toMatchObject({ machine: 'happy_seeder', chc: { id: 'C' }, acres: 7, cost: 5250, enough: true });
  });

  it("without free days, offers the machine's whole gain at the CHC's rate", () => {
    const unknown = { super_seeder: { chcs: [chc('A', 2, 'super_seeder', 1000, null, null)] } };
    expect(rentOptions(fit, SHOP.items, unknown)[0]).toMatchObject({ acres: 7, cost: 7000, enough: true, freeDays: null });
  });
});
