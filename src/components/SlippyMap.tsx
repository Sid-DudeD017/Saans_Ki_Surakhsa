'use client';

// A small map you can drag and zoom, on OpenStreetMap tiles, with tappable pins. Drag (or the arrow
// keys) to move, the wheel, a pinch or the +/− buttons to zoom, and ⤢ to fit every pin again. No map
// library: the projection helpers are P2's (src/app/shala/redZone.ts).
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { TILE, project, type LatLon } from '../app/shala/redZone';

export interface Pin extends LatLon {
  id: string;
  label: string;
  /** Fill colour of the pin. */
  colour: string;
  selected?: boolean;
  /** Drawn smaller and under the others (a closed case, say). */
  quiet?: boolean;
}

interface View {
  zoom: number;
  /** The centre in world pixels at this zoom. */
  x: number;
  y: number;
}

interface Drag {
  x: number;
  y: number;
  moved: boolean;
  pointers: Map<number, { x: number; y: number }>;
  /** The distance between two fingers when a pinch last changed the zoom. */
  pinch?: number;
}

const MIN_ZOOM = 4;
const MAX_ZOOM = 17;

/** Pins within a few pixels of each other fan out in a small ring, so each one can still be tapped. */
function spread<T extends { left: number; top: number }>(pins: T[]): T[] {
  const groups: T[][] = [];
  for (const p of pins) {
    const g = groups.find((g) => Math.hypot(g[0].left - p.left, g[0].top - p.top) < 10);
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups.flatMap((g) =>
    g.length === 1 ? g : g.map((p, i) => ({ ...p, left: g[0].left + 14 * Math.cos((2 * Math.PI * i) / g.length), top: g[0].top + 14 * Math.sin((2 * Math.PI * i) / g.length) })),
  );
}

function unproject(x: number, y: number, zoom: number): LatLon {
  const scale = TILE * 2 ** zoom;
  const lon = (x / scale) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
  return { lat, lon };
}

/** The view that shows every pin with a margin, in a box of this size. */
export function fitView(pins: LatLon[], width: number, height: number, maxZoom = 14): View {
  if (!pins.length) return { zoom: 7, ...project({ lat: 30.4, lon: 75.9 }, 7) };
  for (let z = maxZoom; z > MIN_ZOOM; z--) {
    const xs = pins.map((p) => project(p, z));
    const left = Math.min(...xs.map((p) => p.x));
    const right = Math.max(...xs.map((p) => p.x));
    const top = Math.min(...xs.map((p) => p.y));
    const bottom = Math.max(...xs.map((p) => p.y));
    if (right - left <= width - 80 && bottom - top <= height - 80) return { zoom: z, x: (left + right) / 2, y: (top + bottom) / 2 };
  }
  const c = project(pins[0], MIN_ZOOM);
  return { zoom: MIN_ZOOM, ...c };
}

/** Zoom by one step, keeping the point at (px, py) from the map's top-left where it is. */
function zoomAt(v: View, step: 1 | -1, px: number, py: number, width: number, height: number): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom + step));
  if (zoom === v.zoom) return v;
  const f = 2 ** (zoom - v.zoom);
  const dx = px - width / 2;
  const dy = py - height / 2;
  return { zoom, x: (v.x + dx) * f - dx, y: (v.y + dy) * f - dy };
}

const CONTROL: React.CSSProperties = {
  width: '2.5rem',
  height: '2.5rem',
  border: 'none',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '1.25rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'inherit',
};

