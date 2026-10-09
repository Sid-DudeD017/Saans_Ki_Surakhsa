// FIRMS fires (P3): times without leading zeros, as FIRMS really writes them, and the day range.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchFires } from './fires';

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';

describe('fetchFires', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads HHMM times with or without leading zeros as UTC, written in India time', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      urls.push(u);
      return new Response(
        [HEADER, '30.3,75.9,330,0.4,0.4,2026-10-08,803,N,VIIRS,n,2.0NRT,290,6.2,D', '30.4,75.8,320,0.4,0.4,2026-10-08,2025,N,VIIRS,n,2.0NRT,285,3.1,N', '30.5,75.7,315,0.4,0.4,2026-10-09,5,N,VIIRS,h,2.0NRT,280,1.5,N'].join('\n'),
      );
    }));
    const fires = await fetchFires('73.8,27,78.6,32.6', 'key', 2);
    expect(fires.map((f) => f.acquisition_time)).toEqual(['2026-10-08T13:33:00.000+05:30', '2026-10-09T01:55:00.000+05:30', '2026-10-09T05:35:00.000+05:30']);
    expect(urls[0]).toBe('https://firms.modaps.eosdis.nasa.gov/api/area/csv/key/VIIRS_SNPP_NRT/73.8,27,78.6,32.6/2');
  });

  it('asks for today only by default', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (urls.push(u), new Response(HEADER))));
    expect(await fetchFires('1,2,3,4', 'key')).toEqual([]);
    expect(urls[0].endsWith('/1,2,3,4/1')).toBe(true);
  });
});
