// The console's map (P4): OpenStreetMap tiles with the cases, or one case with the farm whose help request
// it links to and the CHC that can send a machine. Zoomed to fit; projection helpers are P2's (redZone.ts).
import React, { useState, useEffect, useRef } from 'react';

import { TILE, project, tilesAround, type LatLon } from '../shala/redZone';

export interface MapPoint extends LatLon {
  id: string;
  label: string;
  kind: 'report' | 'help' | 'farm' | 'chc' | 'closed' | 'fire';
  selected?: boolean;
}

// The map on the page: wide rather than square, so it fills the column and sits centred in it.
const INLINE_W = 720;
const INLINE_H = 480;

const MODAL_W = 1000;
const MODAL_H = 650;
const MODAL_HALF_X = MODAL_W / 2;
const MODAL_HALF_Y = MODAL_H / 2;

const STYLE: Record<MapPoint['kind'], { fill: string; r: number }> = {
  report: { fill: '#dc2626', r: 7 },
  help: { fill: '#16a34a', r: 7 },
  farm: { fill: '#16a34a', r: 8 },
  chc: { fill: '#2563eb', r: 8 },
  closed: { fill: '#94a3b8', r: 6 },
  fire: { fill: '#f97316', r: 6 },
};

/** The largest zoom (5–15) at which every point fits inside the map, with a margin. */
export function fitZoom(points: LatLon[]): number {
  for (let z = 15; z > 5; z--) {
    const xs = points.map((p) => project(p, z));
    const w = Math.max(...xs.map((p) => p.x)) - Math.min(...xs.map((p) => p.x));
    const h = Math.max(...xs.map((p) => p.y)) - Math.min(...xs.map((p) => p.y));
    if (w <= INLINE_W - 80 && h <= INLINE_H - 80) return z;
  }
  return 5;
}

