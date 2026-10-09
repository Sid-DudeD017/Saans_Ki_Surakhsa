// The next 24 hours, outside and in this room (P3): two lines on one PM2.5 scale, with CPCB's 60 µg/m³
// (top of "satisfactory") marked.
import React from 'react';

import type { IndoorEstimate } from '../../../packages/aqi/indoor';

const W = 640;
const H = 220;
const PAD = { left: 40, right: 12, top: 12, bottom: 28 };

export function IndoorChart({ series }: { series: IndoorEstimate['hourly_series'] }) {
  const hours = series.slice(0, 24);
  if (hours.length < 2) return null;
  const top = Math.max(100, ...hours.map((h) => Math.max(h.outdoor_pm25_ug_m3, h.indoor_pm25_ug_m3)));
  const max = Math.ceil(top / 50) * 50;
  const x = (i: number) => PAD.left + (i / (hours.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const line = (pick: (h: (typeof hours)[number]) => number) => hours.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pick(h)).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: max / 50 + 1 }, (_, i) => i * 50).filter((v, _, all) => all.length <= 7 || v % 100 === 0);

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="PM2.5 outside and in this room over the next 24 hours" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">{v}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(60)} y2={y(60)} stroke="#16a34a" strokeDasharray="4 4" />
        <text x={W - PAD.right} y={y(60) - 4} textAnchor="end" fontSize="11" fill="#15803d">60 · satisfactory</text>
        {hours.map((h, i) =>
          i % 3 === 0 ? (
            <text key={h.time} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">{h.time.slice(11, 16)}</text>
          ) : null,
        )}
        <path d={line((h) => h.outdoor_pm25_ug_m3)} fill="none" stroke="#b45309" strokeWidth="2.5" />
        <path d={line((h) => h.indoor_pm25_ug_m3)} fill="none" stroke="#0369a1" strokeWidth="2.5" />
      </svg>
      <figcaption style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
        <span><span aria-hidden style={{ display: 'inline-block', width: 14, height: 3, background: '#b45309', verticalAlign: 'middle', marginRight: 6 }} />Outside</span>
        <span><span aria-hidden style={{ display: 'inline-block', width: 14, height: 3, background: '#0369a1', verticalAlign: 'middle', marginRight: 6 }} />This room</span>
        <span>PM2.5, µg/m³, India time</span>
      </figcaption>
    </figure>
  );
}
