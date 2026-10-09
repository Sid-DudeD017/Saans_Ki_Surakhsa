// Smoke plume (P3): each FIRMS fire releases a puff of PM2.5 every 15 minutes while it burns. Each puff
// moves along the forecast wind, spreads sideways as it travels, and is mixed through the boundary layer.
// A puff of mass M with spread σ under a mixing height H adds M/(2πσ²H)·exp(−r²/2σ²) at distance r.
import { PLUME } from './config';
import { Grid, KM_PER_DEG, hoursSince, type Fire } from './grid';

const M_PER_DEG = KM_PER_DEG * 1000;

/** Briggs rural, neutral (class D) horizontal spread after x metres of travel, floored at half a cell. */
export function sigmaM(x: number): number {
  return Math.max(PLUME.minSigmaM, (0.08 * x) / Math.sqrt(1 + 0.0001 * x));
}

/** PM2.5 a fire gives off, µg/s: FRP (MJ/s) × kg/MJ × 10⁹ µg/kg. */
export function emissionUgPerS(frpMw: number): number {
  return frpMw * PLUME.kgPerMJ * 1e9 * PLUME.scale;
}

interface PuffAt {
  lat: number;
  lon: number;
  sigma: number;
  /** M/(2πσ²H): the concentration at the puff's centre. */
  peak: number;
}

export class Plume {
  /** Puffs by whole hour since the snapshot's hour 0. */
  private readonly byHour = new Map<number, PuffAt[]>();
  readonly puffCount: number;

  constructor(private readonly grid: Grid, fires: Fire[]) {
    const dt = PLUME.stepMinutes / 60;
    const last = grid.snapshot.hours - 1;
    let count = 0;
    for (const fire of fires) {
      if (!(fire.frp_mw > 0)) continue;
      const seen = hoursSince(grid.snapshot.start, fire.seen_at);
      const mass = emissionUgPerS(fire.frp_mw) * dt * 3600;
      for (let k = 0; k * dt < PLUME.burnHours; k++) {
        const released = seen + k * dt;
        if (released < 0 || released > last) continue;
        count++;
        this.track(fire, released, mass, dt, last);
      }
    }
    this.puffCount = count;
  }

  private track(fire: Fire, released: number, mass: number, dt: number, last: number) {
    let { lat, lon } = fire;
    let path = 0;
    let t = released;
    for (;;) {
      if (Math.abs(t - Math.round(t)) < 1e-9) this.record(Math.round(t), lat, lon, path, mass);
      if (t - released >= PLUME.maxAgeHours || t >= last) return;
      const u = this.grid.value('wind_u', lat, lon, t);
      const v = this.grid.value('wind_v', lat, lon, t);
      if (u === null || v === null) return; // left the grid
      // Step to the next quarter hour, but never past a whole hour, so every puff is recorded on the hour.
      const next = Math.min(t + dt, Math.floor(t + 1e-9) + 1);
      const seconds = (next - t) * 3600;
      lat += (v * seconds) / M_PER_DEG;
      lon += (u * seconds) / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
      path += Math.hypot(u, v) * seconds;
      t = next;
    }
  }

  private record(hour: number, lat: number, lon: number, path: number, mass: number) {
    const sigma = sigmaM(path);
    const mixing = Math.max(PLUME.minMixingM, this.grid.value('mixing_m', lat, lon, hour) ?? PLUME.minMixingM);
    const puffs = this.byHour.get(hour) ?? [];
    puffs.push({ lat, lon, sigma, peak: mass / (2 * Math.PI * sigma * sigma * mixing) });
    this.byHour.set(hour, puffs);
  }

  /** Smoke PM2.5, µg/m³, at a point t hours after hour 0 (linear between whole hours). */
  at(lat: number, lon: number, t: number): number {
    const h0 = Math.floor(t + 1e-9);
    const f = t - h0;
    if (f < 1e-9) return this.atHour(lat, lon, h0);
    return (1 - f) * this.atHour(lat, lon, h0) + f * this.atHour(lat, lon, h0 + 1);
  }

  private atHour(lat: number, lon: number, hour: number): number {
    const puffs = this.byHour.get(hour);
    if (!puffs) return 0;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    let total = 0;
    for (const p of puffs) {
      const dy = (lat - p.lat) * M_PER_DEG;
      const reach = 4 * p.sigma;
      if (dy > reach || dy < -reach) continue;
      const dx = (lon - p.lon) * M_PER_DEG * cosLat;
      if (dx > reach || dx < -reach) continue;
      total += p.peak * Math.exp(-(dx * dx + dy * dy) / (2 * p.sigma * p.sigma));
    }
    return total;
  }
}
