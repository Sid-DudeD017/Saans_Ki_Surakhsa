'use client';

// Ghar ki Hawa's indoor estimate (P3): the Sharma example worked through, then this room now, the next 24 hours
// and today's plan, for a room you can change.
import React, { useEffect, useState, useCallback } from 'react';

import { steadyIndoor, type IndoorEstimate, type IndoorRequest, type PlanItem } from '../../../packages/aqi/indoor';
import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { Alert, Button, Card } from '../../components/ui';
import { USE_MOCKS, getIndoorEstimate } from './gharApi';
import { IndoorChart } from './IndoorChart';
import { SHARMA_BEDROOM } from './sharma';
import { ReportButton } from '../../components/ReportButton';
import { getAqi, type AqiData } from '../../lib/api';

// TODO(P2 labels.ts): Replace with imported labels when available.
const CATEGORY_LABELS: Record<string, string> = {
  good: 'good',
  satisfactory: 'satisfactory',
  moderate: 'moderate',
  poor: 'poor',
  very_poor: 'very_poor',
  severe: 'severe'
};

const D = INDOOR_DEFAULTS;
const shut = { penetration: D.ventilation.closed.penetration, airExchangePerH: D.ventilation.closed.air_exchange_per_h, depositionPerH: D.deposition_per_h.value };
const EXAMPLE = {
  outside: 280,
  shut: steadyIndoor({ ...shut, outdoor: 280, cadrM3H: 0, volumeM3: 40 }),
  purifier: steadyIndoor({ ...shut, outdoor: 280, cadrM3H: 250, volumeM3: 40 }),
};

const ICONS: Record<PlanItem['kind'], string> = { windows: '🪟', purifier: '🌀', source: '🔥', mask: '😷' };
const FUELS: [IndoorRequest['cooking_fuel'], string][] = [
  ['none', 'No cooking in this room'],
  ['electric', 'Electric'],
  ['lpg', 'LPG'],
  ['png', 'Piped gas'],
  ['kerosene', 'Kerosene'],
  ['biomass', 'Wood or dung (chulha)'],
];

