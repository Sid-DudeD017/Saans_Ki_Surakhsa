'use client';
import React from 'react';
import { Container } from '../../components/ui';
import { GharIndoor } from './GharIndoor';
import { useLanguage } from '../../lib/i18n';

export default function GharPage() {
  const { t } = useLanguage();
  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>
          🏠 {t.ghar.title}
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          {t.ghar.subtitle}
        </p>
      </div>

      <GharIndoor />
    </Container>
  );
}
