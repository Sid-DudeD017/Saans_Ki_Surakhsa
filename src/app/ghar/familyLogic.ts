import type { IndoorEstimate } from '../../../packages/aqi/indoor';
import type { TimeBlock } from './familyState';

export interface DailyAverageResult {
  average: number | null;
  missingHours: number;
  worstStretch: { start: string; end: string; locationId: string; average: number } | null;
}

// Parses HH:mm string to hour fraction (e.g. "08:30" -> 8.5)
export function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

// Calculate intersection of a block and a specific clock hour [H, H+1)
// blockStart and blockEnd are in hours (0 to 24).
// Returns the fraction of the hour (0 to 1) that is covered by the block.
export function overlapFraction(h: number, blockStart: number, blockEnd: number): number {
  let overlap = 0;
  if (blockStart <= blockEnd) {
    const start = Math.max(h, blockStart);
    const end = Math.min(h + 1, blockEnd);
    overlap = Math.max(0, end - start);
  } else {
    // Overnight block, e.g. 22:00 to 06:00
    // Treated as two blocks: 22:00-24:00 and 00:00-06:00
    const start1 = Math.max(h, blockStart);
    const end1 = Math.min(h + 1, 24);
    const overlap1 = Math.max(0, end1 - start1);

    const start2 = Math.max(h, 0);
    const end2 = Math.min(h + 1, blockEnd);
    const overlap2 = Math.max(0, end2 - start2);

    overlap = overlap1 + overlap2;
  }
  return overlap;
}

export function calculateDailyExposure(
  blocks: TimeBlock[],
  estimates: Record<string, IndoorEstimate>,
  outdoorForecast: { time: string; value: number }[]
): DailyAverageResult {
  if (outdoorForecast.length < 24) return { average: null, missingHours: 24, worstStretch: null };

  const timeline = outdoorForecast.slice(0, 24).map(o => {
    // extract hour from ISO string (India time +05:30)
    // "2026-10-09T08:00:00+05:30" -> hour 8
    const match = o.time.match(/T(\d\d):(\d\d)/);
    const hour = match ? parseInt(match[1], 10) : 0;
    return { time: o.time, hour, outdoorValue: o.value };
  });

  let totalExposure = 0;
  let totalFractions = 0;
  const hourExposures: { start: string, end: string, value: number, locationId: string }[] = [];

  for (const t of timeline) {
    let hourValue = 0;
    let hourFractionCovered = 0;
    let dominantLocation = '';
    let maxOverlap = 0;

    for (const b of blocks) {
      const start = parseTime(b.start);
      const end = parseTime(b.end);
      const frac = overlapFraction(t.hour, start, end);
      if (frac > 0) {
        let val: number | undefined;
        if (b.locationId === 'out') {
          val = t.outdoorValue;
        } else {
          const est = estimates[b.locationId];
          const seriesItem = est?.hourly_series.find(s => s.time === t.time);
          val = seriesItem?.indoor_pm25_ug_m3;
        }

        if (val !== undefined) {
          hourValue += val * frac;
          hourFractionCovered += frac;
          if (frac > maxOverlap) {
            maxOverlap = frac;
            dominantLocation = b.locationId;
          }
        }
      }
    }

    if (hourFractionCovered > 0) {
      // Avoid double-counting if overlapping blocks > 1 hr
      const normalize = Math.min(1, hourFractionCovered);
      const normalizedValue = hourValue / hourFractionCovered * normalize;
      totalExposure += normalizedValue;
      totalFractions += normalize;
      
      const startMatch = t.time.match(/T(\d\d:\d\d)/);
      const endHour = (t.hour + 1) % 24;
      const endStr = endHour.toString().padStart(2, '0') + ':00';

      hourExposures.push({
        start: startMatch ? startMatch[1] : '',
        end: endStr,
        value: normalizedValue / normalize,
        locationId: dominantLocation
      });
    }
  }

  const missingHours = 24 - totalFractions;
  let average = null;
  if (totalFractions > 0) {
    average = Math.round(totalExposure / totalFractions);
  }

  // Find worst 2-hour stretch
  let worstStretch = null;
  if (hourExposures.length >= 2) {
    let max = -1;
    for (let i = 0; i < hourExposures.length - 1; i++) {
      const e1 = hourExposures[i];
      const e2 = hourExposures[i + 1];
      const avg = (e1.value + e2.value) / 2;
      if (avg > max) {
        max = avg;
        worstStretch = {
          start: e1.start,
          end: e2.end,
          locationId: e1.locationId,
          average: Math.round(avg)
        };
      }
    }
  } else if (hourExposures.length === 1) {
    worstStretch = {
      start: hourExposures[0].start,
      end: hourExposures[0].end,
      locationId: hourExposures[0].locationId,
      average: Math.round(hourExposures[0].value)
    };
  }

  return {
    average,
    missingHours: Math.round(missingHours * 10) / 10,
    worstStretch
  };
}

export function generatePurifierComparison(
  blocks: TimeBlock[],
  baselineEstimates: Record<string, IndoorEstimate>,
  purifierEstimate: IndoorEstimate | null,
  bedroomId: string,
  outdoorForecast: { time: string; value: number }[]
) {
  if (!purifierEstimate) return null;

  const baseline = calculateDailyExposure(blocks, baselineEstimates, outdoorForecast);
  
  // Create override estimates map
  const purifierEstimates = { ...baselineEstimates, [bedroomId]: purifierEstimate };
  const improved = calculateDailyExposure(blocks, purifierEstimates, outdoorForecast);

  if (baseline.average === null || improved.average === null) return null;
  if (improved.average >= baseline.average) return null;

  return {
    baselineAvg: baseline.average,
    improvedAvg: improved.average
  };
}