/** Inverse Web Mercator: converts world pixels back to { lat, lon } */
function unproject(px: { x: number; y: number }, zoom: number): LatLon {
  const scale = TILE * 2 ** zoom;
  const lon = (px.x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (px.y / scale);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return {
    lat: Math.max(-85, Math.min(85, lat)),
    lon: Math.max(-180, Math.min(180, lon)),
  };
}

export function CaseMap({
  points,
  onPick,
  title,
}: {
  points: MapPoint[];
  onPick?: (id: string) => void;
  title: string;
}) {
  const pointsKey = points.map((p) => `${p.id}-${p.lat.toFixed(4)}-${p.lon.toFixed(4)}`).join(';');
  const [prevKey, setPrevKey] = useState<string>(pointsKey);

  const defaultCentre = points.length > 0
    ? {
        lat: (Math.max(...points.map((p) => p.lat)) + Math.min(...points.map((p) => p.lat))) / 2,
        lon: (Math.max(...points.map((p) => p.lon)) + Math.min(...points.map((p) => p.lon))) / 2,
      }
    : { lat: 30.2, lon: 75.8 };
  const baseZoom = points.length > 0 ? fitZoom(points) : 9;

  const [currentZoom, setCurrentZoom] = useState<number>(baseZoom);
  const [centre, setCentre] = useState<LatLon>(defaultCentre);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; centrePx: { x: number; y: number } } | null>(null);

  // Sync zoom and centre if points collection changes
  if (pointsKey !== prevKey) {
    setPrevKey(pointsKey);
    setCurrentZoom(baseZoom);
    setCentre(defaultCentre);
  }

  if (!points.length) return null;

  // Pointer drag to pan map
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    const centrePx = project(centre, currentZoom);
    setDragStart({ x: e.clientX, y: e.clientY, centrePx });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const newCentrePx = {
      x: dragStart.centrePx.x - dx,
      y: dragStart.centrePx.y - dy,
    };
    setCentre(unproject(newCentrePx, currentZoom));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsDragging(false);
    setDragStart(null);
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const zoomIn = () => setCurrentZoom((z) => Math.min(18, z + 1));
  const zoomOut = () => setCurrentZoom((z) => Math.max(3, z - 1));
  const resetView = () => {
    setCurrentZoom(baseZoom);
    setCentre(defaultCentre);
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${centre.lat},${centre.lon}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${centre.lat}&mlon=${centre.lon}#map=${currentZoom}/${centre.lat}/${centre.lon}`;
  const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY || 'cb1_4grj_1_dbbc20a1247c6aa97594b98a';

  // Render SVG Map Content
  const renderSvgMap = (width: number, height: number, halfX: number, halfY: number) => {
    const c = project(centre, currentZoom);
    const at = (p: LatLon) => {
      const q = project(p, currentZoom);
      return { x: halfX + q.x - c.x, y: halfY + q.y - c.y };
    };
    const drawn = [...points].sort((a, b) => Number(!!a.selected) - Number(!!b.selected));
    const maxHalf = Math.max(halfX, halfY);

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          background: '#e2e8f0',
        }}
      >
        {tilesAround(centre, currentZoom, maxHalf).map((t) => (
          <image
            key={`${t.x}-${t.y}`}
            href={`https://basemaps.cartocdn.com/rastertiles/voyager/${t.z}/${t.x}/${t.y}.png?key=${cartoKey}`}
            x={halfX + t.left}
            y={halfY + t.top}
            width={TILE}
            height={TILE}
          />
        ))}
        {drawn.map((p) => {
          const { x, y } = at(p);
          const s = STYLE[p.kind];
          return (
            <g
              key={p.id}
              onClick={onPick ? (e) => { e.stopPropagation(); onPick(p.id); } : undefined}
              style={{ cursor: onPick ? 'pointer' : 'default' }}
            >
              <title>{p.label}</title>
              <circle
                cx={x}
                cy={y}
                r={s.r + (p.selected ? 6 : 3)}
                fill="#ffffff"
                stroke={p.selected ? '#0f172a' : '#334155'}
                strokeWidth={p.selected ? 2.5 : 1.5}
              />
              <circle cx={x} cy={y} r={s.r} fill={s.fill} />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <>
      <figure style={{ margin: '0 auto', width: '100%', maxWidth: INLINE_W, display: 'grid', gap: '0.6rem' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            borderRadius: '1rem',
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          }}
        >
          {renderSvgMap(INLINE_W, INLINE_H, INLINE_W / 2, INLINE_H / 2)}

          {/* Floating Map Controls (Top Right) */}
          <div
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              title="Expand whole map (Full Screen)"
              style={{
                padding: '0.35rem 0.55rem',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(4px)',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#0f172a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              ⛶ Expand
            </button>
            <div
              style={{
                display: 'flex',
                borderRadius: '0.375rem',
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <button
                type="button"
                onClick={zoomIn}
                title="Zoom in"
                style={{
                  width: '36px',
                  height: '36px',
                  border: 'none',
                  background: 'none',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: '1px solid #cbd5e1',
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={zoomOut}
                title="Zoom out"
                style={{
                  width: '36px',
                  height: '36px',
                  border: 'none',
                  background: 'none',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                −
              </button>
            </div>
          </div>

          {/* Quick reset pill */}
          {(currentZoom !== baseZoom || centre.lat !== defaultCentre.lat || centre.lon !== defaultCentre.lon) && (
            <button
              type="button"
              onClick={resetView}
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                left: '0.5rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              ↺ Reset view
            </button>
          )}
        </div>

        <figcaption
          style={{
            fontSize: '0.875rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#0284c7',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              ⛶ View Whole Map
            </button>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
            >
              ↗ Google Maps
            </a>
          </div>
        </figcaption>
      </figure>

      {/* FULLSCREEN / WHOLE MAP MODAL */}
      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded Map View"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setIsExpanded(false)}
        >
          <div
            style={{
              width: '95vw',
              maxWidth: '1100px',
              height: '88vh',
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                backgroundColor: '#f8fafc',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  🗺️ {title}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Pin: {centre.lat.toFixed(5)}, {centre.lon.toFixed(5)} · Zoom: {currentZoom}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#0369a1',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  ↗ Google Maps
                </a>
                <a
                  href={osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#475569',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  ↗ OpenStreetMap
                </a>
                <button
                  type="button"
                  onClick={resetView}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  ↺ Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Modal Map Viewport */}
            <div style={{ position: 'relative', flex: 1, width: '100%', overflow: 'hidden', background: '#e2e8f0' }}>
              {renderSvgMap(MODAL_W, MODAL_H, MODAL_HALF_X, MODAL_HALF_Y)}

              {/* Floating Zoom Buttons Inside Modal */}
              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  backgroundColor: '#ffffff',
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={zoomIn}
                  title="Zoom in"
                  style={{
                    width: '36px',
                    height: '36px',
                    border: 'none',
                    background: 'none',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #cbd5e1',
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={zoomOut}
                  title="Zoom out"
                  style={{
                    width: '36px',
                    height: '36px',
                    border: 'none',
                    background: 'none',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  −
                </button>
              </div>

              {/* Pan tip pill */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  left: '1rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                🖐️ Click and drag anywhere to pan · Use + and − to zoom
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
