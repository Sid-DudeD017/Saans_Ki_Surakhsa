'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../lib/i18n';
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
  const { t } = useLanguage();
  const [family, setFamily] = useState<FamilyState>(() => loadFamilyState());

  // Save to localStorage on change
  useEffect(() => {
    saveFamilyState(family);
  }, [family]);

  // Extract outdoor forecast from the first available estimate
  const outdoorForecast = React.useMemo(() => {
    for (const key in estimates) {
      const est = estimates[key].estimate;
      if (est?.hourly_series) {
        return est.hourly_series.map(s => ({ time: s.time, value: s.outdoor_pm25_ug_m3 }));
      }
    }
    return [];
  }, [estimates]);

  const rawEstimates = React.useMemo(() => {
    const res: Record<string, IndoorEstimate> = {};
    for (const key in estimates) {
      if (estimates[key].estimate) res[key] = estimates[key].estimate;
    }
    return res;
  }, [estimates]);

  // Purifier comparison logic
  const [purifierEstimate, setPurifierEstimate] = useState<IndoorEstimate | null>(null);
  
  const bedroom = rooms.find(r => r.id === 'master_bedroom' || r.name.toLowerCase().includes('bedroom'));
  
  useEffect(() => {
    let mounted = true;
    if (!bedroom) return;
    if (bedroom.request.purifier_cadr_m3_h > 0) {
      // Already has a purifier, no need for hypothetical comparison
      setPurifierEstimate(null);
      return;
    }

    // Only run if we have the baseline estimate
    if (!estimates[bedroom.id]?.estimate) return;

    // Fetch hypothetical
    const cadr = Math.max(50, Math.round((5 * bedroom.request.room_area_m2 * bedroom.request.ceiling_height_m) / 50) * 50) || 200;
    const hypotheticalReq = { ...bedroom.request, purifier_cadr_m3_h: cadr };
    
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
      role: 'Family Member',
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

  if (outdoorForecast.length < 24) return null; // Need baseline data to function

  return (
    <section style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Family's Day</h2>
        <button onClick={addMember} style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600 }}>
          + Add Person
        </button>
      </div>

      {family.members.length === 0 && (
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Add family members to see their daily PM2.5 exposure based on their schedule.</p>
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
                  placeholder="Name (Optional)" 
                  value={member.name} 
                  onChange={e => updateMember(member.id, { name: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #94a3b8', borderRadius: '0.25rem', flex: 1, minWidth: '150px' }}
                />
                <input 
                  type="text" 
                  placeholder="Role (e.g. Child, Parent)" 
                  value={member.role} 
                  onChange={e => updateMember(member.id, { role: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #94a3b8', borderRadius: '0.25rem', flex: 1, minWidth: '150px' }}
                />
                <button onClick={() => removeMember(member.id)} style={{ padding: '0.5rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#475569' }}>Schedule:</strong>
                {member.blocks.map((block, i) => (
                  <div key={block.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="time" value={block.start} onChange={e => {
                      const newBlocks = [...member.blocks];
                      newBlocks[i].start = e.target.value;
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }} />
                    <span>to</span>
                    <input type="time" value={block.end} onChange={e => {
                      const newBlocks = [...member.blocks];
                      newBlocks[i].end = e.target.value;
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }} />
                    
                    <select value={block.locationId} onChange={e => {
                      const newBlocks = [...member.blocks];
                      newBlocks[i].locationId = e.target.value;
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', flex: 1 }}>
                      <option value="out">Outdoors</option>
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>

                    <button onClick={() => {
                      const newBlocks = member.blocks.filter((_, idx) => idx !== i);
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ padding: '0.4rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #cbd5e1', borderRadius: '0.25rem', color: '#64748b', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={() => {
                  const newBlocks = [...member.blocks, { id: 'b' + Date.now(), start: '12:00', end: '13:00', locationId: 'out' }];
                  updateMember(member.id, { blocks: newBlocks });
                }} style={{ alignSelf: 'flex-start', fontSize: '0.85rem', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  + Add time block
                </button>
              </div>

              <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.95rem', color: '#334155' }}>
                {exposure.missingHours > 0.1 ? (
                  <div style={{ color: '#b45309' }}>
                    <strong>Incomplete schedule:</strong> Missing {exposure.missingHours} hours of coverage. Please fill out the full 24 hours to see the daily average.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div><strong>Today's average:</strong> {exposure.average} µg/m³</div>
                    {exposure.worstStretch && (
                      <div>
                        <strong>Worst stretch:</strong> {exposure.worstStretch.start}–{exposure.worstStretch.end} in {exposure.worstStretch.locationId === 'out' ? 'Outdoors' : rooms.find(r => r.id === exposure.worstStretch!.locationId)?.name} (about {exposure.worstStretch.average} µg/m³)
                      </div>
                    )}
                    {comp && (
                      <div style={{ color: '#0369a1', marginTop: '0.5rem', fontWeight: 500 }}>
                        If the {bedroom?.name.toLowerCase() || 'bedroom'} purifier runs at night, {member.name || member.role || 'this person'}'s day falls from {comp.baselineAvg} to {comp.improvedAvg} µg/m³! (Modelled scenario)
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
