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
      setSelectedRoomId(home.rooms[0].id);
    } else if (home.rooms.length > 0 && selectedRoomId && !home.rooms.find(r => r.id === selectedRoomId)) {
      setSelectedRoomId(home.rooms[0].id);
    }
  }, [home.rooms, selectedRoomId]);

  // Sync location to all rooms whenever it changes
  useEffect(() => {
    if (!locationReady) return;
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

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <LocationBar location={location} onSave={saveLocation} />

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
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0f172a' }}>{tLocal('ui.your_rooms')}</h2>
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
              onUseExample={() => saveLocation(EXAMPLE_LOCATION)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={addRoom}>{tLocal('ui.add_room')}</Button>
          <Button size="sm" variant="secondary" onClick={resetToDefault}>{tLocal('ui.use_example')}</Button>
          <Button size="sm" variant="secondary" onClick={() => setHome({ rooms: [] })}>{tLocal('ui.start_over')}</Button>
        </div>
      </Card>

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '1rem', width: '100%' }}>
      <Step value={outdoorReading} what={<>{t.ghar.outsideNow} &middot; {t.ghar.rightNow}</>} tone={color} />
      <div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color, textTransform: 'capitalize' }}>
          {tLocal(`cat.${cat.replace(' ', '_')}` as any)}
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

const ROOM_SIZES: Record<string, number> = { small: 10, medium: 15, large: 20 };

