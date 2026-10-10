'use client';

// The round red button beside the bottom tab bar, and the sheet it opens: move between Kisan Saathi,
// Saans Shala and Ghar ki Hawa, change language, or sign out. The avatar in the header opens the same
// sheet.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useLanguage } from '../lib/i18n';
import { PERSONA_WORDS, SPACES, SPACE_IDS, session, word, type SpaceId } from '../lib/space';
import { LanguageSwitcher } from './ui';

export const SWITCH_RED = '#e23744';

const SHEET_KEYFRAMES = `
@keyframes saans-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes saans-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .saans-sheet, .saans-sheet-backdrop { animation: none !important; } }
`;

export function SpaceSheet({ current, onClose }: { current: SpaceId | null; onClose: () => void }) {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const me = session.use();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the sheet, close it on Escape, keep the page behind it still, and hand focus back after.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  function open(id: SpaceId) {
    session.moveTo(id);
    onClose();
    if (id !== current) router.push(SPACES[id].href);
  }

  function signOut() {
    session.signOut();
    onClose();
    router.push('/welcome');
  }

  // On document.body, so it covers the tab bar and the Report button whatever opened it.
  return createPortal(
    <div
      className="saans-sheet-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'saans-sheet-fade 160ms ease-out' }}
    >
      <style>{SHEET_KEYFRAMES}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saans-sheet-title"
        className="saans-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '32rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: '#ffffff',
          borderRadius: '1.5rem 1.5rem 0 0',
          padding: '0.75rem 1rem calc(1.25rem + env(safe-area-inset-bottom, 0px))',
          display: 'grid',
          gap: '1rem',
          animation: 'saans-sheet-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div aria-hidden="true" style={{ justifySelf: 'center', width: '2.5rem', height: '0.3rem', borderRadius: '9999px', background: '#cbd5e1' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 id="saans-sheet-title" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
            {word('switchTo', language)}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={word('close', language)}
            style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', border: 'none', background: '#f1f5f9', fontSize: '1.1rem', cursor: 'pointer', color: '#334155' }}
          >
            ✕
          </button>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem' }}>
          {SPACE_IDS.map((id) => {
            const s = SPACES[id];
            const here = id === current;
            return (
              <li key={id} style={{ display: 'grid' }}>
                <button
                  type="button"
                  onClick={() => open(id)}
                  aria-current={here ? 'page' : undefined}
                  style={{
                    position: 'relative',
                    minWidth: 0,
                    minHeight: '9.5rem',
                    border: here ? `2px solid ${s.accent}` : '2px solid transparent',
                    borderRadius: '1.25rem',
                    background: `linear-gradient(180deg, #ffffff 0%, ${s.wash} 100%)`,
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
                    padding: '0.75rem 0.5rem',
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    justifyItems: 'center',
                    gap: '0.35rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2 }}>{s.name[language]}</span>
                  <span aria-hidden="true" style={{ fontSize: '2.6rem', lineHeight: 1, alignSelf: 'center' }}>
                    {s.icon}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: here ? s.accent : '#475569', fontWeight: here ? 800 : 500, lineHeight: 1.25 }}>
                    {here ? `✓ ${word('youAreHere', language)}` : s.forWhom[language]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Link
          href="/command"
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.85rem', borderRadius: '0.9rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}
        >
          <span aria-hidden="true">🛡️</span>
          <span style={{ flex: 1, minWidth: 0 }}>{word('official', language)}</span>
          <span aria-hidden="true">→</span>
        </Link>

        <section aria-labelledby="saans-account-title" style={{ display: 'grid', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <h3 id="saans-account-title" style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>
            {word('account', language)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span aria-hidden="true" style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', background: '#f1f5f9', display: 'grid', placeItems: 'center', fontSize: '1.4rem', flex: 'none' }}>
              {me ? PERSONA_WORDS[me.persona].icon : '👤'}
            </span>
            <div style={{ flex: '1 1 8rem', minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>{me ? word('guest', language) : word('notSignedIn', language)}</div>
              {me && <div style={{ fontSize: '0.85rem', color: '#475569' }}>{PERSONA_WORDS[me.persona].short[language]}</div>}
            </div>
            {me ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link
                  href="/welcome?tab=who"
                  onClick={onClose}
                  style={{ padding: '0.55rem 0.8rem', borderRadius: '9999px', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  {word('changeWho', language)}
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  style={{ padding: '0.55rem 0.8rem', borderRadius: '9999px', border: `1px solid ${SWITCH_RED}`, background: '#ffffff', color: SWITCH_RED, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {word('signOut', language)}
                </button>
              </div>
            ) : (
              <Link
                href="/welcome"
                onClick={onClose}
                style={{ padding: '0.55rem 0.9rem', borderRadius: '9999px', background: '#0f172a', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}
              >
                {word('signIn', language)}
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>{word('language', language)}</span>
            <LanguageSwitcher currentLang={language} onLanguageChange={setLanguage} size="md" />
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

/** The round Switch button that sits beside the bottom tab bar. */
export function SpaceSwitch({ current }: { current: SpaceId }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        id="saans-switch"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          flex: 'none',
          width: 'clamp(3.5rem, 17vw, 4rem)',
          height: 'clamp(3.5rem, 17vw, 4rem)',
          borderRadius: '50%',
          border: '3px solid #ffffff',
          background: `radial-gradient(circle at 30% 25%, #f26b76 0%, ${SWITCH_RED} 55%, #c81e2c 100%)`,
          color: '#ffffff',
          boxShadow: '0 8px 20px rgba(226, 55, 68, 0.45)',
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: '0.05rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.3rem', lineHeight: 1, fontWeight: 900 }}>
          ⇄
        </span>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1.1 }}>{word('switch', language)}</span>
      </button>
      {open && <SpaceSheet current={current} onClose={close} />}
    </>
  );
}
