'use client';

// The bell's panel: real notifications from this phone (src/lib/notifications.ts), newest first, in the
// reader's language. Tapping one marks it read and goes where it points; "Mark all read" clears the badge.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { useLanguage } from '../lib/i18n';
import { ago, notifications, textIn, type AppNotification, type Severity } from '../lib/notifications';

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const WORDS = {
  title: { en: 'Notifications', hi: 'सूचनाएँ', pa: 'ਸੂਚਨਾਵਾਂ' },
  markAll: { en: 'Mark all read', hi: 'सब पढ़ा हुआ करें', pa: 'ਸਭ ਪੜ੍ਹਿਆ ਕਰੋ' },
  close: { en: 'Close', hi: 'बंद करें', pa: 'ਬੰਦ ਕਰੋ' },
  empty: {
    en: "Nothing yet. We'll tell you when the air near you turns bad, and when a report you sent moves on.",
    hi: 'अभी कुछ नहीं। आसपास की हवा ख़राब होने पर, और आपकी भेजी शिकायत आगे बढ़ने पर हम बताएँगे।',
    pa: 'ਅਜੇ ਕੁਝ ਨਹੀਂ। ਨੇੜੇ ਦੀ ਹਵਾ ਖ਼ਰਾਬ ਹੋਣ ਤੇ, ਅਤੇ ਤੁਹਾਡੀ ਭੇਜੀ ਸ਼ਿਕਾਇਤ ਅੱਗੇ ਵਧਣ ਤੇ ਅਸੀਂ ਦੱਸਾਂਗੇ।',
  },
  unread: { en: 'unread', hi: 'अनपढ़ी', pa: 'ਅਣਪੜ੍ਹੀਆਂ' },
};

// Kisan Saathi's soft colours: a pale wash and a thin edge, not solid blocks.
const TONE: Record<Severity, { icon: string; ink: string; wash: string; edge: string }> = {
  urgent: { icon: '🚨', ink: '#b91c1c', wash: '#fef2f2', edge: '#fecaca' },
  warning: { icon: '⚠️', ink: '#b45309', wash: '#fffbeb', edge: '#fde68a' },
  info: { icon: '🔔', ink: '#0369a1', wash: '#f0f9ff', edge: '#bae6fd' },
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const list = notifications.use();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  // The clock for "5 min ago", fixed while the panel is open and refreshed each time it opens.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => setNow(Date.now()), 0);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const say = (w: Record<'en' | 'hi' | 'pa', string>) => textIn(w, language);
  const unread = list.filter((n) => !n.read).length;

  function open(n: AppNotification) {
    notifications.markRead(n.id);
    onClose();
    if (n.href) router.push(n.href);
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saans-notif-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100%, 26rem)',
          maxHeight: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: '#ffffff',
          borderRadius: '0 0 0 1.25rem',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
          padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem 1.25rem',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div>
            <h2 id="saans-notif-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
              🔔 {say(WORDS.title)}
            </h2>
            {unread > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                {unread} {say(WORDS.unread)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => notifications.markAllRead()}
                style={{ minHeight: '2.5rem', padding: '0 0.85rem', borderRadius: '9999px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ✓ {say(WORDS.markAll)}
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={say(WORDS.close)}
              style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', border: 'none', background: '#f1f5f9', fontSize: '1.1rem', cursor: 'pointer', color: '#334155' }}
            >
              ✕
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <p style={{ margin: 0, padding: '1.5rem 1rem', textAlign: 'center', color: '#475569', lineHeight: 1.5, background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
            {say(WORDS.empty)}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
            {list.map((n) => {
              const t = TONE[n.severity] ?? TONE.info;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    data-notif={n.id}
                    onClick={() => open(n)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'grid',
                      gridTemplateColumns: 'auto minmax(0, 1fr)',
                      gap: '0.65rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '1rem',
                      border: `1px solid ${n.read ? '#e2e8f0' : t.edge}`,
                      background: n.read ? '#ffffff' : t.wash,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      color: '#0f172a',
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>
                      {t.icon}
                    </span>
                    <span style={{ display: 'grid', gap: '0.2rem', minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: n.read ? 600 : 800, color: n.read ? '#334155' : t.ink }}>{textIn(n.title, language)}</strong>
                        {!n.read && <span aria-label={say(WORDS.unread)} style={{ width: '0.55rem', height: '0.55rem', borderRadius: '50%', background: t.ink, flex: 'none' }} />}
                      </span>
                      <span style={{ fontSize: '0.9rem', lineHeight: 1.45, color: '#334155', overflowWrap: 'anywhere' }}>{textIn(n.message, language)}</span>
                      {now > 0 && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{ago(n.at, language, now)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default NotificationCenter;
