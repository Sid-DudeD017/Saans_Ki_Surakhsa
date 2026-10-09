'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';

import { type IndoorEstimate, type IndoorRequest, type PlanItem } from '../../../packages/aqi/indoor';
import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { Button, Card } from '../../components/ui';
import { USE_MOCKS, getIndoorEstimate } from './gharApi';
import { IndoorChart } from './IndoorChart';
import { getAqi, type AqiData } from '../../lib/api';
import { useLanguage } from '../../lib/i18n';
import { CATEGORY_LABELS, CATEGORY_COLORS, getPm25Category } from './labels';
import type { components } from '../../../packages/contracts/types';
import { loadHomeState, saveHomeState, type RoomState, type HomeState, DEFAULT_HOME } from './homeState';
import { LocationBar } from './LocationBar';

const D = INDOOR_DEFAULTS;
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

function Step({ value, what, tone }: { value: number; what: React.ReactNode; tone: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.15rem', minWidth: 0 }}>
      <strong style={{ fontSize: '2rem', fontVariantNumeric: 'tabular-nums', color: tone, lineHeight: 1 }}>{Math.round(value)}</strong>
      <span style={{ fontSize: '0.8rem', color: '#475569' }}>{what}</span>
    </div>
  );
}

type AqiWireResponse = components['schemas']['AqiResponse'];

export function GharIndoor() {
  const { t } = useLanguage();
  
  // Initialise from localStorage
  const [home, setHome] = useState<HomeState>(() => loadHomeState());
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Save on change
  useEffect(() => {
    saveHomeState(home);
  }, [home]);

  // Ensure something is selected
  useEffect(() => {
    if (home.rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(home.rooms[0].id);
    } else if (home.rooms.length > 0 && selectedRoomId && !home.rooms.find(r => r.id === selectedRoomId)) {
      setSelectedRoomId(home.rooms[0].id);
    }
  }, [home.rooms, selectedRoomId]);

  const [aqiResult, setAqiResult] = useState<{ data?: AqiWireResponse; error?: string; loading?: boolean; empty?: boolean; stale?: boolean }>({ loading: true });

  const fetchAqi = useCallback(() => {
    setAqiResult({ loading: true });
    // All rooms share lat/lon, use the first one
    const req = home.rooms[0]?.request;
    if (!req) return;
    
    getAqi(req.lat, req.lon).then(
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
  }, [home.rooms[0]?.request.lat, home.rooms[0]?.request.lon]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAqi();
  }, [fetchAqi]);

  // Estimates state
  const [estimates, setEstimates] = useState<Record<string, { estimate?: IndoorEstimate; error?: string; isFetching: boolean }>>({});

  // Parallel fetch estimates per room
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};
    const active = new Set(home.rooms.map(r => r.id));

    home.rooms.forEach((room) => {
      // Set fetching if not already fetching or if request changed? We don't want to clear existing data while fetching.
      setEstimates((prev) => {
        const current = prev[room.id];
        // Weak check if we need to fetch: we should debounce based on room request changes.
        // But since this effect runs on `home.rooms` change, we can just debounce everything.
        // Actually, this will re-fetch ALL rooms if ANY room changes.
        // Let's refine this to only fetch the changed rooms.
        return prev;
      });
    });

    // We need a better way to isolate the fetch per room. See below.
  }, []); // Handled in a better way below

  // Let's create a custom component per room to handle its own effect naturally
  const updateRoom = (id: string, updates: Partial<IndoorRequest> | Partial<RoomState>) => {
    setHome(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === id ? { ...r, ...updates, request: { ...r.request, ...((updates as any).request || updates) } } : r)
    }));
  };

  const addRoom = () => {
    const bedroom = home.rooms.find(r => r.id === 'master_bedroom') || home.rooms[0];
    if (!bedroom) return;
    const newRoom: RoomState = {
      id: 'room_' + Date.now(),
      name: 'New Room',
      request: { ...bedroom.request },
    };
    setHome(prev => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
    setSelectedRoomId(newRoom.id);
  };

  const removeRoom = (id: string) => {
    setHome(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
  };

  const resetToDefault = () => {
    setHome(DEFAULT_HOME);
    setSelectedRoomId('kitchen');
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <LocationBar />
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Showing an example home in Noida</p>

      {/* Outside Air */}
      <Card padding="lg">
        {aqiResult.error && (
          <p style={{ fontSize: '0.9rem', color: '#b45309', marginBottom: '1rem' }}>
            {t.ghar.apiError.replace('{{time}}', 'a while ago')} 
          </p>
        )}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {/* We need outdoor PM2.5. We can take it from any successful room estimate, passed up, or wait for one to load. 
              Instead of passing up, we can just render it inside the first RoomCard? No, design says "Outside now" is above "Your rooms".
              Let's lift the outdoor reading state. */}
          <OutdoorDisplay aqiResult={aqiResult} t={t} estimates={estimates} />
        </div>
      </Card>

      {/* Rooms List */}
      <Card padding="lg">
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0f172a' }}>Your rooms</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {home.rooms.map(room => (
            <RoomCard 
              key={room.id}
              room={room}
              selected={selectedRoomId === room.id}
              onSelect={() => setSelectedRoomId(room.id)}
              onUpdate={(req) => updateRoom(room.id, req)}
              onRename={(name) => updateRoom(room.id, { name })}
              onRemove={() => removeRoom(room.id)}
              onEstimate={(est) => setEstimates(prev => ({ ...prev, [room.id]: est }))}
              t={t}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={addRoom}>Add a room</Button>
          <Button size="sm" variant="secondary" onClick={resetToDefault}>Use the example home</Button>
          <Button size="sm" variant="secondary" onClick={() => setHome({ rooms: [] })}>Start over</Button>
        </div>
      </Card>
      
      {USE_MOCKS && (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          {t.ghar.exampleAir}
        </p>
      )}
    </div>
  );
}

function OutdoorDisplay({ aqiResult, t, estimates }: { aqiResult: any; t: any; estimates: Record<string, any> }) {
  // Find first successful outdoor reading from estimates
  const outdoorReading = Object.values(estimates).find(e => e.estimate)?.estimate?.outdoor_pm25_now_ug_m3;
  
  if (outdoorReading === undefined) {
    return <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Loading outside air...</p>;
  }

  const cat = getPm25Category(outdoorReading);
  const color = CATEGORY_COLORS[cat];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '1rem', width: '100%' }}>
      <Step value={outdoorReading} what={<>{t.ghar.outsideNow} &middot; {t.ghar.rightNow}</>} tone={color} />
      <div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color, textTransform: 'capitalize' }}>
          {CATEGORY_LABELS[cat]}
        </div>
        {aqiResult.data && (
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            {t.ghar.aqi}: {aqiResult.data.aqi}
          </div>
        )}
      </div>
    </div>
  );
}