export function SlippyMap({ pins, onPick, label, height = '22rem', maxZoom = 14 }: { pins: Pin[]; onPick?: (id: string) => void; label: string; height?: string; maxZoom?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  // The map's own size, so tiles and the fitted view match whatever space it's given.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the pins when the map is first on screen (a map in a hidden tab measures 0 × 0 until its tab
  // opens), and again when the set of pins changes.
  const pinKey = pins.map((p) => `${p.id}@${p.lat},${p.lon}`).join('|');
  const [fittedFor, setFittedFor] = useState('');
  if (size && size.w > 0 && size.h > 0 && (view === null || fittedFor !== pinKey)) {
    setFittedFor(pinKey);
    setView(fitView(pins, size.w, size.h, maxZoom));
  }

  const fit = useCallback(() => size && setView(fitView(pins, size.w, size.h, maxZoom)), [pins, size, maxZoom]);
  const zoomBy = (step: 1 | -1) => size && setView((v) => v && zoomAt(v, step, size.w / 2, size.h / 2, size.w, size.h));

  // Wheel zoom, around the pointer. Not a React handler, so the page doesn't scroll while zooming.
  useEffect(() => {
    const el = box.current;
    if (!el || !size) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - last < 180 || Math.abs(e.deltaY) < 4) return;
      last = now;
      const r = el.getBoundingClientRect();
      setView((v) => v && zoomAt(v, e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top, size.w, size.h));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size]);

  function down(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const d: Drag = drag.current ?? { x: e.clientX, y: e.clientY, moved: false, pointers: new Map() };
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pointers.size === 2) {
      const [a, b] = [...d.pointers.values()];
      d.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    d.x = e.clientX;
    d.y = e.clientY;
    drag.current = d;
    dragged.current = false;
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !d.pointers.has(e.pointerId) || !size) return;
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pointers.size === 2 && d.pinch) {
      const [a, b] = [...d.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist / d.pinch > 1.4 || dist / d.pinch < 0.7) {
        const r = box.current!.getBoundingClientRect();
        setView((v) => v && zoomAt(v, dist > d.pinch! ? 1 : -1, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, size.w, size.h));
        d.pinch = dist;
      }
      d.moved = true;
      dragged.current = true;
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      box.current?.setPointerCapture(e.pointerId);
      setGrabbing(true);
    }
    d.moved = true;
    dragged.current = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => v && { ...v, x: v.x - dx, y: v.y - dy });
  }

  function up(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    d.pointers.delete(e.pointerId);
    if (d.pointers.size === 0) {
      drag.current = null;
      setGrabbing(false);
    }
    else if (d.pointers.size === 1) {
      const [p] = [...d.pointers.values()];
      d.x = p.x;
      d.y = p.y;
      d.pinch = undefined;
    }
  }

  function keys(e: React.KeyboardEvent) {
    const pan = 80;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-pan, 0], ArrowRight: [pan, 0], ArrowUp: [0, -pan], ArrowDown: [0, pan] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => v && { ...v, x: v.x + dx, y: v.y + dy });
    } else if (e.key === '+' || e.key === '=') zoomBy(1);
    else if (e.key === '-') zoomBy(-1);
  }

  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  if (view && size) {
    const n = 2 ** view.zoom;
    const left = view.x - size.w / 2;
    const top = view.y - size.h / 2;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${view.zoom}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${view.zoom}/${wx}/${ty}.png`, left: tx * TILE - left, top: ty * TILE - top });
      }
    }
  }
  const at = (p: LatLon) => {
    const q = project(p, view!.zoom);
    return { left: q.x - view!.x + size!.w / 2, top: q.y - view!.y + size!.h / 2 };
  };
  const drawn = [...pins].sort((a, b) => Number(!!b.quiet) - Number(!!a.quiet) || Number(!!a.selected) - Number(!!b.selected));
  const centre = view ? unproject(view.x, view.y, view.zoom) : null;

  return (
    <div style={{ position: 'relative', height, minHeight: '14rem', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#e5e7eb' }}>
      <div
        ref={box}
        role="application"
        aria-label={`${label}. Drag or use the arrow keys to move, plus and minus to zoom.`}
        aria-roledescription="map"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={keys}
        data-zoom={view?.zoom}
        data-centre={centre ? `${centre.lat.toFixed(4)},${centre.lon.toFixed(4)}` : undefined}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: grabbing ? 'grabbing' : 'grab', outlineOffset: '-3px', userSelect: 'none' }}
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={t.src} alt="" draggable={false} width={TILE} height={TILE} style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE, maxWidth: 'none', pointerEvents: 'none' }} />
        ))}
        {view &&
          size &&
          spread(drawn.map((p) => ({ p, ...at(p) }))).map(({ p, left, top }) => {
            if (left < -20 || top < -20 || left > size.w + 20 || top > size.h + 20) return null;
            const r = p.selected ? 11 : p.quiet ? 6 : 8;
            return (
              <button
                key={p.id}
                type="button"
                aria-label={p.label}
                aria-pressed={onPick ? !!p.selected : undefined}
                title={p.label}
                data-pin={p.id}
                onClick={() => {
                  if (!dragged.current) onPick?.(p.id);
                }}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: r * 2 + 8,
                  height: r * 2 + 8,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
                  background: 'transparent',
                  cursor: onPick ? 'pointer' : 'default',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: r * 2,
                    height: r * 2,
                    borderRadius: '50%',
                    background: p.colour,
                    border: `${p.selected ? 3 : 2}px solid #ffffff`,
                    boxShadow: p.selected ? '0 0 0 3px #0f172a, 0 4px 10px rgba(15,23,42,0.35)' : '0 2px 5px rgba(15,23,42,0.35)',
                    opacity: p.quiet ? 0.75 : 1,
                  }}
                />
              </button>
            );
          })}
      </div>

      <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', display: 'grid', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,23,42,0.18)', border: '1px solid #e2e8f0' }}>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)} style={{ ...CONTROL, borderBottom: '1px solid #e2e8f0' }}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)} style={{ ...CONTROL, borderBottom: '1px solid #e2e8f0' }}>
          −
        </button>
        <button type="button" aria-label="Show every pin" onClick={fit} style={{ ...CONTROL, fontSize: '1.05rem' }}>
          ⤢
        </button>
      </div>

      <div style={{ position: 'absolute', right: 0, bottom: 0, padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.85)', fontSize: '0.68rem', color: '#334155', borderTopLeftRadius: '0.4rem' }}>
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{ color: '#334155' }}>
          OpenStreetMap
        </a>
      </div>
    </div>
  );
}
