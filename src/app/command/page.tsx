import React from 'react';
import { Card, Container, Badge, Alert } from '../../components/ui';

export default function CommandPage() {
  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Badge variant="danger" size="md">
            P4 MODULE
          </Badge>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Municipal Incidents & Operations Command Center
          </span>
        </div>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>
          🛡️ Command Console
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          City-scale case triage, municipal squad dispatch, and statutory GRAP enforcement tracking.
        </p>
      </div>

      <Alert variant="warning" title="Module Boundary (P4-Owned)">
        This route is reserved for <strong>P4 (Command)</strong>. Implementation plan is documented in <code>PHASE_4_IMPLEMENTATION_PLAN.md</code>.
      </Alert>

      <div style={{ marginTop: '1.25rem' }}>
        <Card padding="lg">
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#0f172a' }}>
            Planned P4 Capabilities:
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}>
            <li>Citizen complaint triage from <code>POST /v1/complaints</code></li>
            <li>Satellite thermal cluster correlation within 1000m buffer</li>
            <li>Mechanized road sweeper and anti-smog water tanker tasking</li>
            <li>Audited administrative action logs and resolution tracking</li>
          </ul>
        </Card>
      </div>
    </Container>
  );
}
