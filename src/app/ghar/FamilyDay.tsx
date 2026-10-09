'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useGharLanguage } from './gharTranslations';
import { loadFamilyState, saveFamilyState, type FamilyState, type FamilyMember, type TimeBlock } from './familyState';
import { calculateDailyExposure, generatePurifierComparison } from './familyLogic';
import type { RoomState } from './homeState';
import type { IndoorEstimate } from '../../../packages/aqi/indoor';
import { getIndoorEstimate } from './gharApi';

export interface FamilyDayProps {
  rooms: RoomState[];
  estimates: Record<string, { estimate?: IndoorEstimate }>;
}

export const FamilyDay: React.FC<FamilyDayProps> = ({ rooms, estimates }) => {
  const { tLocal } = useGharLanguage();
  const [family, setFamily] = useState<FamilyState>(() => loadFamilyState());

  // Save to localStorage on change
  useEffect(() => {
    saveFamilyState(family);
  }, [family]);

  // Extract outdoor forecast from the first available estimate
  let outdoorForecast: { time: string, value: number }[] = [];
  for (const key in estimates) {
    const est = estimates[key].estimate;
    if (est?.hourly_series) {
      outdoorForecast = est.hourly_series.map(s => ({ time: s.time, value: s.outdoor_pm25_ug_m3 }));
      break;
    }
  }

  const rawEstimates = React.useMemo(() => {
    const res: Record<string, IndoorEstimate> = {};
    for (const key in estimates) {
      if (estimates[key].estimate) res[key] = estimates[key].estimate;
    }
    return res;
  }, [estimates]);

  // Purifier comparison logic
  const [purifierEstimate, setPurifierEstimate] = useState<IndoorEstimate | null>(null);
  
  const bedroom = rooms.find(r => r.id === 'master_bedroom' || r.name.toLowerCase().includes('bedroom') || r.name === tLocal('rooms.master_bedroom'));
  
  useEffect(() => {
    let mounted = true;
    if (!bedroom) return;
    if (bedroom.request.purifier_cadr_m3_h > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPurifierEstimate(null);
      return;
    }

    if (!estimates[bedroom.id]?.estimate) return;

    const cadr = Math.max(50, Math.round((5 * bedroom.request.room_area_m2 * bedroom.request.ceiling_height_m) / 50) * 50) || 200;
    const hypotheticalReq = { ...bedroom.request, purifier_cadr_m3_h: cadr }; // VERIFY
    
    getIndoorEstimate(hypotheticalReq).then(est => {
      if (mounted) setPurifierEstimate(est);
    }).catch(() => {
      if (mounted) setPurifierEstimate(null);
    });

    return () => { mounted = false; };
  }, [bedroom, estimates]);

  const addMember = () => {
    const newMember: FamilyMember = {
      id: 'person_' + Date.now(),
      name: '',
      role: '',
      blocks: [
        { id: 'b1', start: '22:00', end: '06:00', locationId: bedroom?.id || rooms[0]?.id || 'out' },
        { id: 'b2', start: '06:00', end: '22:00', locationId: 'out' }
      ]
    };
    setFamily(prev => ({ members: [...prev.members, newMember] }));
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>) => {
    setFamily(prev => ({
      members: prev.members.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const removeMember = (id: string) => {
    setFamily(prev => ({ members: prev.members.filter(m => m.id !== id) }));
  };

  if (outdoorForecast.length < 24) return null;

  return (
    <section style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{tLocal('family.title')}</h2>
        <button onClick={addMember} style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600, minHeight: '44px' }}>
          {tLocal('family.add_person')}
        </button>
      </div>

      {family.members.length === 0 && (
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{tLocal('family.empty')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {family.members.map(member => {
          const exposure = calculateDailyExposure(member.blocks, rawEstimates, outdoorForecast);
          const comp = bedroom ? generatePurifierComparison(member.blocks, rawEstimates, purifierEstimate, bedroom.id, outdoorForecast) : null;
          
          return (
            <div key={member.id} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder={tLocal('family.name_opt')}
                  value={member.name} 
                  onChange={e => updateMember(member.id, { name: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #94a3b8', borderRadius: '0.25rem', flex: 1, minWidth: '150px', minHeight: '44px' }}
                />
                <input 
                  type="text" 
                  placeholder={tLocal('family.role_opt')}
                  value={member.role} 
                  onChange={e => updateMember(member.id, { role: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #94a3b8', borderRadius: '0.25rem', flex: 1, minWidth: '150px', minHeight: '44px' }}
                />
                <button onClick={() => removeMember(member.id)} style={{ padding: '0.5rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', minHeight: '44px' }}>
                  {tLocal('family.remove')}
                </button>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#475569' }}>{tLocal('family.schedule')}</strong>
                {member.blocks.map((block, i) => (
                  <div key={block.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="time" value={block.start} onChange={e => {
                      const newBlocks = [...member.blocks];
                      newBlocks[i].start = e.target.value;
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', minHeight: '44px' }} />
                    <span>{tLocal('family.to')}</span>
                    <input type="time" value={block.end} onChange={e => {
                      const newBlocks = [...member.blocks];
                      newBlocks[i].end = e.target.value;
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', minHeight: '44px' }} />
                    
                    <select value={block.locationId} onChange={e => {
                      const newBlocks = [...member.blocks];
                      newBlocks[i].locationId = e.target.value;
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', flex: 1, minHeight: '44px' }}>
                      <option value="out">{tLocal('family.outdoors')}</option>
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>

                    <button onClick={() => {
                      const newBlocks = member.blocks.filter((_, idx) => idx !== i);
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #cbd5e1', borderRadius: '0.25rem', color: '#64748b', cursor: 'pointer', minHeight: '44px' }}>
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={() => {
                  const newBlocks = [...member.blocks, { id: 'b' + Date.now(), start: '12:00', end: '13:00', locationId: 'out' }];
                  updateMember(member.id, { blocks: newBlocks });
                }} style={{ alignSelf: 'flex-start', fontSize: '0.85rem', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', minHeight: '44px' }}>
                  {tLocal('family.add_block')}
                </button>
              </div>

              <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.95rem', color: '#334155' }}>
                {exposure.missingHours > 0.1 ? (
                  <div style={{ color: '#b45309' }}>
                    <strong>{tLocal('family.incomplete', { missing: exposure.missingHours })}</strong>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div><strong>{tLocal('family.avg')}</strong> {exposure.average} µg/m³</div>
                    {exposure.worstStretch && (
                      <div>
                        <strong>{tLocal('family.worst')}</strong> {exposure.worstStretch.start}–{exposure.worstStretch.end} {tLocal('family.in')} {exposure.worstStretch.locationId === 'out' ? tLocal('family.outdoors') : rooms.find(r => r.id === exposure.worstStretch!.locationId)?.name} (about {exposure.worstStretch.average} µg/m³)
                      </div>
                    )}
                    {comp && (
                      <div style={{ color: '#0369a1', marginTop: '0.5rem', fontWeight: 500 }}>
                        {tLocal('family.purifier_comp', {
                          room: bedroom?.name.toLowerCase() || 'bedroom',
                          name: member.name || member.role || 'this person',
                          baseline: comp.baselineAvg,
                          improved: comp.improvedAvg
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
