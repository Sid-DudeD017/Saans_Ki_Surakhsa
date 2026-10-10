'use client';

// The first screens of the app, after Blinkit's: sign in (as a guest, for now), then say who you are.
// A farmer gets Kisan Saathi, a student or principal Saans Shala, and someone checking their home Ghar
// ki Hawa. The step is in the URL (/welcome?tab=who) so the back button returns to sign-in.
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useUrlTab } from '../../components/BottomTabs';
import { LanguageSwitcher } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import { PERSONAS, PERSONA_ROLE, PERSONA_SPACE, PERSONA_WORDS, SPACES, session, word, type Persona } from '../../lib/space';

const STEPS = ['login', 'who'] as const;

const SUNRISE = 'linear-gradient(170deg, #fff4cc 0%, #e8f8ee 50%, #e0f2fe 100%)';
const INK = '#0f172a';
const GO = '#15803d';

const KEYFRAMES = `
@keyframes saans-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .saans-rise { animation: none !important; } }
`;

export default function Welcome() {
  const [step, go] = useUrlTab(STEPS);
  const { language, setLanguage } = useLanguage();

  return (
    <div style={{ minHeight: '100vh', background: SUNRISE, display: 'flex', flexDirection: 'column' }}>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          width: '100%',
          maxWidth: '30rem',
          margin: '0 auto',
          boxSizing: 'border-box',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1.25rem + env(safe-area-inset-bottom, 0px))',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: step === 'who' ? 'space-between' : 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
          {step === 'who' && (
            <button
              type="button"
              onClick={() => go('login')}
              style={{ border: 'none', background: 'rgba(255,255,255,0.7)', borderRadius: '9999px', padding: '0 0.9rem', minHeight: '2.5rem', display: 'inline-flex', alignItems: 'center', fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ← {word('back', language)}
            </button>
          )}
          <LanguageSwitcher currentLang={language} onLanguageChange={setLanguage} size="md" />
        </div>

        {step === 'login' ? <SignIn onGuest={() => go('who')} /> : <WhoAreYou />}
      </div>
    </div>
  );
}

function SignIn({ onGuest }: { onGuest: () => void }) {
  const { language } = useLanguage();
  return (
    <>
      <div className="saans-rise" style={{ flex: 1, display: 'grid', alignContent: 'center', justifyItems: 'center', textAlign: 'center', gap: '0.75rem', animation: 'saans-rise 400ms ease-out' }}>
        <span aria-hidden="true" style={{ width: '5.5rem', height: '5.5rem', borderRadius: '50%', background: '#ffffff', display: 'grid', placeItems: 'center', fontSize: '3rem', boxShadow: '0 10px 30px rgba(21, 128, 61, 0.2)' }}>
          🌱
        </span>
        <h1 style={{ margin: 0, fontSize: 'clamp(3rem, 16vw, 4rem)', fontWeight: 900, letterSpacing: '-0.04em', color: INK, lineHeight: 1 }}>Saans</h1>
        <p style={{ margin: 0, fontSize: '1.1rem', color: '#334155', maxWidth: '18rem', lineHeight: 1.4, textWrap: 'balance' }}>{word('tagline', language)}</p>
        <div aria-hidden="true" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          {(['kisan', 'shala', 'ghar'] as const).map((id) => (
            <span key={id} style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: SPACES[id].wash, display: 'grid', placeItems: 'center', fontSize: '1.75rem', boxShadow: '0 4px 10px rgba(15,23,42,0.08)' }}>
              {SPACES[id].icon}
            </span>
          ))}
        </div>
      </div>

      <section
        aria-labelledby="saans-login"
        style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '1.25rem', display: 'grid', gap: '0.75rem', boxShadow: '0 -4px 30px rgba(15, 23, 42, 0.08)' }}
      >
        <h2 id="saans-login" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: INK, textAlign: 'center' }}>
          {word('loginTitle', language)}
        </h2>
        <button
          type="button"
          disabled
          style={{ minHeight: '3.25rem', borderRadius: '1rem', border: '1.5px dashed #cbd5e1', background: '#f8fafc', color: '#64748b', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', fontFamily: 'inherit', cursor: 'not-allowed' }}
        >
          📱 {word('phone', language)}
          <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#e2e8f0', color: '#475569', borderRadius: '9999px', padding: '0.15rem 0.5rem' }}>{word('soon', language)}</span>
        </button>
        <button
          type="button"
          id="saans-guest"
          onClick={onGuest}
          style={{ minHeight: '3.5rem', borderRadius: '1rem', border: 'none', background: GO, color: '#ffffff', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 16px rgba(21, 128, 61, 0.35)', fontFamily: 'inherit' }}
        >
          {word('guestGo', language)} →
        </button>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', textAlign: 'center', textWrap: 'balance' }}>{word('guestNote', language)}</p>
      </section>
    </>
  );
}

// A tall farmer card beside two school cards, and the home card along the bottom, like Blinkit's grid.
const AREA: Record<Persona, string> = { farmer: 'farmer', student: 'student', principal: 'principal', home: 'home' };

function WhoAreYou() {
  const { language } = useLanguage();
  const { setRole } = useAuth();
  const router = useRouter();

  function choose(p: Persona) {
    session.signInAsGuest(p);
    setRole(PERSONA_ROLE[p]);
    router.replace(SPACES[PERSONA_SPACE[p]].href);
  }

  return (
    <div className="saans-rise" style={{ display: 'grid', gap: '1rem', animation: 'saans-rise 300ms ease-out' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 9vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: INK }}>{word('whoTitle', language)}</h1>
        <p style={{ margin: '0.4rem 0 0', color: '#334155', fontSize: '1rem', lineHeight: 1.45 }}>{word('whoIntro', language)}</p>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          // Equal rows, so the two school cards together are exactly as tall as the farmer card.
          gridTemplateRows: 'minmax(8.5rem, 1fr) minmax(8.5rem, 1fr) auto',
          gridTemplateAreas: '"farmer student" "farmer principal" "home home"',
          gap: '0.75rem',
        }}
      >
        {PERSONAS.map((p) => {
          const space = SPACES[PERSONA_SPACE[p]];
          const tall = p === 'farmer';
          const wide = p === 'home';
          const title = (
            <span style={{ fontWeight: 900, fontSize: tall ? 'clamp(1.1rem, 5.5vw, 1.3rem)' : '1.05rem', lineHeight: 1.2, textWrap: 'balance' }}>{PERSONA_WORDS[p].title[language]}</span>
          );
          const icon = (
            <span aria-hidden="true" style={{ fontSize: tall ? '5rem' : wide ? '3rem' : '2.6rem', lineHeight: 1 }}>
              {PERSONA_WORDS[p].icon}
            </span>
          );
          const chip = (
            <span
              style={{
                fontSize: 'clamp(0.72rem, 3.6vw, 0.8rem)',
                fontWeight: 800,
                color: `color-mix(in srgb, ${space.accent} 85%, #000000)`,
                background: '#ffffffcc',
                borderRadius: '9999px',
                padding: '0.25rem 0.55rem',
                display: 'inline-flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0 0.25rem',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {space.name[language]}&nbsp;→
            </span>
          );
          return (
            <li key={p} style={{ gridArea: AREA[p], display: 'grid' }}>
              <button
                type="button"
                id={`saans-who-${p}`}
                onClick={() => choose(p)}
                style={{
                  minWidth: 0,
                  border: '2px solid rgba(255,255,255,0.9)',
                  borderRadius: '1.5rem',
                  background: `linear-gradient(180deg, #ffffff 0%, ${space.wash} 100%)`,
                  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.1)',
                  padding: 'clamp(0.75rem, 3.5vw, 1rem)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: INK,
                  // Tall and small cards: name at the top, picture in the middle, where it goes at the
                  // bottom. The wide card: picture on the left, name and where it goes beside it.
                  display: 'grid',
                  ...(wide
                    ? { gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', justifyItems: 'start', columnGap: '1rem', textAlign: 'left' as const }
                    : { gridTemplateRows: 'auto 1fr auto', alignItems: 'center', justifyItems: 'center', rowGap: '0.5rem', textAlign: 'center' as const }),
                }}
              >
                {wide ? (
                  <>
                    {icon}
                    <span style={{ display: 'grid', justifyItems: 'start', gap: '0.5rem' }}>
                      {title}
                      {chip}
                    </span>
                  </>
                ) : (
                  <>
                    {title}
                    {icon}
                    {chip}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href="/command"
        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(15,23,42,0.08)', color: '#334155', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}
      >
        <span aria-hidden="true">🛡️</span>
        <span style={{ flex: 1, minWidth: 0 }}>{word('official', language)}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