const label: React.CSSProperties = { display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' };
const input: React.CSSProperties = { padding: '0.45rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', minWidth: 0 };
const check: React.CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem', color: '#334155' };

function Step({ value, what, tone }: { value: number; what: string; tone: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.15rem', minWidth: 0 }}>
      <strong style={{ fontSize: '2rem', fontVariantNumeric: 'tabular-nums', color: tone, lineHeight: 1 }}>{Math.round(value)}</strong>
      <span style={{ fontSize: '0.8rem', color: '#475569' }}>{what}</span>
    </div>
  );
}

import type { components } from '../../../packages/contracts/types';

type AqiWireResponse = components['schemas']['AqiResponse'];

export function GharIndoor() {
  const [room, setRoom] = useState<IndoorRequest>(SHARMA_BEDROOM);
  const [result, setResult] = useState<{ estimate?: IndoorEstimate; error?: string }>({});

  const [aqiResult, setAqiResult] = useState<{ data?: AqiWireResponse; error?: string; loading?: boolean; empty?: boolean; stale?: boolean }>({ loading: true });

  const fetchAqi = useCallback(() => {
    setAqiResult({ loading: true });
    getAqi(room.lat, room.lon).then(
      (data) => {
        const wireData = data as unknown as AqiWireResponse;
        if (!wireData || wireData.aqi === undefined) {
          setAqiResult({ empty: true });
        } else {
          setAqiResult({ data: wireData, stale: wireData.stale });
        }
      },
      (e: Error) => setAqiResult({ error: e.message })
    );
  }, [room.lat, room.lon]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAqi();
  }, [fetchAqi]);

  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    let on = true;
    const timer = setTimeout(() => {
      getIndoorEstimate(room).then(
        (estimate) => { if (on) { setResult({ estimate }); setIsFetching(false); } },
        (e: Error) => { if (on) { setResult({ error: e.message }); setIsFetching(false); } },
      );
    }, 250);
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [room]);

  const set = <K extends keyof IndoorRequest>(key: K, value: IndoorRequest[K]) => {
    setIsFetching(true);
    setRoom((r) => ({ ...r, [key]: value }));
  };
  const num = (key: 'room_area_m2' | 'windows' | 'purifier_cadr_m3_h' | 'smokers', min: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= min) set(key, key === 'windows' || key === 'smokers' ? Math.round(v) : v);
  };
  const e = result.estimate;
  const volume = room.room_area_m2 * room.ceiling_height_m;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card padding="lg">
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', color: '#0f172a' }}>Outside Air (AQI)</h2>
        {aqiResult.loading && <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Loading outdoor AQI...</p>}
        {aqiResult.empty && <p style={{ fontSize: '0.9rem', color: '#64748b' }}>No data available for this location.</p>}
        {aqiResult.error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Alert variant="danger" title="API Error">{aqiResult.error}</Alert>
            <Button variant="secondary" size="sm" onClick={fetchAqi}>Retry</Button>
          </div>
        )}
        {aqiResult.data && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '1rem' }}>
              <Step value={aqiResult.data.aqi} what="AQI" tone={aqiResult.data.aqi > 200 ? '#b45309' : '#0369a1'} />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'capitalize' }}>
                  {CATEGORY_LABELS[aqiResult.data.category.toLowerCase()] || aqiResult.data.category.toLowerCase()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>Category</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a' }}>
                  {aqiResult.data.dominant_pollutant}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>Dominant Pollutant</div>
              </div>
            </div>
            {aqiResult.stale && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#b45309', fontWeight: 'bold' }}>⚠️ Data is old</p>}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', color: '#0f172a' }}>The Sharma family&apos;s bedroom</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#475569' }}>A 40 m³ room in Noida on a smoggy morning. Same air outside, three different rooms.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <Step value={EXAMPLE.outside} what="Outside, µg/m³" tone="#b45309" />
          <Step value={EXAMPLE.shut} what="Windows shut" tone="#c2410c" />
          <Step value={EXAMPLE.purifier} what="Shut, with a 250 m³/h purifier" tone="#0369a1" />
        </div>
        <p style={{ margin: '1rem 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
          C<sub>in</sub> = (P·a·C<sub>out</sub> + S/V) ÷ (a + k + CADR/V). Windows shut, P = {shut.penetration} of the outside air&apos;s particles get in, at a = {shut.airExchangePerH} air changes an hour; k = {shut.depositionPerH}/h settle out. The purifier adds CADR/V = 250/40 = 6.25 changes of clean air an hour.
        </p>
      </Card>

      <Card padding="lg">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: '#0f172a' }}>Your room</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.75rem' }}>
          <label style={label}>
            Floor area, m²
            <input style={input} type="number" min={1} step={0.5} value={room.room_area_m2} onChange={num('room_area_m2', 1)} />
          </label>
          <label style={label}>
            Windows
            <input style={input} type="number" min={0} step={1} value={room.windows} onChange={num('windows', 0)} />
          </label>
          <label style={label}>
            Purifier CADR, m³/h (0 = none)
            <input style={input} type="number" min={0} step={10} value={room.purifier_cadr_m3_h} onChange={num('purifier_cadr_m3_h', 0)} />
          </label>
          <label style={label}>
            Cooking in this room
            <select style={input} value={room.cooking_fuel} onChange={(ev) => set('cooking_fuel', ev.target.value as IndoorRequest['cooking_fuel'])}>
              {FUELS.map(([v, name]) => (
                <option key={v} value={v}>{name}</option>
              ))}
            </select>
          </label>
          <label style={label}>
            Smokers
            <input style={input} type="number" min={0} step={1} value={room.smokers} onChange={num('smokers', 0)} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <label style={check}><input type="checkbox" checked={room.windows_open} onChange={(ev) => set('windows_open', ev.target.checked)} /> Windows open now</label>
          <label style={check}><input type="checkbox" checked={room.incense} onChange={(ev) => set('incense', ev.target.checked)} /> Incense</label>
          <label style={check}><input type="checkbox" checked={room.mosquito_coils} onChange={(ev) => set('mosquito_coils', ev.target.checked)} /> Mosquito coil at night</label>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
          <span>{Math.round(volume)} m³ under a {room.ceiling_height_m} m ceiling</span>
          <Button size="sm" variant="secondary" onClick={() => setRoom(SHARMA_BEDROOM)}>Back to the Sharmas&apos; bedroom</Button>
        </div>
      </Card>

      {result.error && <Alert variant="danger" title="No estimate">{result.error}</Alert>}

      {e && (
        <Card padding="lg">
          <div style={{ opacity: isFetching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <Step value={e.outdoor_pm25_now_ug_m3} what="Outside now, µg/m³" tone="#b45309" />
              <Step value={e.indoor_pm25_now_ug_m3} what="This room now" tone="#0369a1" />
            </div>
            <IndoorChart series={e.hourly_series} />
            <h3 style={{ margin: '1.25rem 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>Today&apos;s plan</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' }}>
              {e.plan.map((p) => (
                <li key={p.text} style={{ display: 'grid', gridTemplateColumns: '1.75rem 1fr', gap: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5, color: '#1e293b' }}>
                  <span aria-hidden>{ICONS[p.kind]}</span>
                  <span style={{ minWidth: 0 }}>{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <ReportButton />
          </div>
          <details style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#475569' }}>
            <summary style={{ cursor: 'pointer' }}>What the model assumed</summary>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
              <li>{String(e.assumptions.room_volume_m3)} m³; windows {String(e.assumptions.ventilation)}: {String(e.assumptions.infiltration_rate_ach)} air changes an hour, {String(e.assumptions.penetration)} of particles get in</li>
              <li>Settling {String(e.assumptions.decay_rate_h)}/h; purifier {String(e.assumptions.purifier_effective_cadr_m3_h)} m³/h</li>
              <li>Cooking {D.cooking.fuels[room.cooking_fuel].mg_per_h} mg/h at meals, a cigarette {D.smoker.mg_per_h} mg/h, incense {D.incense.mg_per_h} mg/h, a coil {D.mosquito_coil.mg_per_h} mg/h. Each figure&apos;s source is in packages/aqi/indoor-defaults.json.</li>
            </ul>
          </details>
          {USE_MOCKS && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Example outdoor air: a smoggy October day in Noida. Set NEXT_PUBLIC_USE_MOCKS=false for the live forecast.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
