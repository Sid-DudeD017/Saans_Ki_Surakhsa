'use client';

// Where the farm is (K3), shown on every Kisan tab. The same pattern as Ghar's home location: GPS only
// when the farmer taps, rounded to about 1 km, kept on the phone; typing the village works too.
import React, { useState } from 'react';

import { Button, Card } from '../../components/ui';
import { farmStore, round2 } from './farmProfile';
import type { Language } from './kisanApi';
import { say, sayWith } from './strings';

export function FarmLocationBar({ language }: { language: Language }) {
  const farm = farmStore.use();
  const location = farm.location;
  const [editing, setEditing] = useState(false);
  const [village, setVillage] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const place = location?.village
    ? location.village
    : location?.lat !== undefined && location.lon !== undefined
      ? sayWith('near', language, { lat: location.lat.toFixed(2), lon: location.lon.toFixed(2) })
      : null;

  function open() {
    setVillage(location?.village ?? '');
    setError(null);
    setEditing(true);
  }

  function useGps() {
    if (!('geolocation' in navigator)) {
      setError(say('locationDenied', language));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // Each way of setting the place replaces the other, so a GPS fix never wears an old village's name.
        farmStore.set((f) => ({ ...f, location: { lat: round2(pos.coords.latitude), lon: round2(pos.coords.longitude) } }));
        setEditing(false);
      },
      () => {
        setLocating(false);
        setError(say('locationDenied', language));
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function saveVillage(e: React.FormEvent) {
    e.preventDefault();
    const name = village.trim().slice(0, 80);
    if (!name) return;
    farmStore.set((f) => ({ ...f, location: { village: name } }));
    setEditing(false);
  }

  if (editing) {
    return (
      <Card padding="md" style={{ margin: '1rem 0', background: '#f8fafc' }}>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Button size="lg" onClick={useGps} disabled={locating} style={{ minHeight: '3rem' }}>
            📍 {locating ? say('locating', language) : say('useMyLocation', language)}
          </Button>
          <form onSubmit={saveVillage} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label htmlFor="kisan-village" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {say('villageName', language)}
            </label>
            <input
              id="kisan-village"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder={say('villageName', language)}
              maxLength={80}
              autoComplete="off"
              style={{ flex: '1 1 12rem', minWidth: 0, minHeight: '3rem', padding: '0.6rem 0.9rem', fontSize: '1.05rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff' }}
            />
            <Button type="submit" size="lg" disabled={!village.trim()} style={{ minHeight: '3rem' }}>
              {say('save', language)}
            </Button>
          </form>
          {error && (
            <p role="alert" style={{ margin: 0, color: '#b45309', fontSize: '0.95rem' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{say('locationPrivacy', language)}</span>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {say('cancel', language)}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        margin: '1rem 0',
        padding: '0.6rem 0.9rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
      }}
    >
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.95rem', color: place ? '#0f172a' : '#64748b' }}>
        📍 {place ? sayWith('farmAt', language, { place }) : say('locationNotSet', language)}
      </span>
      <Button variant="secondary" onClick={open} style={{ minHeight: '2.75rem' }}>
        {place ? say('change', language) : say('setLocation', language)}
      </Button>
    </div>
  );
}
