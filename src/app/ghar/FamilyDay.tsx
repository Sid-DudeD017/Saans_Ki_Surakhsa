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
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 Personal & Family Exposure Simulator
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Calculate modeled 24-hour toxic exposure by simulating individual family movement across rooms</p>
        </div>
        <button onClick={addMember} style={{ background: '#fff', color: '#0d9488', border: '1px solid #ccfbf1', borderRadius: '2rem', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          + Add Family Member
        </button>
      </div>

      {family.members.length === 0 && (
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{tLocal('family.empty')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {family.members.map(member => {
          const exposure = calculateDailyExposure(member.blocks, rawEstimates, outdoorForecast);
          const comp = bedroom ? generatePurifierComparison(member.blocks, rawEstimates, purifierEstimate, bedroom.id, outdoorForecast) : null;
          
          return (
            <div key={member.id} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>FAMILY MEMBER NAME</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Aarav Sharma"
                    value={member.name} 
                    onChange={e => updateMember(member.id, { name: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>ROLE / VULNERABILITY</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Child (Age 7, Mild Asthma)"
                    value={member.role} 
                    onChange={e => updateMember(member.id, { role: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => removeMember(member.id)} style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem' }}>
                    Remove
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>DAILY SCHEDULE & ROOM OCCUPANCY:</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total: 24 Hours</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {member.blocks.map((block, i) => (
                    <div key={block.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>⏱</span>
                        <input type="time" value={block.start} onChange={e => {
                          const newBlocks = [...member.blocks];
                          newBlocks[i].start = e.target.value;
                          updateMember(member.id, { blocks: newBlocks });
                        }} style={{ padding: '0.4rem', border: 'none', background: 'transparent', fontWeight: 600, color: '#334155', width: '90px' }} />
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>to</span>
                        <input type="time" value={block.end} onChange={e => {
                          const newBlocks = [...member.blocks];
                          newBlocks[i].end = e.target.value;
                          updateMember(member.id, { blocks: newBlocks });
                        }} style={{ padding: '0.4rem', border: 'none', background: 'transparent', fontWeight: 600, color: '#334155', width: '90px' }} />
                      </div>
                      
                      <select value={block.locationId} onChange={e => {
                        const newBlocks = [...member.blocks];
                        newBlocks[i].locationId = e.target.value;
                        updateMember(member.id, { blocks: newBlocks });
                      }} style={{ padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', flex: 1, minWidth: '200px', appearance: 'none', background: '#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E") no-repeat right 0.75rem center/1.25rem', color: '#334155' }}>
                        <option value="out">Outdoors / School (Ambient Air)</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name} {r.id === bedroom?.id ? '(Night Sleep)' : ''}</option>)}
                      </select>

                      <button onClick={() => {
                        const newBlocks = member.blocks.filter((_, idx) => idx !== i);
                        updateMember(member.id, { blocks: newBlocks });
                      }} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '0.5rem', color: '#94a3b8', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  <button onClick={() => {
                    const newBlocks = [...member.blocks, { id: 'b' + Date.now(), start: '12:00', end: '13:00', locationId: 'out' }];
                    updateMember(member.id, { blocks: newBlocks });
                  }} style={{ fontSize: '0.85rem', color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    + Add time block
                  </button>
                </div>
              </div>

              {exposure.missingHours <= 0.1 && (
                <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.75rem', padding: '1.25rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e', letterSpacing: '0.05em' }}>CALCULATED 24-HOUR DOSE</span>
                        <span style={{ background: '#ccfbf1', color: '#0f766e', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 600 }}>Model Scenario #1</span>
                      </div>
                      
                      <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                        Today&apos;s weighted average: <strong style={{ color: '#ef4444' }}>{exposure.average} µg/m³</strong> | 
                        {exposure.worstStretch && (
                          <span>
                             Worst stretch: <strong>{exposure.worstStretch.start} - {exposure.worstStretch.end}</strong> in {exposure.worstStretch.locationId === 'out' ? 'Outdoors' : rooms.find(r => r.id === exposure.worstStretch!.locationId)?.name} 
                            <span style={{ color: '#ef4444' }}> (~{exposure.worstStretch.average} µg/m³)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {comp && (
                      <div style={{ background: '#fff', border: '1px solid #10b981', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>PURIFIER IMPACT</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                          {comp.baselineAvg} → {comp.improvedAvg} µg/m³
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                          {Math.round(((comp.baselineAvg - comp.improvedAvg) / comp.baselineAvg) * 100)}% exposure reduction!
                        </div>
                      </div>
                    )}
                  </div>

                  {comp && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #ccfbf1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#0f766e' }}>Simulated if {bedroom?.name} purifier runs at night</span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Clean Air Target Achievable</span>
                      </div>
                      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ height: '100%', width: '80%', background: '#10b981' }}></div>
                        <div style={{ height: '100%', width: '20%', background: '#ef4444' }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                        <span>0 µg/m³ (WHO)</span>
                        <span>{comp.baselineAvg} µg/m³ (Current Baseline)</span>
                      </div>
                    </div>
                  )}

                </div>
              )}
              {exposure.missingHours > 0.1 && (
                 <div style={{ color: '#b45309', background: '#fffbeb', padding: '1rem', borderRadius: '0.5rem' }}>
                   <strong>{tLocal('family.incomplete', { missing: exposure.missingHours })}</strong>
                 </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1rem 0' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
