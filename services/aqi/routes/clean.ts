// Saaf Raasta (P3): the PM2.5 you would breathe on each route, at the minute you'd be on each part of it.
//   dose = Σ Ĉ(cell_i, t_i) × (1 + 0.3·congestion_i) × f_mode × BR_mode × Δt_i × (1 − mask)
// with t_i = departure + travel time to piece i, and Ĉ from the forecast grid at that hour.
import type { LatLon, Mode, RouteOption } from './providers';

/** Planning values from p3-aqi.openapi.json: exposure factor f and breathing rate BR (m³/h). Not medical advice. */
export const MODE_FACTORS: Record<Mode, { f: number; breathing_rate_m3_h: number }> = {
  two_wheeler: { f: 1.0, breathing_rate_m3_h: 0.6 },
  car_windows_up: { f: 0.5, breathing_rate_m3_h: 0.5 },
  bus: { f: 0.9, breathing_rate_m3_h: 0.5 },
  walk: { f: 1.0, breathing_rate_m3_h: 1.0 },
  cycle: { f: 1.0, breathing_rate_m3_h: 2.0 },
  metro: { f: 0.6, breathing_rate_m3_h: 0.5 },
};

/** Routes are cut into pieces no longer than this, each looked up in its own 1 km cell at its own time. */
export const PIECE_M = 500;
const M_PER_DEG = (6371 * Math.PI * 1000) / 180;

export interface Piece {
  name: string;
  lat: number;
  lon: number;
  distance_m: number;
  duration_s: number;
  congestion: number;
  /** Seconds after departure that the traveller reaches the piece's middle. */
  at_s: number;
}

