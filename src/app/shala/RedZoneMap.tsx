'use client';

// The red-zone map (P2): the school and its 2 km ring on OpenStreetMap tiles, stations coloured by AQI
// category, fires (upwind ones marked), and the wind. Under it, the same stations and fires as a list for
// screen readers and slow phones. Tiles load straight from OpenStreetMap; without them the ring, points
// and wind still draw on a plain background.
import React from 'react';

import { getCategoryCode } from '../../../packages/aqi';
import { CATEGORY_COLOURS, CATEGORY_NAMES, type Category, type Language } from './airQuality';
import { RED_ZONE_KM, bearingDeg, compass, distanceKm, isUpwind, metresPerPixel, project, tilesAround, type LatLon } from './redZone';
import type { FirePoint } from './shalaApi';

const ZOOM = 14;
const HALF = 256;

type Words = Record<Language, string>;
const W = {
  title: { pa: 'ਰੈੱਡ ਜ਼ੋਨ: ਸਕੂਲ ਦੇ ਦੁਆਲੇ 2 ਕਿ.ਮੀ.', hi: 'रेड ज़ोन: स्कूल के आसपास 2 किमी', en: 'Red zone: 2 km around the school' },
  windFrom: { pa: 'ਹਵਾ ਆ ਰਹੀ ਹੈ', hi: 'हवा आ रही है', en: 'Wind from' },
  calm: { pa: 'ਹਵਾ ਸ਼ਾਂਤ ਹੈ', hi: 'हवा शांत है', en: 'Calm air' },
  stations: { pa: 'ਸਟੇਸ਼ਨ', hi: 'स्टेशन', en: 'Stations' },
  fires: { pa: 'ਅੱਗਾਂ (ਸੈਟੇਲਾਈਟ)', hi: 'आग (सैटेलाइट)', en: 'Fires (satellite)' },
  upwind: { pa: 'ਹਵਾ ਦੇ ਰੁਖ਼ ਉੱਤੇ: ਧੂੰਆਂ ਸਕੂਲ ਵੱਲ', hi: 'हवा के रुख़ पर: धुआँ स्कूल की ओर', en: 'Upwind: smoke blows toward the school' },
  downwind: { pa: 'ਧੂੰਆਂ ਸਕੂਲ ਵੱਲ ਨਹੀਂ', hi: 'धुआँ स्कूल की ओर नहीं', en: 'Smoke blows away from the school' },
  inZone: { pa: 'ਰੈੱਡ ਜ਼ੋਨ ਦੇ ਅੰਦਰ', hi: 'रेड ज़ोन के अंदर', en: 'inside the red zone' },
  away: { pa: 'ਦੂਰ', hi: 'दूर', en: 'away' },
  demo: { pa: 'ਉਦਾਹਰਨ ਸਟੇਸ਼ਨ ਅਤੇ ਅੱਗਾਂ, ਅਸਲ ਨਹੀਂ', hi: 'उदाहरण स्टेशन और आग, असली नहीं', en: 'Example stations and fires, not real detections' },
  noStations: { pa: 'API ਵਿੱਚ ਹਾਲੇ ਸਟੇਸ਼ਨਾਂ ਦੀ ਸੂਚੀ ਨਹੀਂ', hi: 'API में अभी स्टेशनों की सूची नहीं है', en: 'The API has no station list yet' },
  noFires: {
    pa: 'ਪਿਛਲੇ ਸੈਟੇਲਾਈਟ ਗੇੜੇ ਤੋਂ 25 ਕਿਲੋਮੀਟਰ ਦੇ ਅੰਦਰ ਕੋਈ ਅੱਗ ਨਹੀਂ ਦਿਖੀ', // needs native-speaker review
    hi: 'अंतिम सैटेलाइट पास के बाद से 25 किमी के भीतर कोई आग नहीं देखी गई', // needs native-speaker review
    en: 'No fires seen within 25 km since the last satellite pass',
  },
  firesDown: {
    pa: 'ਅੱਗ ਦਾ ਡਾਟਾ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ', // needs native-speaker review
    hi: 'आग का डेटा अभी उपलब्ध नहीं है', // needs native-speaker review
    en: 'Fire data not available right now',
  },
  school: { pa: 'ਸਕੂਲ', hi: 'स्कूल', en: 'School' },
  confidence: { pa: 'ਭਰੋਸਾ', hi: 'भरोसा', en: 'confidence' },
} satisfies Record<string, Words>;

