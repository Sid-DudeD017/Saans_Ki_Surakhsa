// The Sharma family's bedroom in Noida (P3's demo story): 40 m³, one window, a 250 m³/h purifier. In mock mode
// the outdoor air is an example smoggy October day there; live, it is the forecast grid's.
import type { IndoorRequest, OutdoorAt } from '../../../packages/aqi/indoor';
import { istHourOf } from '../../../packages/aqi/indoor';

export const SHARMA_BEDROOM: IndoorRequest = {
  lat: 28.5355,
  lon: 77.391,
  room_area_m2: 14.8,
  ceiling_height_m: 2.7,
  windows: 1,
  windows_open: false,
  purifier_cadr_m3_h: 250,
  hepa_class: 'h13',
  // The model is one room; the Sharmas cook in the kitchen, so the bedroom has no cooking.
  cooking_fuel: 'none',
  smokers: 0,
  incense: false,
  mosquito_coils: false,
};

/** India-time hour → PM2.5: smog through the night and morning, a cleaner afternoon when the air mixes. */
const DAY: [number, number][] = [
  [0, 270], [3, 260], [6, 270], [8, 280], [10, 230], [12, 160], [14, 110], [16, 120], [18, 190], [20, 250], [22, 270], [24, 270],
];

/** An example smoggy October day in Noida, a little different each day. */
export const EXAMPLE_OUTDOOR: OutdoorAt = (ms) => {
  const h = istHourOf(ms);
  const i = DAY.findIndex(([hour]) => hour > h) - 1;
  const [h0, v0] = DAY[i];
  const [h1, v1] = DAY[i + 1];
  const day = Math.floor((ms + 5.5 * 3_600_000) / 86_400_000);
  return (v0 + ((v1 - v0) * (h - h0)) / (h1 - h0)) * (1 + 0.06 * Math.sin(day));
};
