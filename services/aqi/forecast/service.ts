// Which forecast grid to answer from (P3). The 15-minute ingest rebuilds the stored grid every 3 hours; the API
// keeps the newest grid in memory, reads the store when that is over 6 hours old, and builds one itself when
// the store has nothing fresh (so a laptop without the ingest running still gets a forecast).
import { FRESH_HOURS, REFRESH_HOURS, USABLE_HOURS } from './config';
import { buildSnapshot } from './forecast';
import type { ForecastSnapshot } from './grid';
import { s3Store, type ForecastStore } from './store';

export interface ServiceDeps {
  store: ForecastStore;
  build: () => Promise<ForecastSnapshot>;
  now: () => number;
}

const ageHours = (s: ForecastSnapshot, now: number) => (now - Date.parse(s.generated_at)) / 3_600_000;
const newer = (a: ForecastSnapshot | null, b: ForecastSnapshot | null) =>
  !a ? b : !b ? a : Date.parse(a.generated_at) >= Date.parse(b.generated_at) ? a : b;

export function forecastService(deps: ServiceDeps) {
  let cached: ForecastSnapshot | null = null;
  let building: Promise<ForecastSnapshot> | null = null;

  /** The grid to answer from, or null when there is none under 24 hours old and none can be built. */
  async function current(): Promise<ForecastSnapshot | null> {
    const now = deps.now();
    if (cached && ageHours(cached, now) < FRESH_HOURS) return cached;
    cached = newer(cached, await deps.store.load());
    if (cached && ageHours(cached, now) < FRESH_HOURS) return cached;
    try {
      building ??= deps.build().finally(() => {
        building = null;
      });
      const built = await building;
      cached = built;
      deps.store.save(built).catch((e) => console.warn('Forecast grid not stored:', e instanceof Error ? e.message : e));
      return built;
    } catch (e) {
      console.warn('Forecast grid not built:', e instanceof Error ? e.message : e);
      return cached && ageHours(cached, now) < USABLE_HOURS ? cached : null;
    }
  }

  return { current };
}

/** For the ingest: rebuild and store the grid when the stored one is 3 hours old. */
export async function refreshForecast(deps: Omit<ServiceDeps, 'now'> & { now?: () => number }): Promise<'fresh' | 'built'> {
  const now = (deps.now ?? Date.now)();
  const stored = await deps.store.load();
  if (stored && ageHours(stored, now) < REFRESH_HOURS) return 'fresh';
  await deps.store.save(await deps.build());
  return 'built';
}

export function liveDeps(): ServiceDeps {
  return {
    store: s3Store(),
    now: Date.now,
    build: () =>
      buildSnapshot({
        fetch,
        now: Date.now,
        keys: { cpcb: process.env.CPCB_API_KEY, openaq: process.env.OPENAQ_API_KEY, firms: process.env.NASA_FIRMS_MAP_KEY },
      }),
  };
}
