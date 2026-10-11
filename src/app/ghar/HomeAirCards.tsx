'use client';

// Ghar ki Hawa's cards, in Kisan Saathi's look: a pale wash in the air's colour, one big number people can
// read across the room, and the reason in plain words. The air outside and the whole home on "Air now",
// one card per room on "Rooms". Every number comes from the indoor model's estimate (packages/aqi/indoor.ts)
// and homeAir.ts; nothing here is a fixed label.
import React from 'react';

import type { IndoorEstimate, IndoorRequest } from '../../../packages/aqi/indoor';
import { CATEGORY_COLOURS, CATEGORY_NAMES } from '../shala/airQuality';
import { aqiText, cleanestAndWorst, pm25Aqi, roomSources, sourcesNow, volumeOf, wholeHome, type AqiFromPm25, type Category, type SourceKey } from './homeAir';
import type { RoomState } from './homeState';

type Lang = 'pa' | 'hi' | 'en';
type Words = Record<Lang, string>;

const W = {
  outside: { en: 'Outside right now', hi: 'अभी बाहर', pa: 'ਹੁਣ ਬਾਹਰ' },
  home: { en: 'Inside your home', hi: 'आपके घर के अंदर', pa: 'ਤੁਹਾਡੇ ਘਰ ਅੰਦਰ' },
  worstAt: { en: 'Worst in the next 12 hours', hi: 'अगले 12 घंटों में सबसे ख़राब', pa: 'ਅਗਲੇ 12 ਘੰਟਿਆਂ ਵਿੱਚ ਸਭ ਤੋਂ ਮਾੜੀ' },
  cleanestAt: { en: 'Cleanest', hi: 'सबसे साफ़', pa: 'ਸਭ ਤੋਂ ਸਾਫ਼' },
  worstRoom: { en: 'Worst room', hi: 'सबसे ख़राब कमरा', pa: 'ਸਭ ਤੋਂ ਮਾੜਾ ਕਮਰਾ' },
  cleanestRoom: { en: 'Cleanest room', hi: 'सबसे साफ़ कमरा', pa: 'ਸਭ ਤੋਂ ਸਾਫ਼ ਕਮਰਾ' },
  review: { en: 'See every room', hi: 'हर कमरा देखें', pa: 'ਹਰ ਕਮਰਾ ਵੇਖੋ' },
  adjust: { en: 'Change this room', hi: 'यह कमरा बदलें', pa: 'ਇਹ ਕਮਰਾ ਬਦਲੋ' },
  burningNow: { en: 'Burning now', hi: 'अभी जल रहा है', pa: 'ਹੁਣ ਬਲ ਰਿਹਾ ਹੈ' },
  noRooms: { en: 'Add a room to see the air inside.', hi: 'अंदर की हवा देखने के लिए कमरा जोड़ें।', pa: 'ਅੰਦਰ ਦੀ ਹਵਾ ਵੇਖਣ ਲਈ ਕਮਰਾ ਜੋੜੋ।' },
  how: { en: 'How is this worked out?', hi: 'यह कैसे निकाला गया?', pa: 'ਇਹ ਕਿਵੇਂ ਕੱਢਿਆ ਗਿਆ?' },
  windowsOpen: { en: 'windows open', hi: 'खिड़कियाँ खुली', pa: 'ਖਿੜਕੀਆਂ ਖੁੱਲ੍ਹੀਆਂ' },
  windowsShut: { en: 'windows shut', hi: 'खिड़कियाँ बंद', pa: 'ਖਿੜਕੀਆਂ ਬੰਦ' },
  purifier: { en: 'purifier', hi: 'प्यूरीफ़ायर', pa: 'ਪਿਊਰੀਫ਼ਾਇਰ' },
  window: { en: 'window', hi: 'खिड़की', pa: 'ਖਿੜਕੀ' },
  windows: { en: 'windows', hi: 'खिड़कियाँ', pa: 'ਖਿੜਕੀਆਂ' },
} satisfies Record<string, Words>;

