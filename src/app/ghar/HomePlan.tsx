'use client';
import React from 'react';
import { Card } from '../../components/ui';
import { useGharLanguage } from './gharTranslations';
import { buildHomeSummary, buildMergedPlan, type RoomWithEstimate, type MergedPlanItem } from './summaryLogic';
import { usePlanChecks } from './usePlanChecks';

const ICONS = { windows: '🪟', purifier: '🌀', source: '🔥', mask: '😷' };

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function translatePlanItem(item: MergedPlanItem, tLocal: any) {
  if (!item.key) {
    return tLocal('plan.fallback', { text: item.text });
  }
  return tLocal(`plan.${item.key}` as any, {
    pm25: item.pm25,
    from: item.from,
    to: item.to,
    sourceType: item.sourceType,
    purifierCadr: item.purifierCadr
  });
}

export function HomePlan({ rooms }: { rooms: RoomWithEstimate[] }) {
  const { tLocal } = useGharLanguage();
  const summary = buildHomeSummary(rooms);
  const planItems = buildMergedPlan(rooms);
  const { checks, toggleCheck, ready } = usePlanChecks();

  if (!ready) return null;

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Executive Intelligence */}
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📋 Your Home Today: Executive Intelligence
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Automated micro-analysis from indoor aerosol dispersion models.</p>
          </div>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '1rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>
            Updated 1 min ago
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Outdoor Peak */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>☁ OUTDOOR PEAK WARNING</span>
            {summary.outsidePeak ? (
              <>
                <div style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706' }}>{Math.round(summary.outsidePeak.pm25)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>µg/m³</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                  Outside air will peak around <strong>{formatTime(summary.outsidePeak.time)}</strong>. Keep perimeters closed & balconies sealed.
                </p>
              </>
            ) : <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{tLocal('summary.noData')}</p>}
          </div>

          {/* Critical Zone */}
          <div style={{ background: '#fff1f2', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #fecdd3' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#be123c', letterSpacing: '0.05em' }}>🔥 MOST CRITICAL ZONE</span>
            {summary.worstRoom ? (
              <>
                <div style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#e11d48' }}>{Math.round(summary.worstRoom.pm25)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#be123c', fontWeight: 600 }}>µg/m³</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#881337', lineHeight: 1.5 }}>
                  The worst room is <strong>{summary.worstRoom.name}</strong>. {summary.worstRoom.sourceKey ? translatePlanItem({ key: summary.worstRoom.sourceKey, ...summary.worstRoom.sourceParams } as any, tLocal) : 'Hazardous particle spikes observed.'}
                </p>
              </>
            ) : <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#fda4af' }}>{tLocal('summary.noData')}</p>}
          </div>

          {/* Cleanest Zone */}
          <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', letterSpacing: '0.05em' }}>✨ CLEANEST ZONE</span>
            {summary.cleanestRoom ? (
              <>
                <div style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a' }}>{Math.round(summary.cleanestRoom.pm25)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>µg/m³</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', lineHeight: 1.5 }}>
                  <strong>{summary.cleanestRoom.name}</strong> is currently optimal. Safe refuge sanctuary for elderly and children.
                </p>
              </>
            ) : <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#86efac' }}>{tLocal('summary.noData')}</p>}
          </div>

          {/* Highest Impact */}
          <div style={{ background: '#eff6ff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.05em' }}>⚡ HIGHEST SINGLE IMPACT</span>
            {summary.biggestChange ? (
              <>
                <div style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb' }}>-{Math.round(summary.biggestChange.reduction)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600 }}>µg/m³</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                  {translatePlanItem({ key: summary.biggestChange.actionKey, ...summary.biggestChange.actionParams } as any, tLocal)} Drops daily exposure burden significantly!
                </p>
              </>
            ) : <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#93c5fd' }}>{tLocal('summary.noData')}</p>}
          </div>
        </div>
      </div>

    </div>
  );
}
