'use client';

// The top of Kisan Saathi, Saans Shala and Ghar ki Hawa, after Blinkit's: the part of the app in big
// type on a wash of its colour, the bell and your account on the right, and the air right now in a
// wide pill where Blinkit has its search bar.
import React, { useCallback, useEffect, useState } from 'react';

import { getAqi, type AqiData } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { PERSONA_WORDS, SPACES, session, word, type SpaceId } from '../lib/space';
import { NotificationCenter } from './NotificationCenter';
import { SpaceSheet } from './SpaceSwitch';

// Where the reading comes from until the phone has already shared its location (the shell's default).
const DEFAULT_LAT = 28.73;
const DEFAULT_LON = 77.12;

const CATEGORY_COLOUR: Record<AqiData['category'], string> = {
  Good: '#16a34a',
  Satisfactory: '#65a30d',
  Moderate: '#ca8a04',
  Poor: '#ea580c',
  'Very Poor': '#dc2626',
  Severe: '#7f1d1d',
};

/** The nearest reading, every 2 minutes. Uses the phone's location only if it was already allowed. */
function useAirNow() {
  const [air, setAir] = useState<AqiData | null>(null);
  useEffect(() => {
    let live = true;
    let at = { lat: DEFAULT_LAT, lon: DEFAULT_LON };
    const load = () =>
      getAqi(at.lat, at.lon)
        .then((d) => live && setAir(d))
        .catch(() => undefined);
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    (perms ? perms.query({ name: 'geolocation' }).catch(() => null) : Promise.resolve(null)).then((p) => {
      if (!live) return;
      if (p?.state !== 'granted') return void load();
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          at = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          void load();
        },
        () => void load(),
        { timeout: 3000 },
      );
    });
    const timer = setInterval(() => void load(), 120_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return air;
}

const ROUND: React.CSSProperties = {
  width: '2.75rem',
  height: '2.75rem',
  borderRadius: '50%',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  background: '#ffffff',
  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.1)',
  display: 'grid',
  placeItems: 'center',
  fontSize: '1.25rem',
  cursor: 'pointer',
  position: 'relative',
  padding: 0,
  flex: 'none',
};

export function AppHeader({ space }: { space: SpaceId }) {
  const { language } = useLanguage();
  const s = SPACES[space];
  const me = session.use();
  const air = useAirNow();
  const [bell, setBell] = useState(false);
  const [unread, setUnread] = useState(2);
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);

  return (
    <>
      <header
        style={{
          background: `linear-gradient(180deg, ${s.wash} 0%, color-mix(in srgb, ${s.wash} 55%, #ffffff) 70%, #f8fafc 100%)`,
          padding: 'calc(0.9rem + env(safe-area-inset-top, 0px)) clamp(1rem, 4vw, 1.5rem) 1rem',
        }}
      >
        <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span aria-hidden="true">🌱</span> Saans
              </div>
              <h1
                id="saans-space-title"
                style={{ margin: '0.1rem 0 0', fontSize: 'clamp(1.85rem, 8vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05, color: '#0f172a', textWrap: 'balance' }}
              >
                {s.name[language]}
              </h1>
              <div style={{ marginTop: '0.3rem', fontSize: '0.95rem', color: '#334155', fontWeight: 500 }}>{s.forWhom[language]}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => setBell(true)} aria-label={word('notifications', language)} style={ROUND}>
                🔔
                {unread > 0 && (
                  <span
                    aria-hidden="true"
                    style={{ position: 'absolute', top: '-0.2rem', right: '-0.2rem', minWidth: '1.1rem', height: '1.1rem', borderRadius: '9999px', background: '#dc2626', color: '#ffffff', fontSize: '0.65rem', fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid #ffffff' }}
                  >
                    {unread}
                  </span>
                )}
              </button>
              <button
                type="button"
                id="saans-account"
                onClick={() => setSheet(true)}
                aria-haspopup="dialog"
                aria-label={`${word('account', language)}: ${me ? `${word('guest', language)}, ${PERSONA_WORDS[me.persona].short[language]}` : word('notSignedIn', language)}`}
                style={{ ...ROUND, background: '#0f172a', color: '#ffffff', border: '2px solid #ffffff' }}
              >
                {me ? PERSONA_WORDS[me.persona].icon : '👤'}
              </button>
            </div>
          </div>

          <AirPill air={air} language={language} />
        </div>
      </header>

      <NotificationCenter isOpen={bell} onClose={() => setBell(false)} onCountChange={setUnread} />
      {sheet && <SpaceSheet current={space} onClose={closeSheet} />}
    </>
  );
}

function AirPill({ air, language }: { air: AqiData | null; language: ReturnType<typeof useLanguage>['language'] }) {
  const colour = air ? CATEGORY_COLOUR[air.category] ?? '#475569' : '#94a3b8';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        minHeight: '3.25rem',
        padding: '0.5rem 1rem',
        borderRadius: '1.25rem',
        background: '#ffffff',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
        boxSizing: 'border-box',
      }}
    >
      <span aria-hidden="true" style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: colour, flex: 'none', boxShadow: `0 0 0 4px color-mix(in srgb, ${colour} 20%, transparent)` }} />
      {air ? (
        <div style={{ minWidth: 0, flex: 1, display: 'grid' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{word('airNow', language)}</span>
            <strong style={{ fontSize: '1.05rem', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>AQI {Math.round(air.aqi)}</strong>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: colour }}>{air.category}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {air.station_name}
            {air.dominant_pollutant ? ` · ${air.dominant_pollutant.toUpperCase()}` : ''}
          </div>
        </div>
      ) : (
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{word('airNow', language)} …</span>
      )}
    </div>
  );
}