const SOURCE: Record<SourceKey, { icon: string; name: Words }> = {
  cooking: { icon: '🍳', name: { en: 'Cooking', hi: 'खाना पकाना', pa: 'ਖਾਣਾ ਪਕਾਉਣਾ' } },
  smoking: { icon: '🚬', name: { en: 'Smoking indoors', hi: 'घर में धूम्रपान', pa: 'ਘਰ ਵਿੱਚ ਸਿਗਰਟਨੋਸ਼ੀ' } },
  incense: { icon: '🪔', name: { en: 'Incense or dhoop', hi: 'अगरबत्ती या धूप', pa: 'ਅਗਰਬੱਤੀ ਜਾਂ ਧੂਪ' } },
  mosquito_coil: { icon: '🦟', name: { en: 'Mosquito coil', hi: 'मच्छर कॉइल', pa: 'ਮੱਛਰ ਕੁਆਇਲ' } },
};

export function roomIcon(id: string) {
  return id.includes('kitchen') ? '🍳' : id.includes('bedroom') ? '🛏️' : id.includes('living') ? '🛋️' : '🚪';
}

const clock = (iso: string) => iso.slice(11, 16);

function AqiPill({ a, lang }: { a: AqiFromPm25; lang: Lang }) {
  const c = CATEGORY_COLOURS[a.category];
  return (
    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: c.ink, background: '#ffffff', border: `1px solid ${c.edge}`, borderRadius: '9999px', padding: '0.15rem 0.65rem', whiteSpace: 'nowrap' }}>
      {CATEGORY_NAMES[a.category][lang]}
    </span>
  );
}

/** AQI in big type, with the PM2.5 it comes from. */
function BigAqi({ pm25, a, size = '3.25rem' }: { pm25: number; a: AqiFromPm25; size?: string }) {
  const c = CATEGORY_COLOURS[a.category];
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: c.ink }}>AQI</span>
      <span data-aqi={aqiText(a)} style={{ fontSize: size, fontWeight: 900, lineHeight: 1, color: c.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {aqiText(a)}
      </span>
      <span style={{ fontSize: '0.85rem', color: '#475569' }}>
        PM2.5 <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(pm25)}</strong> µg/m³
      </span>
    </div>
  );
}

const card = (a: AqiFromPm25 | null): React.CSSProperties => ({
  background: a ? CATEGORY_COLOURS[a.category].tint : '#ffffff',
  border: `1px solid ${a ? CATEGORY_COLOURS[a.category].edge : '#e2e8f0'}`,
  borderRadius: '1.25rem',
  padding: 'clamp(1rem, 4vw, 1.35rem)',
  display: 'grid',
  gap: '0.75rem',
  minWidth: 0,
});

const heading: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#475569' };

/** The station's overall AQI, as the app header shows it, when it has one. */
export interface StationAir {
  aqi: number;
  category: string;
  dominant: string | null;
}

const CATEGORIES: Category[] = ['good', 'satisfactory', 'moderate', 'poor', 'very_poor', 'severe'];

