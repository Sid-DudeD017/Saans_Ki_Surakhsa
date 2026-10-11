'use client';

// "Your farm" (K4): paddy, tractors and the sowing window that the Machines, Shop and Help tabs reuse.
// Filled by the Plan conversation once the farmer confirms, or typed here.
import React, { useState } from 'react';

import { Badge, Button, Card } from '../../components/ui';
import { farmFromForm, farmStore, formOf, type FarmForm } from './farmProfile';
import type { Language } from './kisanApi';
import { cardLabel, dayMonth, say } from './strings';

const INPUT: React.CSSProperties = {
  width: '100%',
  minHeight: '3rem',
  padding: '0.6rem 0.9rem',
  fontSize: '1.05rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontFamily: 'inherit',
};

export function FarmCard({ language }: { language: Language }) {
  const farm = farmStore.use();
  const [form, setForm] = useState<FarmForm | null>(null);
  const [invalid, setInvalid] = useState(false);

  const parts = [
    farm.paddyAcres !== undefined && `${cardLabel('paddy', language)} ${farm.paddyAcres} ${say('killa', language)}`,
    farm.tractors !== undefined && `${cardLabel('tractors', language)} ${farm.tractors}`,
    farm.harvestDate && `${cardLabel('harvest', language)} ${dayMonth(farm.harvestDate, language)}`,
    farm.wheatBy && `${cardLabel('wheat_by', language)} ${dayMonth(farm.wheatBy, language)}`,
  ].filter(Boolean) as string[];

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const details = farmFromForm(form);
    if (!details) {
      setInvalid(true);
      return;
    }
    farmStore.set((f) => ({ ...f, ...details, source: 'form' }));
    setForm(null);
  }

  const field = (key: keyof FarmForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label htmlFor={`kisan-farm-${key}`} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.95rem', color: '#334155', minWidth: 0 }}>
      {label}
      <input
        id={`kisan-farm-${key}`}
        value={form?.[key] ?? ''}
        onChange={(e) => {
          setInvalid(false);
          setForm((old) => (old ? { ...old, [key]: e.target.value } : old));
        }}
        style={INPUT}
        {...props}
      />
    </label>
  );

  if (form) {
    return (
      <Card padding="md">
        <form onSubmit={save} style={{ display: 'grid', gap: '0.9rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>🌾 {say('yourFarm', language)}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))', gap: '0.75rem' }}>
            {field('paddyAcres', `${cardLabel('paddy', language)} (${say('killa', language)})`, { type: 'number', inputMode: 'decimal', min: 0, step: 0.5 })}
            {field('tractors', cardLabel('tractors', language), { type: 'number', inputMode: 'numeric', min: 0, step: 1 })}
            {field('harvestDate', cardLabel('harvest', language), { type: 'date' })}
            {field('wheatBy', cardLabel('wheat_by', language), { type: 'date' })}
          </div>
          {invalid && (
            <p role="alert" style={{ margin: 0, color: '#b45309', fontSize: '0.95rem' }}>
              {say('farmInvalid', language)}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button type="submit" size="lg" style={{ minHeight: '3rem' }}>
              {say('save', language)}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => setForm(null)} style={{ minHeight: '3rem' }}>
              {say('cancel', language)}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 14rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            🌾 {say('yourFarm', language)}
            {farm.source === 'chat' && parts.length > 0 && (
              <Badge variant="success" size="sm">
                {say('fromChat', language)}
              </Badge>
            )}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '1rem', lineHeight: 1.5, color: parts.length ? '#0f172a' : '#475569' }}>
            {parts.length ? parts.join(' · ') : say('farmEmpty', language)}
          </p>
        </div>
        <Button variant={parts.length ? 'secondary' : 'primary'} onClick={() => setForm(formOf(farm))} style={{ minHeight: '2.75rem' }}>
          {parts.length ? say('change', language) : say('fillFarm', language)}
        </Button>
      </div>
    </Card>
  );
}
