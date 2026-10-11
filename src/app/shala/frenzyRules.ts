// Filter Frenzy's rules (P2), kept apart from drawing so they can be tested: smoke particles fall, the
// child moves a filter to catch them for 60 seconds, and worse air means more and faster particles.
import type { Category } from './airQuality';

export const WORLD = { width: 320, height: 480 };
export const FILTER = { width: 72, height: 14, y: 440, speed: 320 };
export const ROUND_SECONDS = 60;

/** Particles per second and fall speed (world units per second) for each category of air. */
export const DIFFICULTY: Record<Category, { perSecond: number; fall: number }> = {
  good: { perSecond: 0.8, fall: 70 },
  satisfactory: { perSecond: 1.2, fall: 85 },
  moderate: { perSecond: 1.7, fall: 100 },
  poor: { perSecond: 2.3, fall: 120 },
  very_poor: { perSecond: 2.9, fall: 140 },
  severe: { perSecond: 3.5, fall: 160 },
};

export interface Particle {
  id: number;
  x: number;
  y: number;
  r: number;
  vy: number;
}

export interface Game {
  category: Category;
  timeLeft: number;
  caught: number;
  missed: number;
  filterX: number;
  particles: Particle[];
  nextId: number;
  spawnDebt: number;
  over: boolean;
}

export function newGame(category: Category): Game {
  return { category, timeLeft: ROUND_SECONDS, caught: 0, missed: 0, filterX: WORLD.width / 2, particles: [], nextId: 1, spawnDebt: 0, over: false };
}

/** A small seeded random generator, so a test can replay a game exactly. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Advances the game by dt seconds. move is -1 (left), 0 or 1 (right) from the keys; target, when set, is
 * where a finger or mouse wants the filter. Returns a new game; the old one is untouched.
 */
export function step(game: Game, dt: number, input: { move?: -1 | 0 | 1; target?: number | null }, random: () => number): Game {
  if (game.over || dt <= 0) return game;
  const t = Math.min(dt, 0.1, game.timeLeft);
  const half = FILTER.width / 2;
  let filterX = game.filterX;
  if (input.target !== undefined && input.target !== null) {
    // Snappy finger/mouse tracking: jump directly to finger or glide at high speed
    filterX = input.target;
  } else if (input.move) {
    filterX += input.move * FILTER.speed * 1.5 * t;
  }
  filterX = Math.max(half, Math.min(WORLD.width - half, filterX));

  const level = DIFFICULTY[game.category];
  let spawnDebt = game.spawnDebt + level.perSecond * t;
  let nextId = game.nextId;
  const particles: Particle[] = [];
  while (spawnDebt >= 1) {
    spawnDebt -= 1;
    const r = 5 + random() * 6;
    particles.push({ id: nextId++, x: r + random() * (WORLD.width - 2 * r), y: -r, r, vy: level.fall * (0.8 + random() * 0.4) });
  }

  let caught = game.caught;
  let missed = game.missed;
  for (const p of [...game.particles, ...particles.splice(0)]) {
    const y = p.y + p.vy * t;
    // Catch when particle crosses filter line OR is currently in filter vertical bounding zone
    const crossing = (p.y - p.r <= FILTER.y + FILTER.height && y + p.r >= FILTER.y);
    if (crossing && Math.abs(p.x - filterX) <= half + p.r + 4) {
      caught++;
      continue;
    }
    if (y - p.r > WORLD.height) {
      missed++;
      continue;
    }
    particles.push({ ...p, y });
  }

  const timeLeft = Math.max(0, game.timeLeft - t);
  return { ...game, timeLeft, caught, missed, filterX, particles, nextId, spawnDebt, over: timeLeft === 0 };
}

/** Share of the particles that reached the filter line which the filter caught, 0–100. */
export function catchRate(game: Pick<Game, 'caught' | 'missed'>): number {
  const total = game.caught + game.missed;
  return total ? Math.round((game.caught / total) * 100) : 0;
}

/** The end-screen tip: masks when the air is bad, purifiers otherwise. Both are true. */
export function tipFor(category: Category): 'mask' | 'purifier' {
  return category === 'poor' || category === 'very_poor' || category === 'severe' ? 'mask' : 'purifier';
}
