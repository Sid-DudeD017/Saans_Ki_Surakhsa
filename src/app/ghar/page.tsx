'use client';
import React from 'react';
import { Container } from '../../components/ui';
import { GharIndoor } from './GharIndoor';
import { useLanguage } from '../../lib/i18n';

export default function GharPage() {
  const { t } = useLanguage();
  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>


      <GharIndoor />
    </Container>
  );
}