const DIRECTIONS: Record<string, Words> = {
  N: { pa: 'ਉੱਤਰ', hi: 'उत्तर', en: 'north' },
  NE: { pa: 'ਉੱਤਰ-ਪੂਰਬ', hi: 'उत्तर-पूर्व', en: 'north-east' },
  E: { pa: 'ਪੂਰਬ', hi: 'पूर्व', en: 'east' },
  SE: { pa: 'ਦੱਖਣ-ਪੂਰਬ', hi: 'दक्षिण-पूर्व', en: 'south-east' },
  S: { pa: 'ਦੱਖਣ', hi: 'दक्षिण', en: 'south' },
  SW: { pa: 'ਦੱਖਣ-ਪੱਛਮ', hi: 'दक्षिण-पश्चिम', en: 'south-west' },
  W: { pa: 'ਪੱਛਮ', hi: 'पश्चिम', en: 'west' },
  NW: { pa: 'ਉੱਤਰ-ਪੱਛਮ', hi: 'उत्तर-पश्चिम', en: 'north-west' },
};

export interface MapStation {
  name: string;
  lat: number;
  lon: number;
  aqi: number;
}

export interface RedZoneProps {
  school: LatLon & { name: string };
  wind: { speed_kmh: number; direction_deg: number };
  fires: FirePoint[];
  /** null when there is no station list to show (live mode, for now). */
  stations: MapStation[] | null;
  language: Language;
  demo: boolean;
  /** Why the fires couldn't be loaded, when they couldn't. */
  firesUnavailable?: string;
}

/** Fires with their distance, direction and whether they're upwind; upwind first, then nearest. */
export function placeFires(school: LatLon, fires: FirePoint[], wind: RedZoneProps['wind']) {
  return fires
    .map((f) => ({
      fire: f,
      km: distanceKm(school, f),
      bearing: bearingDeg(school, f),
      upwind: isUpwind(school, f, wind.direction_deg, wind.speed_kmh),
    }))
    .sort((a, b) => Number(b.upwind) - Number(a.upwind) || a.km - b.km);
}

function km(n: number) {
  return n < 10 ? n.toFixed(1) : Math.round(n).toString();
}

