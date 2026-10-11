'use client';

// Opening the app: someone who has said who they are goes straight to their part of it; anyone else
// signs in first (src/app/welcome).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useLanguage } from '../lib/i18n';
import { SPACES, session, word } from '../lib/space';

export default function OpenApp() {
  const me = session.use();
  const router = useRouter();
  const { language } = useLanguage();

  useEffect(() => {
    if (me === undefined) return; // not read yet
    router.replace(me ? SPACES[me.space].href : '/welcome');
  }, [me, router]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: '0.5rem',
        background: 'linear-gradient(170deg, #fff4cc 0%, #e8f8ee 50%, #e0f2fe 100%)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '3.5rem' }}>
        🌱
      </span>
      <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a' }}>Saans</div>
      <p role="status" style={{ margin: 0, color: '#475569' }}>
        {word('opening', language)}
      </p>
    </div>
  );
}