function RoomCard({ room, selected, onSelect, onUpdate, onRename, onRemove, onEstimate, t }: { room: RoomState, selected: boolean, onSelect: () => void, onUpdate: (r: Partial<IndoorRequest>) => void, onRename: (n: string) => void, onRemove: () => void, onEstimate: (est: any) => void, t: any }) {
  const [result, setResult] = useState<{ estimate?: IndoorEstimate; error?: string; isFetching: boolean }>({ isFetching: true });

  useEffect(() => {
    let on = true;
    setResult(prev => ({ ...prev, isFetching: true }));
    const timer = setTimeout(() => {
      getIndoorEstimate(room.request).then(
        (estimate) => { 
          if (on) { 
            setResult({ estimate, isFetching: false });
            onEstimate({ estimate, isFetching: false });
          } 
        },
        (error) => { 
          if (on) { 
            setResult({ error: error.message, isFetching: false });
            onEstimate({ error: error.message, isFetching: false });
          } 
        }
      );
    }, 250);
    return () => { on = false; clearTimeout(timer); };
  }, [room.request]); // Re-run only when THIS room's request changes

  const e = result.estimate;

  // The summary view when not selected or selected
  const pm25 = e?.indoor_pm25_now_ug_m3;
  const cat = pm25 !== undefined ? getPm25Category(pm25) : null;
  const color = cat ? CATEGORY_COLORS[cat] : '#94a3b8';
  const rec = e?.plan[0]?.text || 'No plan available';

  return (
    <div style={{ border: selected ? `2px solid #0284c7` : '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', background: selected ? '#f0f9ff' : '#fff', cursor: selected ? 'default' : 'pointer' }} onClick={!selected ? onSelect : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        {selected ? (
          <input 
            type="text" 
            value={room.name} 
            onChange={(ev) => onRename(ev.target.value)} 
            style={{ fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', background: '#fff' }}
          />
        ) : (
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{room.name}</h3>
        )}
        
        {pm25 !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>{Math.round(pm25)}</span>
            <span style={{ fontSize: '0.85rem', color: '#475569', textTransform: 'capitalize' }}>{cat ? CATEGORY_LABELS[cat] : ''}</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Loading...</span>
        )}
      </div>
      
      {!selected && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{rec}</p>
      )}

      {selected && (
        <div style={{ marginTop: '1rem', opacity: result.isFetching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#0369a1', fontWeight: '500' }}>
            We started with a typical room. Change it to match yours.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <label style={label}>
              Floor area, m²
              <input style={input} type="number" min={1} step={0.5} value={room.request.room_area_m2} onChange={(ev) => onUpdate({ room_area_m2: Number(ev.target.value) || 1 })} />
            </label>
            <label style={label}>
              Windows
              <input style={input} type="number" min={0} step={1} value={room.request.windows} onChange={(ev) => onUpdate({ windows: Math.round(Number(ev.target.value)) || 0 })} />
            </label>
            <label style={label}>
              Purifier CADR, m³/h (0 = none)
              <input style={input} type="number" min={0} step={10} value={room.request.purifier_cadr_m3_h} onChange={(ev) => onUpdate({ purifier_cadr_m3_h: Number(ev.target.value) || 0 })} />
            </label>
            <label style={label}>
              Cooking in this room
              <select style={input} value={room.request.cooking_fuel} onChange={(ev) => onUpdate({ cooking_fuel: ev.target.value as IndoorRequest['cooking_fuel'] })}>
                {FUELS.map(([v, name]) => (
                  <option key={v} value={v}>{name}</option>
                ))}
              </select>
            </label>
            <label style={label}>
              Smokers
              <input style={input} type="number" min={0} step={1} value={room.request.smokers} onChange={(ev) => onUpdate({ smokers: Math.round(Number(ev.target.value)) || 0 })} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <label style={check}><input type="checkbox" checked={room.request.windows_open} onChange={(ev) => onUpdate({ windows_open: ev.target.checked })} /> Windows open now</label>
            <label style={check}><input type="checkbox" checked={room.request.incense} onChange={(ev) => onUpdate({ incense: ev.target.checked })} /> Incense</label>
            <label style={check}><input type="checkbox" checked={room.request.mosquito_coils} onChange={(ev) => onUpdate({ mosquito_coils: ev.target.checked })} /> Mosquito coil at night</label>
          </div>

          {result.error && <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{result.error}</p>}
          
          {e && (
            <>
              <IndoorChart series={e.hourly_series} />
              
              <h4 style={{ margin: '1.25rem 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>Recommendations for {room.name}</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' }}>
                {e.plan.map((p) => (
                  <li key={p.text} style={{ display: 'grid', gridTemplateColumns: '1.75rem 1fr', gap: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5, color: '#1e293b' }}>
                    <span aria-hidden>{ICONS[p.kind]}</span>
                    <span style={{ minWidth: 0 }}>{p.text}</span>
                  </li>
                ))}
              </ul>

              <details style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#475569' }}>
                <summary style={{ cursor: 'pointer' }}>What we assumed</summary>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                  <li>{String(e.assumptions.room_volume_m3)} m³; windows {String(e.assumptions.ventilation)}: {String(e.assumptions.infiltration_rate_ach)} air changes an hour, {String(e.assumptions.penetration)} of particles get in</li>
                  <li>Settling {String(e.assumptions.decay_rate_h)}/h; purifier {String(e.assumptions.purifier_effective_cadr_m3_h)} m³/h</li>
                  <li>Cooking {D.cooking.fuels[room.request.cooking_fuel].mg_per_h} mg/h at meals, a cigarette {D.smoker.mg_per_h} mg/h, incense {D.incense.mg_per_h} mg/h, a coil {D.mosquito_coil.mg_per_h} mg/h. Each figure&apos;s source is in packages/aqi/indoor-defaults.json.</li>
                </ul>
              </details>
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="sm" variant="secondary" onClick={() => onRemove()}>Remove this room</Button>
          </div>
        </div>
      )}
    </div>
  );
}
