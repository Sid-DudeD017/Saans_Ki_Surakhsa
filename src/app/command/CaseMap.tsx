// The console's map (P4): OpenStreetMap tiles with the cases, or one case with the farm whose help request
// it links to and the CHC that can send a machine. Zoomed to fit; projection helpers are P2's (redZone.ts).
import React from 'react';

import { TILE, project, tilesAround, type LatLon } from '../shala/redZone';

export interface MapPoint extends LatLon {
  id: string;
  label: string;
  kind: 'report' | 'help' | 'farm' | 'chc' | 'closed';
  selected?: boolean;
}

const SIZE = 480;
const HALF = SIZE / 2;
const STYLE: Record<MapPoint['kind'], { fill: string; r: number }> = {
  report: { fill: '#dc2626', r: 7 },
  help: { fill: '#16a34a', r: 7 },
  farm: { fill: '#16a34a', r: 8 },
  chc: { fill: '#2563eb', r: 8 },
  closed: { fill: '#94a3b8', r: 6 },
};

/** The largest zoom (5–15) at which every point fits inside the map, with a margin. */
export function fitZoom(points: LatLon[]): number {
  for (let z = 15; z > 5; z--) {
    const xs = points.map((p) => project(p, z));
    const w = Math.max(...xs.map((p) => p.x)) - Math.min(...xs.map((p) => p.x));
    const h = Math.max(...xs.map((p) => p.y)) - Math.min(...xs.map((p) => p.y));
    if (w <= SIZE - 80 && h <= SIZE - 80) return z;
  }
  return 5;
}

export function CaseMap({ points, onPick, title }: { points: MapPoint[]; onPick?: (id: string) => void; title: string }) {
  if (!points.length) return null;
  const centre = { lat: (Math.max(...points.map((p) => p.lat)) + Math.min(...points.map((p) => p.lat))) / 2, lon: (Math.max(...points.map((p) => p.lon)) + Math.min(...points.map((p) => p.lon))) / 2 };
  const zoom = fitZoom(points);
  const c = project(centre, zoom);
  const at = (p: LatLon) => {
    const q = project(p, zoom);
    return { x: HALF + q.x - c.x, y: HALF + q.y - c.y };
  };
  const drawn = [...points].sort((a, b) => Number(!!a.selected) - Number(!!b.selected));
  return (
    <figure style={{ margin: 0, display: 'grid', gap: '0.35rem' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title} style={{ width: '100%', maxWidth: SIZE, height: 'auto', borderRadius: '0.75rem', border: '1px solid #cbd5e1', background: '#e2e8f0' }}>
        {tilesAround(centre, zoom, HALF).map((t) => (
          <image key={`${t.x}-${t.y}`} href={`https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`} x={HALF + t.left} y={HALF + t.top} width={TILE} height={TILE} />
        ))}
        {drawn.map((p) => {
          const { x, y } = at(p);
          const s = STYLE[p.kind];
          return (
            <g key={p.id} onClick={onPick ? () => onPick(p.id) : undefined} style={{ cursor: onPick ? 'pointer' : 'default' }}>
              <title>{p.label}</title>
              <circle cx={x} cy={y} r={s.r + (p.selected ? 5 : 2)} fill="#ffffff" stroke={p.selected ? '#0f172a' : 'none'} strokeWidth={2} />
              <circle cx={x} cy={y} r={s.r} fill={s.fill} />
            </g>
          );
        })}
      </svg>
      <figcaption style={{ fontSize: '0.75rem', color: '#64748b' }}>
        Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
      </figcaption>
    </figure>
  );
}
