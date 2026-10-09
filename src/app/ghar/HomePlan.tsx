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
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card padding="lg">
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0f172a' }}>{tLocal('summary.title')}</h2>
        {summary.outsidePeak ? (
          <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'grid', gap: '0.5rem', color: '#334155' }}>
            {summary.outsidePeak && (
              <li>{tLocal('summary.outsidePeak', { pm25: summary.outsidePeak.pm25, time: formatTime(summary.outsidePeak.time) })}</li>
            )}
            {summary.worstRoom && (
              <li>
                {tLocal('summary.worstRoom', { room: summary.worstRoom.name, pm25: summary.worstRoom.pm25 })}
                {summary.worstRoom.sourceKey ? ` — ${translatePlanItem({ key: summary.worstRoom.sourceKey, ...summary.worstRoom.sourceParams } as any, tLocal)}` : ''}
              </li>
            )}
            {summary.cleanestRoom && (
              <li>
                {tLocal('summary.cleanestRoom', { room: summary.cleanestRoom.name, pm25: summary.cleanestRoom.pm25 })}
              </li>
            )}
            {summary.biggestChange && (
              <li>
                {tLocal('summary.biggestChange', { action: translatePlanItem({ key: summary.biggestChange.actionKey, ...summary.biggestChange.actionParams } as any, tLocal), reduction: summary.biggestChange.reduction })}
              </li>
            )}
          </ul>
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>{tLocal('summary.noData')}</p>
        )}
      </Card>

      {planItems.length > 0 && (
        <Card padding="lg">
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#0f172a' }}>{tLocal('summary.titlePlan')}</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {planItems.map(item => {
              const checked = checks[item.uid] || false;
              return (
                <label key={item.uid} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: checked ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                  <input 
                    type="checkbox" 
                    checked={checked} 
                    onChange={() => toggleCheck(item.uid)}
                    style={{ marginTop: '0.25rem', width: '1.25rem', height: '1.25rem' }} 
                  />
                  <div style={{ opacity: checked ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{ICONS[item.kind as keyof typeof ICONS]}</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{item.roomName}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', textDecoration: checked ? 'line-through' : 'none' }}>
                      {translatePlanItem(item, tLocal)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