function RoomCard({ room, selected, onSelect, onUpdate, onRename, onRemove, onEstimate, onUseExample }: { room: RoomState, selected: boolean, onSelect: () => void, onUpdate: (r: Partial<RoomState>) => void, onRename: (n: string) => void, onRemove: () => void, onEstimate: (est: any) => void, onUseExample: () => void }) {
  const { tLocal } = useGharLanguage();
  const [result, setResult] = useState<{ estimate?: IndoorEstimate; error?: string; errorCode?: string; isFetching: boolean; lastSuccessTime?: number; retryTick?: number }>({ isFetching: true });

  useEffect(() => {
    let on = true;
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
      <div onClick={onSelect} style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{room.name}</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{Math.round(room.request.room_area_m2)} m² • {room.request.windows} window{room.request.windows !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {result.isFetching && !e ? (
            <span style={{ color: '#94a3b8' }}>{tLocal('ui.loading')}</span>
          ) : result.errorCode === 'no_coverage' ? (
            <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{tLocal('ui.unsupported_location')}</span>
          ) : result.errorCode === 'sources_unavailable' && !e ? (
            <span style={{ color: '#b45309', fontSize: '0.85rem' }}>{tLocal('ui.data_unavailable')}</span>
          ) : pm25 !== undefined ? (
            <>
              <span style={{ fontSize: '1.25rem', fontWeight: 600, color }}>{Math.round(pm25)}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.25rem' }}>µg/m³</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color }}>{cat ? tLocal(`cat.${cat.replace(' ', '_')}` as any) : ''}</span>
            </>
          ) : (
            <span style={{ color: '#ef4444' }}>{tLocal('ui.error')}</span>
          )}
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

  return (
    <div style={{ border: `2px solid #0284c7`, borderRadius: '0.75rem', padding: '1rem', background: '#f0f9ff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <input 
          type="text" 
          value={room.name} 
          onChange={(ev) => onRename(ev.target.value)} 
          style={{ fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', background: '#fff', minHeight: '44px' }}
        />
        
        {pm25 !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>{Math.round(pm25)}</span>
            <span style={{ fontSize: '0.85rem', color: '#475569' }}>µg/m³</span>
            <span style={{ fontSize: '0.85rem', color: '#475569', textTransform: 'capitalize' }}>{cat ? tLocal(`cat.${cat.replace(' ', '_')}` as any) : ''}</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{tLocal('ui.loading')}</span>
        )}
      </div>

      {is503 && (
        <div style={{ background: '#fffbeb', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #fde68a' }}>
          <p style={{ margin: 0, color: '#b45309', fontSize: '0.9rem' }}>
            {tLocal('ui.api_failed')}
          </p>
        </div>
      )}

      <div style={{ marginTop: '1rem', opacity: result.isFetching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#0369a1', fontWeight: '500' }}>
            {tLocal('ui.change_match_yours')}
          </p>

          <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Room Size */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#334155' }}>{tLocal('ui.room_size')}</legend>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select style={{ ...input, minHeight: '44px' }} value={ui.sizeMode} onChange={(e) => updateUi({ sizeMode: e.target.value as any })}>
                  <option value="small">{tLocal('ui.size_small')}</option>
                  <option value="medium">{tLocal('ui.size_medium')}</option>
                  <option value="large">{tLocal('ui.size_large')}</option>
                  <option value="custom_m">{tLocal('ui.size_custom_m')}</option>
                  <option value="custom_ft">{tLocal('ui.size_custom_ft')}</option>
                </select>
                {(ui.sizeMode === 'custom_m' || ui.sizeMode === 'custom_ft') && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input style={{ ...input, width: '4rem', minHeight: '44px' }} type="number" value={ui.customLength} onChange={(e) => updateUi({ customLength: Number(e.target.value) || 0 })} />
                    <span>×</span>
                    <input style={{ ...input, width: '4rem', minHeight: '44px' }} type="number" value={ui.customWidth} onChange={(e) => updateUi({ customWidth: Number(e.target.value) || 0 })} />
                    <span>{ui.sizeMode === 'custom_m' ? 'm' : 'ft'}</span>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Windows */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#334155' }}>{tLocal('ui.windows')}</legend>
              <label style={{ ...label, marginBottom: '0.5rem' }}>
                {tLocal('ui.num_windows')}
                <input style={{ ...input, width: '5rem', minHeight: '44px' }} type="number" min={0} value={room.request.windows} onChange={(e) => onUpdate({ request: { ...room.request, windows: Math.round(Number(e.target.value)) || 0 } })} />
              </label>
              {room.request.windows > 0 && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={check}><input type="checkbox" style={{ width: '20px', height: '20px' }} checked={ui.windowsOpen} onChange={(e) => updateUi({ windowsOpen: e.target.checked })} /> {tLocal('ui.usually_open')} (All day)</label>
                </div>
              )}
            </fieldset>

            {/* Purifier */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#334155' }}>{tLocal('ui.air_purifier')}</legend>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select style={{ ...input, minHeight: '44px' }} value={ui.purifierMode} onChange={(e) => updateUi({ purifierMode: e.target.value as any })}>
                  <option value="no">{tLocal('ui.no_purifier')}</option>
                  <option value="small">{tLocal('ui.yes_small')}</option>
                  <option value="large">{tLocal('ui.yes_large')}</option>
                  <option value="custom">{tLocal('ui.know_cadr')}</option>
                </select>
                {ui.purifierMode === 'custom' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input style={{ ...input, width: '5rem', minHeight: '44px' }} type="number" value={ui.purifierUnit === 'cfm' ? Math.round(room.request.purifier_cadr_m3_h / 1.7) : room.request.purifier_cadr_m3_h} 
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        onUpdate({ request: { ...room.request, purifier_cadr_m3_h: ui.purifierUnit === 'cfm' ? val * 1.7 : val } });
                      }} 
                    />
                    <select style={{ ...input, minHeight: '44px' }} value={ui.purifierUnit} onChange={(e) => {
                      const newUnit = e.target.value as any;
                      updateUi({ purifierUnit: newUnit });
                    }}>
                      <option value="m3h">m³/h</option>
                      <option value="cfm">cfm</option>
                    </select>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Kitchen specifics */}
            {isKitchen && (
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#334155' }}>{tLocal('ui.kitchen_details')}</legend>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <label style={label}>
                    {tLocal('ui.cooking_fuel')}
                    <select style={{ ...input, minHeight: '44px' }} value={room.request.cooking_fuel} onChange={(e) => onUpdate({ request: { ...room.request, cooking_fuel: e.target.value as any } })}>
                      <option value="lpg">🔵 {tLocal('ui.fuel_lpg')}</option>
                      <option value="png">🟡 {tLocal('ui.fuel_png')}</option>
                      <option value="electric">⚡ {tLocal('ui.fuel_electric')}</option>
                      <option value="kerosene">🛢️ {tLocal('ui.fuel_kerosene')}</option>
                      <option value="biomass">🪵 {tLocal('ui.fuel_biomass')}</option>
                    </select>
                  </label>
                  
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>{tLocal('ui.meal_times')}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {ui.mealTimes.map((time, i) => (
                        <input key={i} type="time" style={{ ...input, minHeight: '44px' }} value={time} onChange={(e) => {
                          const newTimes = [...ui.mealTimes];
                          newTimes[i] = e.target.value;
                          updateUi({ mealTimes: newTimes });
                        }} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>{tLocal('ui.chimney')}</span>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{tLocal('ui.not_counted')}</p>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Smoking */}
            {(isLiving || (!isKitchen && !isBedroom)) && (
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#334155' }}>{tLocal('ui.smoking')}</legend>
                <select style={{ ...input, minHeight: '44px' }} value={ui.smokerSelect} onChange={(e) => updateUi({ smokerSelect: e.target.value as any })}>
                  <option value="unanswered" disabled>{tLocal('ui.select')}</option>
                  <option value="no">{tLocal('ui.no')}</option>
                  <option value="sometimes">{tLocal('ui.sometimes')}</option>
                  <option value="every_day">{tLocal('ui.every_day')}</option>
                  <option value="prefer_not">{tLocal('ui.prefer_not')}</option>
                </select>
              </fieldset>
            )}

            {/* Incense & Mosquito Coils */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              {isLiving && (
                <label style={{ ...check, minHeight: '44px' }}>
                  <input type="checkbox" style={{ width: '20px', height: '20px' }} checked={room.request.incense} onChange={(e) => onUpdate({ request: { ...room.request, incense: e.target.checked } })} /> 
                  {tLocal('ui.incense')}
                </label>
              )}
              {isBedroom && (
                <label style={{ ...check, minHeight: '44px' }}>
                  <input type="checkbox" style={{ width: '20px', height: '20px' }} checked={room.request.mosquito_coils} onChange={(e) => onUpdate({ request: { ...room.request, mosquito_coils: e.target.checked } })} /> 
                  {tLocal('ui.mosquito_coils')}
                </label>
              )}
            </fieldset>
          </div>

          {result.error && <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{result.error}</p>}
          
          {e && (
            <>
              <IndoorChart series={e.hourly_series} />
              
              <h4 style={{ margin: '1.25rem 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tLocal('ui.recommendations', { room: room.name })}</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' }}>
                {e.plan.map((p) => (
                  <li key={p.text} style={{ display: 'grid', gridTemplateColumns: '1.75rem 1fr', gap: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5, color: '#1e293b' }}>
                    <span aria-hidden>{ICONS[p.kind]}</span>
                    <span style={{ minWidth: 0 }}>{p.text}</span>
                  </li>
                ))}
              </ul>

              <details style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#475569' }}>
                <summary style={{ cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center' }}>{tLocal('ui.what_assumed')}</summary>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                  <li><strong>{tLocal('assumptions.warning').split(':')[0]}:</strong> {tLocal('assumptions.warning').split(':')[1]}</li>
                  <li>{tLocal('assumptions.room', { area: room.request.room_area_m2, height: room.request.ceiling_height_m, windows: room.request.windows })}</li>
                  <li>{tLocal('assumptions.outdoor', { pm25: e.outdoor_pm25_now_ug_m3, time: e.hourly_series?.[0]?.time ? new Date(e.hourly_series[0].time).toLocaleTimeString() : 'now' })}</li>
                  <li>{tLocal('assumptions.physics', { ventilation: String(e.assumptions.ventilation), ach: String(e.assumptions.infiltration_rate_ach), penetration: Number(e.assumptions.penetration) * 100, decay: String(e.assumptions.decay_rate_h) })}</li>
                  <li>{tLocal('assumptions.purifier', { cadr: String(e.assumptions.purifier_effective_cadr_m3_h) })}</li>
                  <li>{tLocal('assumptions.sources', { fuel: room.request.cooking_fuel, mg: D.cooking.fuels[room.request.cooking_fuel].mg_per_h, meals: room.request.meal_times_h?.length || 3, smoking: room.request.smokers > 0 ? ` Smoking (${D.smoker.mg_per_h} mg/h).` : '', incense: room.request.incense ? ` Incense (${D.incense.mg_per_h} mg/h).` : '', coil: room.request.mosquito_coils ? ` Coil (${D.mosquito_coil.mg_per_h} mg/h).` : '' })}</li>
                  <li>{tLocal('assumptions.isolation')}</li>
                </ul>
              </details>
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="sm" variant="secondary" onClick={() => onRemove()}>{tLocal('ui.remove_room')}</Button>
          </div>
        </div>
    </div>
  );
}
