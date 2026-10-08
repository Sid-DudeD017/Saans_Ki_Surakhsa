import React from 'react';
import { Card, Container, Badge, Alert } from '../../components/ui';

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
          Indoor-outdoor air infiltration modeling, classroom ventilation guidance, and commuter clean-route navigation.
        </p>
      </div>

      <Alert variant="info" title="Module Boundary (P3-Owned)">
        This route is reserved for <strong>P3 (Ghar ki Hawa)</strong>. The shared app shell and CPCB AQI data contract are mounted. Backend proposal available at <code>packages/contracts/proposals/p3-aqi.openapi.json</code>.
      </Alert>

      <div style={{ marginTop: '1.25rem' }}>
        <Card padding="lg">
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
            Planned P3 Capabilities:
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}>
            <li>Inverse Distance Weighting (IDW) AQI spatial interpolation</li>
            <li>Indoor particle infiltration estimation based on building type</li>
            <li>Classroom window open/close guidance based on diurnal inversion curves</li>
            <li>Low-exposure walking and cycling commute routing</li>
          </ul>
        </Card>
      </div>
    </Container>
  );
}
