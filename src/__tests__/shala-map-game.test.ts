// The red-zone map's geometry and upwind rule, and Filter Frenzy's rules (P2).
import { describe, expect, it } from 'vitest';

import { CATEGORIES } from '../app/shala/airQuality';
import { DIFFICULTY, FILTER, ROUND_SECONDS, WORLD, catchRate, newGame, seeded, step, tipFor, type Game } from '../app/shala/frenzyRules';
import { RED_ZONE_KM, angleBetween, bearingDeg, compass, destination, distanceKm, isUpwind, metresPerPixel, project, tilesAround } from '../app/shala/redZone';
import { DEMO_FIRES, DEMO_STATIONS } from '../app/shala/redZoneFixtures';
import { placeFires } from '../app/shala/RedZoneMap';

const SCHOOL = { lat: 30.245, lon: 75.842 };

describe('red-zone geometry', () => {
  it('a point placed by distance and bearing comes back to the same distance and bearing', () => {
    for (const [b, km] of [[0, 2], [45, 1.4], [135, 5.8], [300, 0.5], [359, 12]]) {
      const p = destination(SCHOOL, b, km);
      expect(distanceKm(SCHOOL, p)).toBeCloseTo(km, 6);
      expect(angleBetween(bearingDeg(SCHOOL, p), b)).toBeLessThan(1e-6);
    }
  });

  it('one degree of latitude is about 111 km', () => {
    expect(distanceKm({ lat: 30, lon: 76 }, { lat: 31, lon: 76 })).toBeCloseTo(111.2, 1);
  });

  it('angles wrap around north', () => {
    expect([angleBetween(350, 10), angleBetween(10, 350), angleBetween(90, 270), angleBetween(0, 0)]).toEqual([20, 20, 180, 0]);
    expect([compass(0), compass(44), compass(46), compass(315), compass(359)]).toEqual(['N', 'NE', 'NE', 'NW', 'N']);
  });

  it('a fire is upwind within 45° of where the wind comes from, and calm air has no upwind', () => {
    const nw = destination(SCHOOL, 315, 3);
    expect(isUpwind(SCHOOL, nw, 315, 10)).toBe(true);
    expect(isUpwind(SCHOOL, nw, 271, 10)).toBe(true); // 44° away
    expect(isUpwind(SCHOOL, nw, 268, 10)).toBe(false); // 47° away
    expect(isUpwind(SCHOOL, nw, 135, 10)).toBe(false); // wind from the other side: smoke blows away
    expect(isUpwind(SCHOOL, nw, 315, 0.5)).toBe(false);
  });

  it('the 2 km ring fits inside the 512 px map at zoom 14', () => {
    const px = (RED_ZONE_KM * 1000) / metresPerPixel(SCHOOL.lat, 14);
    expect(px).toBeGreaterThan(200);
    expect(px).toBeLessThan(256);
  });

  it('the tiles cover the whole map square', () => {
    const tiles = tilesAround(SCHOOL, 14, 256);
    const left = Math.min(...tiles.map((t) => t.left));
    const top = Math.min(...tiles.map((t) => t.top));
    const right = Math.max(...tiles.map((t) => t.left + 256));
    const bottom = Math.max(...tiles.map((t) => t.top + 256));
    expect([left <= -256, top <= -256, right >= 256, bottom >= 256]).toEqual([true, true, true, true]);
    const c = project(SCHOOL, 14);
    expect(tiles.some((t) => t.x === Math.floor(c.x / 256) && t.y === Math.floor(c.y / 256))).toBe(true);
  });
});

describe('the demo points', () => {
  it('sit where they say: one fire and both stations inside the red zone', () => {
    const km = DEMO_FIRES.map((f) => distanceKm(SCHOOL, f));
    expect(km.map((d) => Math.round(d * 10) / 10)).toEqual([1.4, 5.8, 3.1, 8]);
    expect(DEMO_STATIONS.every((s) => distanceKm(SCHOOL, s) < RED_ZONE_KM)).toBe(true);
  });

  it('list upwind fires first, then the nearest', () => {
    const fromEast = placeFires(SCHOOL, DEMO_FIRES, { direction_deg: 90, speed_kmh: 5 });
    expect(fromEast.map((f) => [Math.round(f.km * 10) / 10, f.upwind])).toEqual([[3.1, true], [1.4, false], [5.8, false], [8, false]]);
    const fromNorthWest = placeFires(SCHOOL, DEMO_FIRES, { direction_deg: 310, speed_kmh: 12 });
    expect(fromNorthWest.filter((f) => f.upwind).map((f) => Math.round(f.km * 10) / 10)).toEqual([1.4, 5.8]);
  });
});

describe('Filter Frenzy', () => {
  const play = (category: Game['category'], seconds: number, input: Parameters<typeof step>[2] = {}, seed = 7) => {
    const random = seeded(seed);
    let g = newGame(category);
    for (let t = 0; t < seconds; t += 1 / 60) g = step(g, 1 / 60, input, random);
    return g;
  };

  it('worse air means more and faster smoke', () => {
    const levels = CATEGORIES.map((c) => DIFFICULTY[c]);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].perSecond).toBeGreaterThan(levels[i - 1].perSecond);
      expect(levels[i].fall).toBeGreaterThan(levels[i - 1].fall);
    }
    const good = play('good', ROUND_SECONDS);
    const severe = play('severe', ROUND_SECONDS);
    expect(severe.caught + severe.missed).toBeGreaterThan(2 * (good.caught + good.missed));
  });

  it('a round lasts 60 seconds and then stops', () => {
    const g = play('poor', ROUND_SECONDS + 1);
    expect(g.over).toBe(true);
    expect(g.timeLeft).toBe(0);
    expect(step(g, 1, {}, seeded(1))).toBe(g);
  });

  it('the same seed plays the same game', () => {
    expect(play('moderate', 20)).toEqual(play('moderate', 20));
  });

  it('a filter under the smoke catches it, and one far away misses it', () => {
    const drop = (filterX: number): Game => ({
      ...newGame('good'),
      filterX,
      spawnDebt: 0,
      particles: [{ id: 1, x: 100, y: FILTER.y - 20, r: 6, vy: 100 }],
    });
    const noSpawn = () => 0.5;
    let under = drop(100);
    let away = drop(280);
    for (let i = 0; i < 30; i++) {
      under = step(under, 1 / 30, {}, noSpawn);
      away = step(away, 1 / 30, {}, noSpawn);
    }
    expect([under.caught, under.missed]).toEqual([1, 0]);
    expect([away.caught, away.missed]).toEqual([0, 1]);
  });

  it('arrow keys move the filter, and it stays on the screen', () => {
    const left = play('good', 3, { move: -1 });
    const right = play('good', 3, { move: 1 });
    expect(left.filterX).toBe(FILTER.width / 2);
    expect(right.filterX).toBe(WORLD.width - FILTER.width / 2);
  });

  it('a finger pulls the filter toward it', () => {
    expect(Math.round(play('good', 1, { target: 60 }).filterX)).toBe(60);
  });

  it('a paused tab (no steps) changes nothing', () => {
    const g = newGame('poor');
    expect(step(g, 0, {}, seeded(1))).toBe(g);
  });

  it('scores the share of smoke caught, and tips on masks when the air is bad', () => {
    expect([catchRate({ caught: 3, missed: 1 }), catchRate({ caught: 0, missed: 0 })]).toEqual([75, 0]);
    expect(CATEGORIES.map(tipFor)).toEqual(['purifier', 'purifier', 'purifier', 'mask', 'mask', 'mask']);
  });
});
