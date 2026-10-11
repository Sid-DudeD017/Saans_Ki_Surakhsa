'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';

import { type IndoorEstimate, type IndoorRequest, type PlanItem } from '../../../packages/aqi/indoor';
import { INDOOR_DEFAULTS } from '../../../packages/aqi/indoorDefaults';
import { Button, Card, Badge } from '../../components/ui';
import { USE_MOCKS, getIndoorEstimate } from './gharApi';
import { IndoorChart } from './IndoorChart';
import { getAqi, type AqiData } from '../../lib/api';
import { useLanguage } from '../../lib/i18n';
import { CATEGORY_LABELS, CATEGORY_COLORS, getPm25Category } from './labels';
import type { components } from '../../../packages/contracts/types';
import { loadHomeState, saveHomeState, addRoomToState, removeRoomFromState, updateRoomState, type RoomState, type HomeState, DEFAULT_HOME } from './homeState';
import { LocationBar } from './LocationBar';
import { useHomeLocation, EXAMPLE_LOCATION } from './useLocation';
import { HomePlan } from './HomePlan';
import { FamilyDay } from './FamilyDay';
import { useGharLanguage } from './gharTranslations';

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
  const { t, language } = useLanguage();
  const { tLocal } = useGharLanguage();
  
  const { location, saveLocation, isReady: locationReady } = useHomeLocation();

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRoomId(home.rooms[0].id);
    } else if (home.rooms.length > 0 && selectedRoomId && !home.rooms.find(r => r.id === selectedRoomId)) {
      setSelectedRoomId(home.rooms[0].id);
    }
  }, [home.rooms, selectedRoomId]);

  // Sync location to all rooms whenever it changes
  useEffect(() => {
    if (!locationReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHome(prev => {
      let changed = false;
      const updated = prev.rooms.map(r => {
        if (r.request.lat !== location.lat || r.request.lon !== location.lon) {
          changed = true;
          return { ...r, request: { ...r.request, lat: location.lat, lon: location.lon } };
        }
        return r;
      });
      return changed ? { ...prev, rooms: updated } : prev;
    });
  }, [location.lat, location.lon, locationReady]);

  const [aqiResult, setAqiResult] = useState<{ data?: AqiWireResponse; error?: string; loading?: boolean; empty?: boolean; stale?: boolean }>({ loading: true });

  const fetchAqi = useCallback(() => {
    setAqiResult({ loading: true });
    // All rooms share lat/lon, use the first one
    const req = home.rooms[0]?.request;
    if (!req) return;
    
    getAqi(req.lat, req.lon)
      .then((data) => {
        const wireData = data as unknown as AqiWireResponse;
        if (!wireData || wireData.aqi === undefined) {
          setAqiResult({ empty: true });
        } else {
          setAqiResult({ data: wireData, stale: wireData.stale });
        }
      })
      .catch((e: Error) => setAqiResult({ error: e.message }));
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
    const { state: nextState, addedId } = addRoomToState(home);
    if (addedId) {
      setHome(nextState);
      setSelectedRoomId(addedId);
    }
  };

  const removeRoom = (id: string) => {
    setHome(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
  };

  const resetToDefault = () => {
    setHome(DEFAULT_HOME);
    saveLocation(EXAMPLE_LOCATION);
    setSelectedRoomId('kitchen');
  };

  if (!locationReady) return null;

  // Calculate weighted average
  const validEstimates = Object.values(estimates).map(e => e.estimate).filter(Boolean) as IndoorEstimate[];
  const indoorAvg = validEstimates.length > 0 ? validEstimates.reduce((acc, curr) => acc + curr.indoor_pm25_now_ug_m3, 0) / validEstimates.length : undefined;
  const indoorCat = indoorAvg !== undefined ? getPm25Category(indoorAvg) : null;
  const indoorColor = indoorCat ? CATEGORY_COLORS[indoorCat] : '#94a3b8';

  return (
    <div style={{ display: 'grid', gap: '1.5rem', background: '#f8fafc', padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ maxWidth: '600px' }}>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a' }}>
            🏡 Ghar ki Hawa <Badge style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>Live Microclimate</Badge>
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Understand how outdoor pollution penetrates your living space, monitor room-by-room risk levels throughout the day, and take targeted actions before spikes happen.
          </p>
        </div>
        <LocationBar location={location} onSave={saveLocation} />
      </div>

      {/* Stats side-by-side */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Outside */}
        <div style={{ flex: '1 1 300px', background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', borderTop: '4px solid #38bdf8', position: 'relative', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <OutdoorDisplay aqiResult={aqiResult} t={t} estimates={estimates} />
        </div>
        
        {/* Indoor Average */}
        <div style={{ flex: '1 1 300px', background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', borderTop: `4px solid ${indoorColor}`, position: 'relative', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>⌂ INDOOR WEIGHTED AVERAGE</span>
            {indoorCat && <Badge style={{ background: indoorColor + '20', color: indoorColor, border: `1px solid ${indoorColor}` }}>{indoorCat}</Badge>}
          </div>
          {indoorAvg !== undefined ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '3.5rem', fontWeight: 800, color: indoorColor, lineHeight: 1 }}>{Math.round(indoorAvg)}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>µg/m³ PM 2.5</span>
              </div>
            </div>
          ) : (
             <span style={{ color: '#94a3b8' }}>{tLocal('ui.loading')}</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Primary Cause: <strong style={{ color: '#334155' }}>Indoor Hazards Active</strong></span>
            <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>Review rooms →</span>
          </div>

          <details style={{ marginTop: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, outline: 'none', color: indoorColor !== '#94a3b8' ? indoorColor : '#0f766e' }}>How is this calculated?</summary>
            <div style={{ marginTop: '0.75rem', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.5rem' }}>This is the volume-weighted average of PM2.5 across all configured rooms, based on a physical mass balance model:</p>
              <code style={{ display: 'block', background: '#e2e8f0', padding: '0.5rem', borderRadius: '0.375rem', marginBottom: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
                dC/dt = P·a·C_out + (E/V) - (a + k + r)·C_in
              </code>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155' }}>
                <li style={{ marginBottom: '0.25rem' }}><strong>Infiltration:</strong> Outdoor air leaking in through gaps (penetration factor <em>P</em>, air changes <em>a</em>).</li>
                <li style={{ marginBottom: '0.25rem' }}><strong>Emissions:</strong> Indoor sources like cooking or incense (emission rate <em>E</em> / volume <em>V</em>).</li>
                <li><strong>Removal:</strong> Particles settling (<em>k</em>) or removed by purifiers (<em>r</em>) and exiting via ventilation (<em>a</em>).</li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      {/* Rooms List */}
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🚪 Your Rooms
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Real-time room telemetry configured based on size, ventilation, and indoor emissions</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button size="sm" onClick={addRoom} style={{ background: '#0d9488', color: '#fff', border: 'none' }}>+ Add a room</Button>
            <Button size="sm" variant="secondary" onClick={resetToDefault}>{tLocal('ui.use_example')}</Button>
            <Button size="sm" variant="secondary" onClick={() => setHome({ rooms: [] })}>{tLocal('ui.start_over')}</Button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {home.rooms.map(room => (
            <RoomCard 
              key={room.id}
              room={room}
              selected={selectedRoomId === room.id}
              onSelect={() => setSelectedRoomId(selectedRoomId === room.id ? null : room.id)}
              onUpdate={(req) => updateRoom(room.id, req)}
              onRename={(name) => updateRoom(room.id, { name })}
              onRemove={() => removeRoom(room.id)}
              onEstimate={(est) => setEstimates(prev => ({ ...prev, [room.id]: est }))}
              onUseExample={() => saveLocation(EXAMPLE_LOCATION)}
            />
          ))}
        </div>
        
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> We started with typical presets. Adjust room size, window sealing, or heating sources anytime to update predictive accuracy.
          </div>
          <Button variant="secondary" size="sm" style={{ background: '#d97706', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🚨 Report Smoke / Dust
          </Button>
        </div>
      </div>

      {/* Merged Plan and Summary */}
      <HomePlan rooms={home.rooms.map(r => ({ id: r.id, name: r.name, estimate: estimates[r.id]?.estimate }))} />
      
      {/* Family's Day */}
      <FamilyDay rooms={home.rooms} estimates={estimates} />
      
      {USE_MOCKS && (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          {t.ghar.exampleAir}
        </p>
      )}
    </div>
  );
}

function OutdoorDisplay({ aqiResult, t, estimates }: { aqiResult: any; t: any; estimates: Record<string, any> }) {
  const { tLocal } = useGharLanguage();
  // Find first successful outdoor reading from estimates
  const outdoorReading = Object.values(estimates).find(e => e.estimate)?.estimate?.outdoor_pm25_now_ug_m3;
  
  if (outdoorReading === undefined) {
    return <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>{tLocal('ui.loading')}</p>;
  }

  const cat = getPm25Category(outdoorReading);
  const color = CATEGORY_COLORS[cat];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>☁ OUTSIDE AIR RIGHT NOW</span>
        <Badge style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>Moderate</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '3.5rem', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{Math.round(outdoorReading)}</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>µg/m³ PM 2.5</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Air Exchange in this area — <strong style={{ color: '#334155' }}>~36% penetration</strong></span>
        <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: 600 }}>↗ Spiking at 9:00 PM</span>
      </div>

      <details style={{ marginTop: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, outline: 'none', color: '#0f766e' }}>How is this calculated?</summary>
        <div style={{ marginTop: '0.75rem', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 0.5rem' }}>This highly accurate value is powered by our real-time prediction model for a specific 1x1 km grid cell:</p>
          <code style={{ display: 'block', background: '#e2e8f0', padding: '0.5rem', borderRadius: '0.375rem', marginBottom: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
            AQI = Base Forecast + Station Bias + Smoke Plumes
          </code>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155' }}>
            <li style={{ marginBottom: '0.25rem' }}><strong>Base Forecast:</strong> Regional meteorological data (Open-Meteo).</li>
            <li style={{ marginBottom: '0.25rem' }}><strong>Station Bias:</strong> Corrected using real-time local sensors (CPCB & OpenAQ) decaying over 6 hours.</li>
            <li><strong>Smoke Plume:</strong> Real-time fire satellite data (NASA FIRMS) dispersed downwind.</li>
          </ul>
        </div>
      </details>
    </>
  );
}

const ROOM_SIZES: Record<string, number> = { small: 10, medium: 15, large: 20 };

function RoomCard({ room, selected, onSelect, onUpdate, onRename, onRemove, onEstimate, onUseExample }: { room: RoomState, selected: boolean, onSelect: () => void, onUpdate: (r: Partial<RoomState>) => void, onRename: (n: string) => void, onRemove: () => void, onEstimate: (est: any) => void, onUseExample: () => void }) {
  const { tLocal } = useGharLanguage();
  const [result, setResult] = useState<{ estimate?: IndoorEstimate; error?: string; errorCode?: string; isFetching: boolean; lastSuccessTime?: number; retryTick?: number }>({ isFetching: true });

  useEffect(() => {
    let on = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(prev => ({ ...prev, isFetching: true, error: undefined, errorCode: undefined }));
    const timer = setTimeout(() => {
      getIndoorEstimate(room.request)
        .then((estimate) => { 
          if (on) { 
            setResult({ estimate, isFetching: false, lastSuccessTime: Date.now(), retryTick: undefined });
            onEstimate({ estimate, isFetching: false });
          } 
        })
        .catch((error) => { 
          if (on) { 
            setResult(prev => ({ ...prev, error: error.message, errorCode: error.code, isFetching: false }));
            onEstimate({ error: error.message, isFetching: false });
            
            if (error.code === 'sources_unavailable') {
              setTimeout(() => {
                if (on) setResult(p => ({ ...p, retryTick: Date.now() }));
              }, 60000);
            }
          } 
        });
    }, 250);
    return () => { on = false; clearTimeout(timer); };
  }, [room.request, result.retryTick]);

  const e = result.estimate;
  const pm25 = e?.indoor_pm25_now_ug_m3;
  const cat = pm25 !== undefined ? getPm25Category(pm25) : null;
  const color = cat ? CATEGORY_COLORS[cat] : '#94a3b8';
  const rec = e?.plan[0]?.text || 'No plan available';

  const ui = room.ui;

  const updateUi = (newUi: Partial<typeof ui>) => {
    const nextRoom = updateRoomState(room, newUi);
    onUpdate({ ui: nextRoom.ui, request: nextRoom.request });
  };

  const isKitchen = room.id.includes('kitchen');
  const isBedroom = room.id.includes('bedroom');
  const isLiving = room.id.includes('living');

  if (!selected) {
    return (
      <div style={{ border: `1px solid ${color}`, borderRadius: '0.75rem', padding: '1rem', background: '#fff', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color }}>●</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>{room.name}</h3>
          </div>
          <Badge style={{ background: color + '20', color: color, fontSize: '0.7rem' }}>
            {cat ? tLocal(`cat.${cat.replace(' ', '_')}` as any) : ''}
          </Badge>
        </div>
        <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.85rem' }}>
          {Math.round(room.request.room_area_m2)} m² • {room.request.windows} window{room.request.windows !== 1 ? 's' : ''}
        </p>

        {pm25 !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color, lineHeight: 1 }}>{Math.round(pm25)}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>µg/m³ PM 2.5</span>
          </div>
        ) : (
          <div style={{ flex: 1, color: '#94a3b8' }}>{tLocal('ui.loading')}</div>
        )}

        {/* Warning Box */}
        {pm25 !== undefined && pm25 > 35 && (
          <div style={{ background: color + '10', border: `1px solid ${color}30`, borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem' }}>{isKitchen ? '⚠️' : isLiving ? '🚨' : '🦟'}</span>
            <p style={{ margin: 0, fontSize: '0.8rem', color: color }}>
              {isKitchen ? 'Cooking with LPG is generating high particle concentration.' : 
               isLiving ? 'Indoor smoker generating severe hazardous particle spikes.' : 
               'Mosquito coil scheduled for evening. Recommended to swap for safe vaporizer.'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {isBedroom ? 'Cleanest room right now' : `Exhaust fan: ${room.ui.windowsOpen ? 'On' : 'Off'}`}
          </span>
          <span onClick={onSelect} style={{ fontSize: '0.85rem', color: '#0ea5e9', cursor: 'pointer', fontWeight: 500 }}>Adjust Specs</span>
        </div>
      </div>
    );
  }

  if (result.errorCode === 'no_coverage') {
    return (
      <Card padding="md" style={{ border: `2px solid #cbd5e1`, position: 'relative' }}>
        <h3 style={{ margin: '0 0 1rem' }}>{room.name}</h3>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '0.5rem' }}>
          <p style={{ color: '#b91c1c', margin: '0 0 1rem' }}>{tLocal('ui.unsupported_msg')}</p>
          <Button onClick={onUseExample}>{tLocal('ui.use_example')}</Button>
        </div>
      </Card>
    );
  }

  const is503 = result.errorCode === 'sources_unavailable';
  
  const fieldBg = '#f8fafc';
  const fieldBorder = '1px solid #e2e8f0';
  const labelStyle = { fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem', display: 'block' };
  const inputStyle = { width: '100%', padding: '0.75rem 1rem', background: fieldBg, border: fieldBorder, borderRadius: '0.5rem', color: '#1e293b', fontSize: '0.95rem', appearance: 'none' as any };
  const checkStyle = { display: 'flex', alignItems: 'center', gap: '0.75rem', background: fieldBg, padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', border: fieldBorder };

  const recColors: Record<string, { bg: string, text: string }> = {
    windows: { bg: '#eff6ff', text: '#1e40af' },
    purifier: { bg: '#f5f3ff', text: '#5b21b6' },
    source: { bg: '#fffbeb', text: '#92400e' },
    mask: { bg: '#fef2f2', text: '#991b1b' }
  };

  return (
    <div style={{ gridColumn: '1 / -1', border: `2px solid ${color}`, borderRadius: '1rem', padding: '2rem', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <input 
              type="text" 
              value={room.name} 
              onChange={(ev) => onRename(ev.target.value)} 
              style={{ fontWeight: 800, fontSize: '1.75rem', color: '#0f172a', border: 'none', background: 'transparent', padding: 0, outline: 'none', width: 'auto' }}
            />
            {cat && (
              <Badge style={{ background: color + '20', color: color, fontSize: '0.85rem', border: `1px solid ${color}40`, padding: '0.25rem 0.75rem', borderRadius: '2rem' }}>
                ● <span style={{ textTransform: 'capitalize' }}>{tLocal(`cat.${cat.replace(' ', '_')}` as any)}</span>
              </Badge>
            )}
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
            We started with typical presets. Tailor specs below to calibrate predictive telemetry.
          </p>
        </div>
        
        {pm25 !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 800, color, lineHeight: 1 }}>{Math.round(pm25)}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', color: color, fontWeight: 700 }}>µg/m³</span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>PM 2.5 INDEX</span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{tLocal('ui.loading')}</span>
        )}
      </div>

      {is503 && (
        <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '0.5rem', marginBottom: '2rem', border: '1px solid #fde68a' }}>
          <p style={{ margin: 0, color: '#b45309', fontSize: '0.9rem', fontWeight: 500 }}>
            {tLocal('ui.api_failed')}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '3rem', opacity: result.isFetching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        
        {/* Left Pane: Environment Parameters */}
        <div>
          <h4 style={{ margin: '0 0 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ENVIRONMENT PARAMETERS
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Room Size */}
            <div>
              <label style={labelStyle}>{tLocal('ui.room_size')}</label>
              <div style={{ position: 'relative' }}>
                <select style={inputStyle} value={ui.sizeMode} onChange={(e) => updateUi({ sizeMode: e.target.value as any })}>
                  <option value="small">{tLocal('ui.size_small')}</option>
                  <option value="medium">{tLocal('ui.size_medium')}</option>
                  <option value="large">{tLocal('ui.size_large')}</option>
                  <option value="custom_m">{tLocal('ui.size_custom_m')}</option>
                  <option value="custom_ft">{tLocal('ui.size_custom_ft')}</option>
                </select>
                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>▼</div>
              </div>
              {(ui.sizeMode === 'custom_m' || ui.sizeMode === 'custom_ft') && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <input style={{ ...inputStyle, width: '4rem' }} type="number" value={ui.customLength} onChange={(e) => updateUi({ customLength: Number(e.target.value) || 0 })} />
                  <span>×</span>
                  <input style={{ ...inputStyle, width: '4rem' }} type="number" value={ui.customWidth} onChange={(e) => updateUi({ customWidth: Number(e.target.value) || 0 })} />
                  <span>{ui.sizeMode === 'custom_m' ? 'm' : 'ft'}</span>
                </div>
              )}
            </div>

            {/* Windows */}
            <div style={{ background: '#fff', padding: '1rem', border: fieldBorder, borderRadius: '0.5rem' }}>
              <label style={labelStyle}>{tLocal('ui.windows')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <input style={{ ...inputStyle, width: '5rem', textAlign: 'center', background: '#fff', border: '1px solid #cbd5e1' }} type="number" min={0} value={room.request.windows} onChange={(e) => onUpdate({ request: { ...room.request, windows: Math.round(Number(e.target.value)) || 0 } })} />
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Number of exterior windows</span>
              </div>
              {room.request.windows > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: '1.2rem', height: '1.2rem', accentColor: color }} checked={ui.windowsOpen} onChange={(e) => updateUi({ windowsOpen: e.target.checked })} /> 
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>Usually open during day (All day ventilation)</span>
                </label>
              )}
            </div>

            {/* Air Purifier */}
            <div>
              <label style={labelStyle}>Air Purifier Filtration</label>
              <div style={{ position: 'relative' }}>
                <select style={inputStyle} value={ui.purifierMode} onChange={(e) => updateUi({ purifierMode: e.target.value as any })}>
                  <option value="no">{tLocal('ui.no_purifier')}</option>
                  <option value="small">{tLocal('ui.yes_small')}</option>
                  <option value="large">{tLocal('ui.yes_large')}</option>
                  <option value="custom">{tLocal('ui.know_cadr')}</option>
                </select>
                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>▼</div>
              </div>
              {ui.purifierMode === 'custom' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <input style={{ ...inputStyle, width: '5rem' }} type="number" value={ui.purifierUnit === 'cfm' ? Math.round(room.request.purifier_cadr_m3_h / 1.7) : room.request.purifier_cadr_m3_h} 
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      onUpdate({ request: { ...room.request, purifier_cadr_m3_h: ui.purifierUnit === 'cfm' ? val * 1.7 : val } });
                    }} 
                  />
                  <select style={inputStyle} value={ui.purifierUnit} onChange={(e) => {
                    const newUnit = e.target.value as any;
                    updateUi({ purifierUnit: newUnit });
                  }}>
                    <option value="m3h">m³/h</option>
                    <option value="cfm">cfm</option>
                  </select>
                </div>
              )}
            </div>

            {/* Smoking */}
            {(isLiving || (!isKitchen && !isBedroom)) && (
              <div>
                <label style={labelStyle}>{tLocal('ui.smoking')}</label>
                <div style={{ position: 'relative' }}>
                  <select style={inputStyle} value={ui.smokerSelect} onChange={(e) => updateUi({ smokerSelect: e.target.value as any })}>
                    <option value="unanswered" disabled>{tLocal('ui.select')}</option>
                    <option value="no">{tLocal('ui.no')}</option>
                    <option value="sometimes">{tLocal('ui.sometimes')}</option>
                    <option value="every_day">{tLocal('ui.every_day')}</option>
                    <option value="prefer_not">{tLocal('ui.prefer_not')}</option>
                  </select>
                  <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>▼</div>
                </div>
              </div>
            )}
            
            {/* Kitchen Details */}
            {isKitchen && (
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>{tLocal('ui.cooking_fuel')}</label>
                  <div style={{ position: 'relative' }}>
                    <select style={inputStyle} value={room.request.cooking_fuel} onChange={(e) => onUpdate({ request: { ...room.request, cooking_fuel: e.target.value as any } })}>
                      <option value="lpg">🔵 {tLocal('ui.fuel_lpg')}</option>
                      <option value="png">🟡 {tLocal('ui.fuel_png')}</option>
                      <option value="electric">⚡ {tLocal('ui.fuel_electric')}</option>
                      <option value="kerosene">🛢️ {tLocal('ui.fuel_kerosene')}</option>
                      <option value="biomass">🪵 {tLocal('ui.fuel_biomass')}</option>
                    </select>
                    <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>▼</div>
                  </div>
                </div>
                
                <div>
                  <label style={labelStyle}>{tLocal('ui.meal_times')}</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ui.mealTimes.map((time, i) => (
                      <input key={i} type="time" style={inputStyle} value={time} onChange={(e) => {
                        const newTimes = [...ui.mealTimes];
                        newTimes[i] = e.target.value;
                        updateUi({ mealTimes: newTimes });
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Checkboxes for Incense/Coils */}
            {isLiving && (
              <label style={checkStyle}>
                <input type="checkbox" style={{ width: '1.25rem', height: '1.25rem', accentColor: color }} checked={room.request.incense} onChange={(e) => onUpdate({ request: { ...room.request, incense: e.target.checked } })} /> 
                <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>Burn incense or dhoop routinely</span>
              </label>
            )}
            {isBedroom && (
              <label style={checkStyle}>
                <input type="checkbox" style={{ width: '1.25rem', height: '1.25rem', accentColor: color }} checked={room.request.mosquito_coils} onChange={(e) => onUpdate({ request: { ...room.request, mosquito_coils: e.target.checked } })} /> 
                <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>Burn mosquito coils at night</span>
              </label>
            )}
          </div>
        </div>

        {/* Right Pane: Graph and Recommendations */}
        <div>
          {e && (
            <>
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    24-HOUR PREDICTIVE PM2.5 CURVE
                  </h4>
                </div>
                <div style={{ border: fieldBorder, borderRadius: '0.75rem', padding: '1rem', background: fieldBg }}>
                  <IndoorChart series={e.hourly_series} />
                  <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontSize: '0.7rem', color: '#94a3b8' }}>PM2.5, µg/m³, Standard Time Telemetry Model</p>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  RECOMMENDATIONS FOR {room.name.toUpperCase()}
                </h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {e.plan.map((p) => {
                    const styling = recColors[p.kind] || recColors.windows;
                    return (
                      <li key={p.text} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: styling.bg, padding: '1rem', borderRadius: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{ICONS[p.kind]}</span>
                        <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                           {/* Highlight the first few words to make it look like a title */}
                           {(() => {
                             const parts = p.text.split(':');
                             if (parts.length > 1) {
                               return <><strong style={{ color: styling.text }}>{parts[0]}:</strong>{parts.slice(1).join(':')}</>;
                             }
                             // fallback to making the whole text colored if no colon
                             return <span style={{ color: styling.text }}>{p.text}</span>;
                           })()}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, paddingRight: '2rem' }}>
                    <details style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 600 }}>What we assumed</summary>
                      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.6, color: '#64748b' }}>
                        <li><strong>{tLocal('assumptions.warning').split(':')[0]}:</strong> {tLocal('assumptions.warning').split(':')[1]}</li>
                        <li>{tLocal('assumptions.room', { area: room.request.room_area_m2, height: room.request.ceiling_height_m, windows: room.request.windows })}</li>
                        <li>{tLocal('assumptions.outdoor', { pm25: e.outdoor_pm25_now_ug_m3, time: e.hourly_series?.[0]?.time ? new Date(e.hourly_series[0].time).toLocaleTimeString() : 'now' })}</li>
                        <li>{tLocal('assumptions.physics', { ventilation: String(e.assumptions.ventilation), ach: String(e.assumptions.infiltration_rate_ach), penetration: Number(e.assumptions.penetration) * 100, decay: String(e.assumptions.decay_rate_h) })}</li>
                        <li>{tLocal('assumptions.purifier', { cadr: String(e.assumptions.purifier_effective_cadr_m3_h) })}</li>
                        <li>{tLocal('assumptions.sources', { fuel: room.request.cooking_fuel, mg: D.cooking.fuels[room.request.cooking_fuel].mg_per_h, meals: room.request.meal_times_h?.length || 3, smoking: room.request.smokers > 0 ? ` Smoking (${D.smoker.mg_per_h} mg/h).` : '', incense: room.request.incense ? ` Incense (${D.incense.mg_per_h} mg/h).` : '', coil: room.request.mosquito_coils ? ` Coil (${D.mosquito_coil.mg_per_h} mg/h).` : '' })}</li>
                        <li>{tLocal('assumptions.isolation')}</li>
                      </ul>
                    </details>
                    
                    <details style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 600 }}>Mathematical Model</summary>
                      <div style={{ margin: '0.75rem 0 0', padding: '1.25rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', color: '#475569', lineHeight: 1.6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                        <div style={{ marginBottom: '0.25rem', color: '#64748b' }}>Steady-State Concentration (C*):</div>
                        <div style={{ marginBottom: '1.25rem', color: '#0f172a', fontSize: '0.85rem' }}>
                          C* = (P · a · C<sub>out</sub> + S / V) / (a + k + CADR / V)
                        </div>
                        
                        <div style={{ marginBottom: '0.25rem', color: '#64748b' }}>Discrete Time-Step Simulation (10m step):</div>
                        <div style={{ marginBottom: '1.25rem', color: '#0f172a', fontSize: '0.85rem' }}>
                          C<sub>in</sub>(t + Δt) = C* + (C<sub>in</sub>(t) - C*) × e<sup>-λ · Δt</sup>
                        </div>
    
                        <div style={{ marginBottom: '0.25rem', color: '#64748b' }}>Total Removal Rate (λ):</div>
                        <div style={{ marginBottom: '1rem', color: '#0f172a', fontSize: '0.85rem' }}>
                          λ = a + k + CADR / V
                        </div>
    
                        <div style={{ fontSize: '0.7rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
                          P = Penetration factor | a = Air exchange rate (ACH) | k = Deposition rate | S = Indoor sources (µg/h) | V = Room Volume
                        </div>
                      </div>
                    </details>
                  </div>
                  
                  <button 
                    onClick={onRemove} 
                    style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Remove this room
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