export function OutsideCard({ estimate, live, lang, loading }: { estimate?: IndoorEstimate; live?: StationAir; lang: Lang; loading: string }) {
  if (!estimate) {
    return (
      <section style={card(null)}>
        <h2 style={heading}>☁️ {W.outside[lang]}</h2>
        <p style={{ margin: 0, color: '#64748b' }}>{loading}</p>
      </section>
    );
  }
  const now = estimate.outdoor_pm25_now_ug_m3;
  // Now: the station's overall AQI, the same number as the header (it can be led by PM10 or a gas). The
  // hours ahead come from the PM2.5 model.
  const stationCategory = live && CATEGORIES.includes(live.category as Category) ? (live.category as Category) : null;
  const a: AqiFromPm25 = live && stationCategory ? { aqi: Math.round(live.aqi), aboveScale: false, category: stationCategory } : pm25Aqi(now);
  const next12 = estimate.hourly_series.slice(0, 12);
  const worst = next12.reduce((w, h) => (h.outdoor_pm25_ug_m3 > w.outdoor_pm25_ug_m3 ? h : w), next12[0]);
  const best = next12.reduce((b, h) => (h.outdoor_pm25_ug_m3 < b.outdoor_pm25_ug_m3 ? h : b), next12[0]);
  return (
    <section aria-labelledby="ghar-outside" style={card(a)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 id="ghar-outside" style={heading}>☁️ {W.outside[lang]}</h2>
        <AqiPill a={a} lang={lang} />
      </div>
      <BigAqi pm25={now} a={a} />
      {worst && best && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
          {[
            [W.worstAt[lang], worst, '↗'] as const,
            [W.cleanestAt[lang], best, '↘'] as const,
          ].map(([name, h, arrow]) => (
            <div key={name} style={{ background: '#ffffff', borderRadius: '0.9rem', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{name}</div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {arrow} {clock(h.time)} · PM2.5 {Math.round(h.outdoor_pm25_ug_m3)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export interface RoomNow {
  room: RoomState;
  estimate?: IndoorEstimate;
}

export function HomeCard({ rooms, lang, loading, onRooms, now }: { rooms: RoomNow[]; lang: Lang; loading: string; onRooms: () => void; now: number }) {
  const ready = rooms.filter((r): r is Required<RoomNow> => !!r.estimate).map((r) => ({ ...r, pm25: r.estimate.indoor_pm25_now_ug_m3, volumeM3: volumeOf(r.room.request) }));
  const home = wholeHome(ready);
  const a = home !== undefined ? pm25Aqi(home) : null;
  const { cleanest, worst } = cleanestAndWorst(ready);
  const burning = worst ? sourcesNow(worst.room.request, now) : [];
  return (
    <section aria-labelledby="ghar-home" style={card(a)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 id="ghar-home" style={heading}>🏠 {W.home[lang]}</h2>
        {a && <AqiPill a={a} lang={lang} />}
      </div>
      {!rooms.length && <p style={{ margin: 0, color: '#475569' }}>{W.noRooms[lang]}</p>}
      {rooms.length > 0 && home === undefined && <p style={{ margin: 0, color: '#64748b' }}>{loading}</p>}
      {home !== undefined && a && <BigAqi pm25={home} a={a} />}

      {worst && cleanest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr))', gap: '0.5rem' }}>
          {[
            [W.worstRoom[lang], worst] as const,
            [W.cleanestRoom[lang], cleanest] as const,
          ].map(([name, r]) => (
            <div key={name} style={{ background: '#ffffff', borderRadius: '0.9rem', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{name}</div>
              <div style={{ fontWeight: 800, color: '#0f172a', overflowWrap: 'anywhere' }}>
                {roomIcon(r.room.id)} {r.room.name} · AQI {aqiText(pm25Aqi(r.pm25))}
              </div>
            </div>
          ))}
        </div>
      )}
      {worst && burning.length > 0 && (
        <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
          {SOURCE[burning[0]].icon} <strong>{W.burningNow[lang]}:</strong> {burning.map((s) => SOURCE[s].name[lang]).join(', ')} ({worst.room.name})
        </p>
      )}

      <button
        type="button"
        onClick={onRooms}
        style={{ justifySelf: 'start', minHeight: '2.75rem', padding: '0 1.1rem', borderRadius: '9999px', border: '1.5px solid #0d9488', background: '#ffffff', color: '#0f766e', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {W.review[lang]} →
      </button>

      <details style={{ fontSize: '0.85rem', color: '#475569' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#0f766e' }}>{W.how[lang]}</summary>
        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem', lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>
            Each room&apos;s PM2.5 comes from a mass-balance model of that room: outside air leaking in, smoke from cooking, coils or
            incense, and what settles or a purifier removes. The home&apos;s figure weights every room by the air it holds:
          </p>
          <code style={{ display: 'block', background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.5rem 0.65rem', borderRadius: '0.6rem', color: '#0f172a', overflowX: 'auto' }}>
            home PM2.5 = Σ (room PM2.5 × room volume) ÷ Σ room volume
          </code>
          {ready.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
              {ready.map((r) => (
                <li key={r.room.id}>
                  {r.room.name}: {Math.round(r.pm25)} µg/m³ × {Math.round(r.volumeM3)} m³
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: 0 }}>
            That PM2.5 then goes on CPCB&apos;s AQI scale, the same one used outdoors. The scale stops at 500: anything above 380 µg/m³ shows
            as 500+.
          </p>
        </div>
      </details>
    </section>
  );
}

function details(req: IndoorRequest, lang: Lang) {
  const parts = [`${Math.round(req.room_area_m2)} m²`, `${req.windows} ${req.windows === 1 ? W.window[lang] : W.windows[lang]}`];
  if (req.windows > 0) parts.push(req.windows_open ? W.windowsOpen[lang] : W.windowsShut[lang]);
  if (req.purifier_cadr_m3_h > 0) parts.push(W.purifier[lang]);
  return parts.join(' · ');
}

export function RoomSummary({ room, estimate, lang, loading, onOpen, now }: { room: RoomState; estimate?: IndoorEstimate; lang: Lang; loading: string; onOpen: () => void; now: number }) {
  const pm25 = estimate?.indoor_pm25_now_ug_m3;
  const a = pm25 !== undefined ? pm25Aqi(pm25) : null;
  const burning = sourcesNow(room.request, now);
  const sources = roomSources(room.request);
  // What to do first: the model's advice about this room's worst source if it has one, else its first step.
  const tip =
    estimate?.plan.find((p) => p.kind === 'source' && p.key === `source_${burning[0] ?? sources[0]}`) ??
    estimate?.plan.find((p) => p.kind === 'source') ??
    estimate?.plan[0];
  return (
    <article aria-labelledby={`room-${room.id}`} data-room={room.id} style={card(a)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'center' }}>
        <span aria-hidden="true" style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.9rem', background: '#ffffff', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}>
          {roomIcon(room.id)}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 id={`room-${room.id}`} style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', overflowWrap: 'anywhere' }}>
            {room.name}
          </h3>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{details(room.request, lang)}</div>
        </div>
        {a && <AqiPill a={a} lang={lang} />}
      </div>

      {pm25 !== undefined && a ? <BigAqi pm25={pm25} a={a} size="2.6rem" /> : <p style={{ margin: 0, color: '#64748b' }}>{loading}</p>}

      {sources.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {sources.map((s) => {
            const on = burning.includes(s);
            return (
              <li
                key={s}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: on ? 800 : 600,
                  color: on ? '#b91c1c' : '#475569',
                  background: on ? '#fef2f2' : '#ffffff',
                  border: `1px solid ${on ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: '9999px',
                  padding: '0.2rem 0.6rem',
                }}
              >
                {SOURCE[s].icon} {SOURCE[s].name[lang]}
                {on ? ` · ${W.burningNow[lang].toLowerCase()}` : ''}
              </li>
            );
          })}
        </ul>
      )}

      {tip && (
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.45, color: '#334155', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.9rem', padding: '0.65rem 0.8rem' }}>
          💡 {tip.text}
        </p>
      )}

      <button
        type="button"
        onClick={onOpen}
        style={{ minHeight: '2.75rem', borderRadius: '0.9rem', border: '1.5px solid #0d9488', background: '#ffffff', color: '#0f766e', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        ⚙️ {W.adjust[lang]}
      </button>
    </article>
  );
}
