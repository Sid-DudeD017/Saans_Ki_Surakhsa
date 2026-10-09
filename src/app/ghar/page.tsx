import React from 'react';
import { Container, Badge } from '../../components/ui';
import { GharIndoor } from './GharIndoor';

export default function GharPage() {
  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Badge variant="primary" size="md">
            P3 MODULE
          </Badge>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Indoor Air & Personal Exposure Intelligence
          </span>
        </div>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>
          🏠 Ghar ki Hawa
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          How much of the air outside gets into your room, what it will be hour by hour, and what to do about it today.
        </p>
      </div>

      <GharIndoor />
    </Container>
  );
}