export function RedZoneMap({ school, wind, fires, stations, language, demo, firesUnavailable }: RedZoneProps) {
  const centre = project(school, ZOOM);
  const at = (p: LatLon) => {
    const q = project(p, ZOOM);
    return { x: q.x - centre.x, y: q.y - centre.y };
  };
  const ringPx = (RED_ZONE_KM * 1000) / metresPerPixel(school.lat, ZOOM);
  const placed = placeFires(school, fires, wind);
  const calm = wind.speed_kmh < 1;
  const blowsTo = (wind.direction_deg + 180) % 360;
  const windWords = calm
    ? W.calm[language]
    : `${W.windFrom[language]}: ${DIRECTIONS[compass(wind.direction_deg)][language]}, ${Math.round(wind.speed_kmh)} km/h`;
  const inside = (p: { x: number; y: number }) => Math.abs(p.x) < HALF - 6 && Math.abs(p.y) < HALF - 6;

  return (
    <section aria-labelledby="red-zone-title" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 id="red-zone-title" style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
        {W.title[language]}
      </h3>
      <div style={{ position: 'relative', width: '100%', maxWidth: '32rem', aspectRatio: '1 / 1', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #cbd5e1', background: '#eef2f7' }}>
        <svg viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
          {tilesAround(school, ZOOM, HALF).map((t) => (
            <image key={`${t.x}-${t.y}`} href={`https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`} x={t.left} y={t.top} width={256} height={256} />
          ))}
          <circle r={ringPx} fill="rgba(220, 38, 38, 0.10)" stroke="#dc2626" strokeWidth={3} strokeDasharray="10 6" />
          {(stations ?? []).map((s) => {
            const p = at(s);
            const c = CATEGORY_COLOURS[getCategoryCode(s.aqi) as Category];
            return inside(p) ? (
              <g key={s.name} transform={`translate(${p.x} ${p.y})`}>
                <circle r={13} fill={c.fill} stroke="#1f2937" strokeWidth={2} />
                <text y={4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1f2937">{s.aqi}</text>
              </g>
            ) : null;
          })}
          {placed.map(({ fire, upwind, km: d }, i) => {
            const p = at(fire);
            if (inside(p)) {
              return (
                <g key={i} transform={`translate(${p.x} ${p.y})`}>
                  {upwind && <circle r={16} fill="none" stroke="#dc2626" strokeWidth={3} />}
                  <path d="M0 -11 C7 -3 8 4 0 10 C-8 4 -7 -3 0 -11 Z" fill={upwind ? '#dc2626' : '#f97316'} stroke="#7c2d12" strokeWidth={1.5} />
                </g>
              );
            }
            // Off the map: pin it to the edge in its direction, with its distance, upwind ones only.
            if (!upwind) return null;
            const k = (HALF - 24) / Math.max(Math.abs(p.x), Math.abs(p.y));
            return (
              <g key={i} transform={`translate(${p.x * k} ${p.y * k})`}>
                <circle r={18} fill="#ffffff" stroke="#dc2626" strokeWidth={3} />
                <path d="M0 -9 C6 -2 6 3 0 8 C-6 3 -6 -2 0 -9 Z" fill="#dc2626" transform="translate(0 -3)" />
                <text y={30} textAnchor="middle" fontSize={11} fontWeight={700} fill="#7f1d1d" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">{km(d)} km</text>
              </g>
            );
          })}
          <g>
            <rect x={-9} y={-9} width={18} height={18} rx={3} fill="#0369a1" stroke="#ffffff" strokeWidth={3} />
          </g>
          <g transform={`translate(${HALF - 46} ${-HALF + 46})`}>
            <circle r={34} fill="rgba(255,255,255,0.9)" stroke="#334155" strokeWidth={1.5} />
            <text y={-22} textAnchor="middle" fontSize={11} fontWeight={700} fill="#334155">N</text>
            {!calm && (
              <g transform={`rotate(${blowsTo})`}>
                <path d="M0 -20 L7 -6 L2 -6 L2 20 L-2 20 L-2 -6 L-7 -6 Z" fill="#0f172a" />
              </g>
            )}
          </g>
        </svg>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          style={{ position: 'absolute', right: 4, bottom: 4, fontSize: '0.65rem', background: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: 3, color: '#334155' }}
        >
          © OpenStreetMap contributors
        </a>
      </div>
      <div style={{ fontSize: '0.95rem', color: '#0f172a' }}>💨 {windWords}</div>
      {demo && <div style={{ fontSize: '0.8rem', color: '#92400e' }}>⚠ {W.demo[language]}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color: '#334155' }}>🔥 {W.fires[language]}</h4>
          {firesUnavailable ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#b45309' }}>{W.firesDown[language]} ({firesUnavailable})</p>
          ) : placed.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{W.noFires[language]}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem', fontSize: '0.9rem', color: '#1e293b' }}>
              {placed.map(({ fire, km: d, bearing, upwind }, i) => (
                <li key={i}>
                  <strong>{km(d)} km</strong> {DIRECTIONS[compass(bearing)][language]}
                  {d <= RED_ZONE_KM ? `, ${W.inZone[language]}` : ''} · {upwind ? <strong style={{ color: '#b91c1c' }}>{W.upwind[language]}</strong> : W.downwind[language]} · {W.confidence[language]}: {fire.confidence}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color: '#334155' }}>📡 {W.stations[language]}</h4>
          {stations === null ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{W.noStations[language]}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem', fontSize: '0.9rem', color: '#1e293b' }}>
              {stations.map((s) => (
                <li key={s.name}>
                  {s.name}: <strong>AQI {s.aqi}</strong> ({CATEGORY_NAMES[getCategoryCode(s.aqi) as Category][language]}) · {km(distanceKm(school, s))} km {W.away[language]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
