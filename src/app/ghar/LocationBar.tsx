// TODO(P2 LocationBar.tsx): Shared location bar
import React, { useState } from 'react';
import { Button, Card } from '../../components/ui';
import type { LocationState } from './useLocation';
import { useGharLanguage } from './gharTranslations';

export function LocationBar({ location, onSave }: { location: LocationState, onSave: (loc: LocationState) => void }) {
  const { tLocal } = useGharLanguage();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirming'>('view');
  const [candidate, setCandidate] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLocate = () => {
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCandidate({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: 'My Location',
          isExample: false
        });
        setMode('confirming');
      },
      () => {
        setError("Browser location permission was refused. PIN/place search is currently unavailable (missing geocoding provider dependency).");
      },
      { timeout: 10000 }
    );
  };

  if (mode === 'confirming' && candidate) {
    return (
      <Card padding="md" style={{ marginBottom: '1rem', background: '#f8fafc' }}>
        <p style={{ fontWeight: 600, marginTop: 0 }}>Is this your home?</p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#334155' }}>
          Location: {candidate.lat.toFixed(2)}, {candidate.lon.toFixed(2)}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button onClick={() => { onSave(candidate); setMode('view'); }}>Confirm</Button>
          <Button variant="secondary" onClick={() => setMode('view')}>{tLocal('location.cancel')}</Button>
        </div>
      </Card>
    );
  }

  if (mode === 'edit') {
    return (
      <Card padding="md" style={{ marginBottom: '1rem', background: '#f8fafc' }}>
        <p style={{ marginTop: 0, fontWeight: 500 }}>Set your home location</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <Button onClick={handleLocate}>{tLocal('location.use_current')}</Button>
          <Button variant="secondary" onClick={() => setMode('view')}>{tLocal('location.cancel')}</Button>
        </div>
        {error && <p style={{ color: '#b45309', fontSize: '0.9rem', margin: 0 }}>{error}</p>}
        {!error && <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>PIN/place search is unavailable (missing geocoding provider).</p>}
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: '#f8fafc', borderRadius: '2rem', border: '1px solid #e2e8f0', minWidth: '300px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#e0f2fe', color: '#0ea5e9' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>
            ASSIGNED HOME
          </p>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
            {location.isExample ? `Example: ${location.name}` : location.name}
          </p>
        </div>
      </div>
      <button 
        onClick={() => setMode('edit')}
        style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: 500, color: '#334155', cursor: 'pointer', transition: 'all 0.2s' }}
        onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {tLocal('location.change')}
      </button>
    </div>
  );
}