function metres(a: [number, number], b: [number, number]): number {
  const dy = (b[1] - a[1]) * M_PER_DEG;
  const dx = (b[0] - a[0]) * M_PER_DEG * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** Cut a route into pieces of at most 500 m, sharing each step's time out by distance, and time each piece. */
export function cutRoute(route: RouteOption): Piece[] {
  const pieces: Piece[] = [];
  let elapsed = 0;
  for (const step of route.steps) {
    const lengths = step.coords.slice(1).map((c, i) => metres(step.coords[i], c));
    const total = lengths.reduce((a, b) => a + b, 0) || step.distance_m;
    const secondsPerM = step.duration_s / total;
    // Cut by the step's own distance (OSRM's differs a little from its geometry's), allowing for rounding.
    const limit = PIECE_M * (total / step.distance_m);
    const EPS = 1e-6;
    let start = step.coords[0];
    let run = 0;
    const flush = (end: [number, number]) => {
      if (run <= EPS) return;
      const duration = run * secondsPerM;
      pieces.push({
        name: step.name,
        lat: (start[1] + end[1]) / 2,
        lon: (start[0] + end[0]) / 2,
        distance_m: run * (step.distance_m / total),
        duration_s: duration,
        congestion: step.congestion,
        at_s: elapsed + duration / 2,
      });
      elapsed += duration;
      start = end;
      run = 0;
    };
    for (let i = 0; i < lengths.length; i++) {
      let left = lengths[i];
      let from = step.coords[i];
      const to = step.coords[i + 1];
      while (run + left > limit + EPS) {
        const take = limit - run;
        const f = take / left;
        const cut: [number, number] = [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
        run += take;
        flush(cut);
        left -= take;
        from = cut;
      }
      run += left;
    }
    flush(step.coords[step.coords.length - 1]);
    if (lengths.length === 0 && step.duration_s > 0) elapsed += step.duration_s;
  }
  return pieces;
}

/** PM2.5 at a place and instant, or null where there is no forecast. */
export type Pm25At = (lat: number, lon: number, ms: number) => number | null;

export interface TimedPiece extends Piece {
  pm25: number;
  dose_ug: number;
}

/**
 * Each piece's PM2.5 at the time the traveller gets there, and its dose. Where the grid has no value (past its
 * edge), the last value along the route is held. Returns null if the route has no value at all.
 */
export function doseAlong(pieces: Piece[], departAt: number, mode: Mode, mask: number, pm25At: Pm25At): { pieces: TimedPiece[]; dose_ug: number } | null {
  const { f, breathing_rate_m3_h: br } = MODE_FACTORS[mode];
  const values = pieces.map((p) => pm25At(p.lat, p.lon, departAt + p.at_s * 1000));
  // Pieces before the first value take the first one; after that, the last one is held.
  let last = values.find((v) => v !== null) ?? null;
  if (last === null) return null;
  const timed = pieces.map((p, i) => {
    const c = values[i] ?? last!;
    last = c;
    return { ...p, pm25: c, dose_ug: c * (1 + 0.3 * p.congestion) * f * br * (p.duration_s / 3600) * (1 - mask) };
  });
  return { pieces: timed, dose_ug: timed.reduce((a, p) => a + p.dose_ug, 0) };
}

export interface Segment {
  name: string;
  pm25_ug_m3: number;
  congestion: number;
  duration_min: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Pieces joined back into named stretches of road (unnamed ones join the stretch before), at most `max`. */
export function segmentsOf(pieces: TimedPiece[], max = 6): Segment[] {
  type Acc = { name: string; seconds: number; pm: number; cong: number };
  let groups: Acc[] = [];
  for (const p of pieces) {
    const prev = groups[groups.length - 1];
    if (prev && (p.name === prev.name || !p.name)) {
      prev.seconds += p.duration_s;
      prev.pm += p.pm25 * p.duration_s;
      prev.cong += p.congestion * p.duration_s;
    } else {
      groups.push({ name: p.name, seconds: p.duration_s, pm: p.pm25 * p.duration_s, cong: p.congestion * p.duration_s });
    }
  }
  // Fold the shortest stretch into its shorter neighbour until there are few enough.
  while (groups.length > max) {
    let i = 0;
    groups.forEach((g, k) => {
      if (g.seconds < groups[i].seconds) i = k;
    });
    const j = i === 0 ? 1 : i === groups.length - 1 ? i - 1 : groups[i - 1].seconds <= groups[i + 1].seconds ? i - 1 : i + 1;
    const [a, b] = [groups[Math.min(i, j)], groups[Math.max(i, j)]];
    const keep = a.seconds >= b.seconds ? a : b;
    const merged = { name: keep.name || a.name || b.name, seconds: a.seconds + b.seconds, pm: a.pm + b.pm, cong: a.cong + b.cong };
    groups = [...groups.slice(0, Math.min(i, j)), merged, ...groups.slice(Math.max(i, j) + 1)];
  }
  // Folding can leave two stretches of the same road side by side; join them.
  groups = groups.reduce<Acc[]>((out, g) => {
    const prev = out[out.length - 1];
    if (prev && prev.name === g.name) {
      prev.seconds += g.seconds;
      prev.pm += g.pm;
      prev.cong += g.cong;
    } else out.push({ ...g });
    return out;
  }, []);
  return groups.map((g) => ({
    name: g.name || 'Local roads',
    pm25_ug_m3: round1(g.pm / g.seconds),
    congestion: round1(g.cong / g.seconds),
    duration_min: round1(g.seconds / 60),
  }));
}

export interface ScoredRoute {
  route_id: string;
  label: string;
  duration_min: number;
  distance_km: number;
  dose_ug: number;
  percent_lower_than_fastest: number;
  segments: Segment[];
  /** Kept for re-timing; not sent. */
  pieces: Piece[];
}

/** A name for each route from its longest named stretch, made unique, with the fastest marked. */
function labels(routes: { segments: Segment[]; duration_s: number }[]): string[] {
  const fastest = routes.reduce((a, r, i) => (r.duration_s < routes[a].duration_s ? i : a), 0);
  const named = (r: { segments: Segment[] }) => [...r.segments].filter((s) => s.name !== 'Local roads').sort((a, b) => b.duration_min - a.duration_min);
  const out = routes.map((r) => `Via ${named(r)[0]?.name ?? 'local roads'}`);
  out.forEach((l, i) => {
    if (out.filter((x) => x === l).length > 1) {
      const other = named(routes[i]).find((s) => !out.some((x, k) => k !== i && x.includes(s.name)));
      if (other) out[i] = `${l} and ${other.name}`;
    }
  });
  out.forEach((l, i) => {
    if (out.filter((x) => x === l).length > 1) out[i] = `${l} (${String.fromCharCode(65 + i)})`;
  });
  return out.map((l, i) => (i === fastest ? `${l} (fastest)` : l));
}

export interface CleanRouteChoice {
  routes: ScoredRoute[];
  recommended_route_id: string;
  better_departure_ms?: number;
}

/**
 * Score every route, drop any that another route beats on both time and dose, recommend the lowest dose within
 * `maxExtraMin` of the fastest, and try leaving up to 2 hours earlier or later (30-minute steps, never in the
 * past) for a departure that cuts the recommended route's dose by at least 10%.
 */
export function chooseRoute(options: RouteOption[], departAt: number, mode: Mode, mask: number, maxExtraMin: number, pm25At: Pm25At, now: number): CleanRouteChoice | null {
  const scored = options
    .map((o) => {
      const pieces = cutRoute(o);
      const d = doseAlong(pieces, departAt, mode, mask, pm25At);
      return d && { o, pieces, d, segments: segmentsOf(d.pieces) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (!scored.length) return null;

  const kept = scored.filter((a) => !scored.some((b) => b !== a && b.o.duration_s <= a.o.duration_s && b.d.dose_ug <= a.d.dose_ug && (b.o.duration_s < a.o.duration_s || b.d.dose_ug < a.d.dose_ug)));
  const fastest = kept.reduce((a, r) => (r.o.duration_s < a.o.duration_s ? r : a));
  const names = labels(kept.map((k) => ({ segments: k.segments, duration_s: k.o.duration_s })));
  const routes: ScoredRoute[] = kept.map((k, i) => ({
    route_id: `r${i + 1}`,
    label: names[i],
    duration_min: Math.round(k.o.duration_s / 60),
    distance_km: round1(k.o.distance_m / 1000),
    dose_ug: round1(k.d.dose_ug),
    percent_lower_than_fastest: Math.max(0, Math.round(((fastest.d.dose_ug - k.d.dose_ug) / fastest.d.dose_ug) * 100)),
    segments: k.segments,
    pieces: k.pieces,
  }));

  const withinTime = kept.filter((k) => k.o.duration_s <= fastest.o.duration_s + maxExtraMin * 60);
  const best = withinTime.reduce((a, r) => (r.d.dose_ug < a.d.dose_ug ? r : a));
  const recommended = routes[kept.indexOf(best)];

  let better: number | undefined;
  let betterDose = best.d.dose_ug * 0.9;
  for (let minutes = -120; minutes <= 120; minutes += 30) {
    const at = departAt + minutes * 60_000;
    if (minutes === 0 || at < now) continue;
    const d = doseAlong(best.pieces, at, mode, mask, pm25At);
    if (d && d.dose_ug < betterDose) {
      better = at;
      betterDose = d.dose_ug;
    }
  }
  return { routes, recommended_route_id: recommended.route_id, ...(better !== undefined ? { better_departure_ms: better } : {}) };
}

export type { LatLon };
