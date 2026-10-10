// The next 24 hours, outside and in this room (P3): two lines on one PM2.5 scale, with CPCB's 60 µg/m³
// (top of "satisfactory") marked.
import React from 'react';

import type { IndoorEstimate } from '../../../packages/aqi/indoor';
import { useGharLanguage } from './gharTranslations';

const W = 640;
const H = 220;
const PAD = { left: 55, right: 12, top: 12, bottom: 45 };

export function IndoorChart({ series }: { series: IndoorEstimate['hourly_series'] }) {
  const { tLocal } = useGharLanguage();
  const hours = series.slice(0, 24);
  if (hours.length < 2) return null;
  const top = Math.max(100, ...hours.map((h) => Math.max(h.outdoor_pm25_ug_m3, h.indoor_pm25_ug_m3)));
  const max = Math.ceil(top / 50) * 50;
  const x = (i: number) => PAD.left + (i / (hours.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const line = (pick: (h: (typeof hours)[number]) => number) => hours.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pick(h)).toFixed(1)}`).join(' ');
  
  // Calculate dynamic ticks to avoid overlapping on high values (like 3000 µg/m³)
  let step = 50;
  if (max > 2000) step = 500;
  else if (max > 1000) step = 250;
  else if (max > 500) step = 100;
  
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

  const outdoorPeak = Math.max(...hours.map(d => d.outdoor_pm25_ug_m3));
  const peakItem = hours.find(d => d.outdoor_pm25_ug_m3 === outdoorPeak);
  const peakTime = peakItem ? peakItem.time.slice(11, 16) : '';
  const indoorMin = Math.round(Math.min(...hours.map(d => d.indoor_pm25_ug_m3)));
  const indoorMax = Math.round(Math.max(...hours.map(d => d.indoor_pm25_ug_m3)));
  
  let srText = '';
  if (tLocal('chart.outside') === 'Outside') {
    srText = `Inside stays between ${indoorMin} and ${indoorMax} µg/m³ today; outside peaks at ${Math.round(outdoorPeak)} µg/m³ around ${peakTime}.`;
  } else if (tLocal('chart.outside') === 'बाहर') {
    srText = `अंदर आज ${indoorMin} और ${indoorMax} µg/m³ के बीच रहता है; बाहर लगभग ${peakTime} बजे ${Math.round(outdoorPeak)} µg/m³ तक पहुंचता है।`;
  } else {
    srText = `ਅੰਦਰ ਅੱਜ ${indoorMin} ਅਤੇ ${indoorMax} µg/m³ ਦੇ ਵਿਚਕਾਰ ਰਹਿੰਦਾ ਹੈ; ਬਾਹਰ ਲਗਭਗ ${peakTime} ਵਜੇ ${Math.round(outdoorPeak)} µg/m³ ਤੱਕ ਪਹੁੰਚਦਾ ਹੈ।`;
  }

  const centerY = PAD.top + (H - PAD.top - PAD.bottom) / 2;
  const centerX = PAD.left + (W - PAD.left - PAD.right) / 2;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={srText} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Y Axis Label */}
        <text x={16} y={centerY} transform={`rotate(-90, 16, ${centerY})`} textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600" letterSpacing="0.05em">PM2.5 (µg/m³)</text>
        
        {/* X Axis Label */}
        <text x={centerX} y={H - 4} textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600" letterSpacing="0.05em">Time of Day</text>

        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">{v}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(60)} y2={y(60)} stroke="#16a34a" strokeDasharray="4 4" />
        <text x={W - PAD.right} y={y(60) - 4} textAnchor="end" fontSize="11" fill="#15803d">60 · {tLocal('cat.satisfactory')}</text>
        {hours.map((h, i) =>
          i % 3 === 0 ? (
            <text key={h.time} x={x(i)} y={H - 22} textAnchor="middle" fontSize="11" fill="#64748b">{h.time.slice(11, 16)}</text>
          ) : null,
        )}
        <path d={line((h) => h.outdoor_pm25_ug_m3)} fill="none" stroke="#b45309" strokeWidth="2.5" />
        <path d={line((h) => h.indoor_pm25_ug_m3)} fill="none" stroke="#0369a1" strokeWidth="2.5" />
      </svg>
      <figcaption style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#475569', marginTop: '0.5rem', justifyContent: 'center' }}>
        <span><span aria-hidden style={{ display: 'inline-block', width: 14, height: 3, background: '#b45309', verticalAlign: 'middle', marginRight: 6 }} />{tLocal('chart.outside')}</span>
        <span><span aria-hidden style={{ display: 'inline-block', width: 14, height: 3, background: '#0369a1', verticalAlign: 'middle', marginRight: 6 }} />{tLocal('chart.this_room')}</span>
      </figcaption>
    </figure>
  );
}
