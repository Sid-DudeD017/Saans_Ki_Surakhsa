'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useGharLanguage } from './gharTranslations';
import { loadFamilyState, saveFamilyState, type FamilyState, type FamilyMember, type TimeBlock } from './familyState';
import { calculateDailyExposure, generatePurifierComparison } from './familyLogic';
import type { RoomState } from './homeState';
import type { IndoorEstimate } from '../../../packages/aqi/indoor';
import { getIndoorEstimate } from './gharApi';
import { aqiText, pm25Aqi } from './homeAir';
import { CATEGORY_COLOURS } from '../shala/airQuality';

export interface FamilyDayProps {
  rooms: RoomState[];
  estimates: Record<string, { estimate?: IndoorEstimate }>;
  /** The station's PM2.5 now, so the purifier comparison runs on the same outdoor air as the rooms. */
  livePm25?: number | null;
}

export const FamilyDay: React.FC<FamilyDayProps> = ({ rooms, estimates, livePm25 }) => {
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
    
    getIndoorEstimate(hypotheticalReq, livePm25).then(est => {
      if (mounted) setPurifierEstimate(est);
    }).catch(() => {
      if (mounted) setPurifierEstimate(null);
    });

    return () => { mounted = false; };
  }, [bedroom, estimates, livePm25]);

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
    setFamily(prev => ({ ...prev, members: [...prev.members, newMember] }));
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>) => {
    setFamily(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const removeMember = (id: string) => {
    setFamily(prev => ({ ...prev, members: prev.members.filter(m => m.id !== id) }));
  };

  if (outdoorForecast.length < 24) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ minWidth: 0, flex: '1 1 16rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
            👨‍👩‍👧 {tLocal('family.title')}
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.92rem', color: '#475569' }}>{tLocal('family.intro')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => {
            const newSaved = [...(family.savedResults || [])];
            const timestamp = new Date().toISOString();
            let added = 0;
            
            family.members.forEach(m => {
              const exposure = calculateDailyExposure(m.blocks, rawEstimates, outdoorForecast);
              const comp = bedroom ? generatePurifierComparison(m.blocks, rawEstimates, purifierEstimate, bedroom.id, outdoorForecast) : null;
              if (exposure.missingHours <= 0.1 && exposure.average !== null) {
                newSaved.unshift({
                  id: 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                  timestamp,
                  memberName: m.name || 'Unnamed Member',
                  role: m.role || 'N/A',
                  baselineAvg: exposure.average,
                  improvedAvg: comp ? comp.improvedAvg : null,
                  blocks: m.blocks
                });
                added++;
              }
            });

            if (added > 0) {
              const newFamily = { ...family, members: [], savedResults: newSaved };
              setFamily(newFamily);
              saveFamilyState(newFamily);
            } else {
              saveFamilyState(family);
            }

            const btn = document.getElementById('save-btn');
            if (btn) {
              btn.innerHTML = added > 0 ? `✓ Saved ${added} Results` : '✓ Saved Config';
              btn.style.background = '#10b981';
              btn.style.color = '#fff';
              setTimeout(() => {
                btn.innerHTML = `💾 ${tLocal('family.save')}`;
                btn.style.background = '#ffffff';
                btn.style.color = '#334155';
              }, 2500);
            }
          }} id="save-btn" style={{ minHeight: '2.6rem', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '9999px', padding: '0 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'inherit' }}>
            💾 {tLocal('family.save')}
          </button>
          <button onClick={addMember} style={{ minHeight: '2.6rem', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '9999px', padding: '0 1.1rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', fontFamily: 'inherit' }}>
            {tLocal('family.add_person')}
          </button>
        </div>
      </div>

      {family.members.length === 0 && (
        <div style={{ background: '#ffffff', padding: '2rem 1rem', textAlign: 'center', borderRadius: '1.25rem', border: '1px dashed #cbd5e1' }}>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>{tLocal('family.empty')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {family.members.map((member, index) => {
          const exposure = calculateDailyExposure(member.blocks, rawEstimates, outdoorForecast);
          const comp = bedroom ? generatePurifierComparison(member.blocks, rawEstimates, purifierEstimate, bedroom.id, outdoorForecast) : null;
          
          return (
            <div key={member.id} data-member={index} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: 'clamp(1rem, 4vw, 1.35rem)', background: '#ffffff', borderRadius: '1.25rem', border: '1px solid #e2e8f0' }}>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>{tLocal('family.name_opt')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Aarav Sharma"
                    value={member.name} 
                    onChange={e => updateMember(member.id, { name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: 500, outline: 'none' }}
                  />
                </div>
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>{tLocal('family.role_opt')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Child (Age 7, Mild Asthma)"
                    value={member.role} 
                    onChange={e => updateMember(member.id, { role: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: 500, outline: 'none' }}
                  />
                </div>
                <div>
                  <button onClick={() => removeMember(member.id)} style={{ padding: '0.75rem 1.25rem', backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}>
                    {tLocal('family.remove')}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{tLocal('family.where_day')}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  {member.blocks.map((block, i) => (
                    <div key={block.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, background: '#fff', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem 0.5rem', maxWidth: '100%', boxSizing: 'border-box', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
                        <span style={{ color: '#64748b', fontSize: '1rem', marginLeft: '0.25rem' }}>⏱</span>
                        <input type="time" value={block.start} onChange={e => {
                          const newBlocks = member.blocks.map((b, idx) => idx === i ? { ...b, start: e.target.value } : b);
                          updateMember(member.id, { blocks: newBlocks });
                        }} style={{ padding: '0.25rem', border: 'none', background: 'transparent', fontWeight: 600, color: '#0f172a', outline: 'none' }} />
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>{tLocal('family.to')}</span>
                        <input type="time" value={block.end} onChange={e => {
                          const newBlocks = member.blocks.map((b, idx) => idx === i ? { ...b, end: e.target.value } : b);
                          updateMember(member.id, { blocks: newBlocks });
                        }} style={{ padding: '0.25rem', border: 'none', background: 'transparent', fontWeight: 600, color: '#0f172a', outline: 'none' }} />
                      </div>
                      
                      <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 0.25rem' }}></div>

                      <select value={block.locationId} onChange={e => {
                        const newBlocks = member.blocks.map((b, idx) => idx === i ? { ...b, locationId: e.target.value } : b);
                        updateMember(member.id, { blocks: newBlocks });
                      }} style={{ flex: 1, padding: '0.5rem', border: 'none', background: 'transparent', outline: 'none', color: '#334155', fontWeight: 500, minWidth: 'min(100%, 10rem)', cursor: 'pointer' }}>
                        <option value="out">🌳 {tLocal('family.outdoors')}</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>

                      <button onClick={() => {
                        const newBlocks = member.blocks.filter((_, idx) => idx !== i);
                        updateMember(member.id, { blocks: newBlocks });
                      }} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.375rem', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.background = '#fef2f2'; }} onMouseOut={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }} title="Remove time block">
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <button onClick={() => {
                      const newBlocks = [...member.blocks, { id: 'b' + Date.now(), start: '12:00', end: '13:00', locationId: 'out' }];
                      updateMember(member.id, { blocks: newBlocks });
                    }} style={{ fontSize: '0.8rem', color: '#0f766e', background: '#ccfbf1', border: 'none', borderRadius: '1rem', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#99f6e4'} onMouseOut={e => e.currentTarget.style.background = '#ccfbf1'}>
                      {tLocal('family.add_block')}
                    </button>
                  </div>
                </div>
              </div>

              {exposure.missingHours <= 0.1 && exposure.average !== null && (() => {
                const a = pm25Aqi(exposure.average);
                const c = CATEGORY_COLOURS[a.category];
                const pct = comp ? Math.round(((comp.baselineAvg - comp.improvedAvg) / comp.baselineAvg) * 100) : 0;
                return (
                  <div style={{ display: 'grid', gap: '0.75rem', background: c.tint, border: `1px solid ${c.edge}`, borderRadius: '1rem', padding: '1rem' }}>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>{tLocal('family.avg')}</span>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: c.ink }}>AQI</span>
                        <strong style={{ fontSize: '2.25rem', lineHeight: 1, fontWeight: 900, color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{aqiText(a)}</strong>
                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>PM2.5 <strong>{exposure.average}</strong> µg/m³</span>
                      </span>
                      {exposure.worstStretch && (
                        <span style={{ fontSize: '0.9rem', color: '#334155' }}>
                          {tLocal('family.worst')} <strong>{exposure.worstStretch.start}–{exposure.worstStretch.end}</strong> {tLocal('family.in')}{' '}
                          {exposure.worstStretch.locationId === 'out' ? tLocal('family.outdoors') : rooms.find(r => r.id === exposure.worstStretch!.locationId)?.name} (~{exposure.worstStretch.average} µg/m³)
                        </span>
                      )}
                    </div>
                    {comp && (
                      <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '0.9rem', padding: '0.7rem 0.85rem', display: 'grid', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700 }}>🌀 {tLocal('family.purifier_line', { room: bedroom?.name ?? '' })}</span>
                        <span style={{ fontWeight: 800, color: '#14532d', fontVariantNumeric: 'tabular-nums' }}>
                          {comp.baselineAvg} → {comp.improvedAvg} µg/m³ · {tLocal('family.less', { pct })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              {exposure.missingHours > 0.1 && (
                 <div style={{ color: '#b45309', background: '#fffbeb', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.9rem', border: '1px solid #fde68a' }}>
                   <strong>{tLocal('family.incomplete', { missing: exposure.missingHours })}</strong>
                 </div>
              )}
            </div>
          );
        })}
      </div>

      {family.savedResults && family.savedResults.length > 0 && (
        <div style={{ paddingTop: '0.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#0f172a' }}>{tLocal('family.saved')}</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {family.savedResults.map(res => (
              <div key={res.id} style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1.25rem', padding: '1rem', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <strong style={{ color: '#0f172a' }}>{res.memberName}</strong>
                      <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '0.1rem 0.5rem', borderRadius: '1rem', color: '#475569' }}>{res.role}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Saved on {new Date(res.timestamp).toLocaleDateString()} at {new Date(res.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{tLocal('family.without')}</div>
                      <div style={{ fontWeight: 800, color: '#ef4444' }}>{res.baselineAvg} µg/m³</div>
                    </div>
                    {res.improvedAvg !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>{tLocal('family.with_purifier')}</div>
                        <div style={{ fontWeight: 800, color: '#15803d' }}>{res.improvedAvg} µg/m³</div>
                      </div>
                    )}
                    <button onClick={() => {
                      const newSaved = family.savedResults.filter(s => s.id !== res.id);
                      const newFamily = { ...family, savedResults: newSaved };
                      setFamily(newFamily);
                      saveFamilyState(newFamily);
                    }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.375rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }} title="Delete saved result" onMouseOver={e => e.currentTarget.style.background = '#fecaca'} onMouseOut={e => e.currentTarget.style.background = '#fee2e2'}>
                      ✕
                    </button>
                  </div>
                </div>

                {res.blocks && res.blocks.length > 0 && (
                  <div style={{ marginTop: '0.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{tLocal('family.where_day')}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 13rem), 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                      {res.blocks.map(b => (
                        <div key={b.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 700, color: '#475569' }}>{b.start} - {b.end}</span>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <span style={{ color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.locationId === 'out' ? tLocal('family.outdoors') : rooms.find(r => r.id === b.locationId)?.name || b.locationId}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
