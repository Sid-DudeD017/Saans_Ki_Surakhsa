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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', marginBottom: '1rem' }}>
      <div>
        {location.isExample ? (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Showing an example home in {location.name}</p>
        ) : (
          <p style={{ margin: 0, fontWeight: 500 }}>{tLocal('location.home')}: {location.name}</p>
        )}
      </div>
      <Button variant="secondary" onClick={() => setMode('edit')}>
        {location.isExample ? 'Set my home' : tLocal('location.change')}
      </Button>
    </div>
  );
}
