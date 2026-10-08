import React from 'react';
import { Card, Container, Badge, Alert } from '../../components/ui';

export default function KisanPage() {
  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Badge variant="warning" size="md">
            P1 MODULE
          </Badge>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Agricultural Biomass & Stubble Management
          </span>
        </div>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>
          🌾 Kisan Saathi
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          Farmer voice agent, zero-burn incentive planning, and Custom Hiring Centre (CHC) equipment allocation.
        </p>
      </div>

      <Alert variant="info" title="Module Boundary (P1-Owned)">
        This route is reserved for <strong>P1 (Kisan Saathi)</strong>. The shared layout, navigation shell, and API contracts are mounted. Backend proposal available at <code>packages/contracts/proposals/p1-kisan.openapi.json</code>.
      </Alert>

      <div style={{ marginTop: '1.25rem' }}>
        <Card padding="lg">
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
            Planned P1 Capabilities:
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}>
            <li>Multilingual Punjabi/Hindi speech agent (Whisper/Gemini audio)</li>
            <li>Zero-burn straw management equipment booking (Super Seeder, Happy Seeder)</li>
            <li>Thermal cluster correlation with regional satellite fire passes</li>
            <li>Carbon credit & incentive eligibility assessment</li>
          </ul>
        </Card>
      </div>
    </Container>
  );
}
