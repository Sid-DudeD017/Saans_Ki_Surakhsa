'use client';
import React from 'react';
import { Card } from '../../components/ui';
import { useLanguage } from '../../lib/i18n';
import { buildHomeSummary, buildMergedPlan, type RoomWithEstimate, type MergedPlanItem } from './summaryLogic';
import { usePlanChecks } from './usePlanChecks';
import type { TranslationStrings } from '../../lib/i18n';

const ICONS = { windows: '🪟', purifier: '🌀', source: '🔥', mask: '😷' };

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function translatePlanItem(item: MergedPlanItem, t: TranslationStrings) {
  if (!item.key || !(item.key in t.gharPlan)) {
    return t.gharPlan.fallback.replace('{{text}}', item.text);
  }
  let str = t.gharPlan[item.key as keyof typeof t.gharPlan];
  str = str.replace('{{pm25}}', String(item.pm25 ?? ''));
  str = str.replace('{{from}}', item.from ?? '');
  str = str.replace('{{to}}', item.to ?? '');
  str = str.replace('{{sourceType}}', item.sourceType ?? '');
  str = str.replace('{{purifierCadr}}', String(item.purifierCadr ?? ''));
  return str;
}

export function HomePlan({ rooms }: { rooms: RoomWithEstimate[] }) {
  const { t } = useLanguage();
  const summary = buildHomeSummary(rooms);
  const planItems = buildMergedPlan(rooms);
  const { checks, toggleCheck, ready } = usePlanChecks();

  if (!ready) return null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card padding="lg">
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0f172a' }}>{t.gharSummary.title}</h2>
        {summary.outsidePeak ? (
          <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'grid', gap: '0.5rem', color: '#334155' }}>
            {summary.outsidePeak && (
              <li>{t.gharSummary.outsidePeak.replace('{{pm25}}', String(summary.outsidePeak.pm25)).replace('{{time}}', formatTime(summary.outsidePeak.time))}</li>
            )}
            {summary.worstRoom && (
              <li>
                {t.gharSummary.worstRoom
                  .replace('{{room}}', summary.worstRoom.name)
                  .replace('{{pm25}}', String(summary.worstRoom.pm25))
                  .replace('{{source}}', summary.worstRoom.sourceKey ? ` — ${translatePlanItem({ key: summary.worstRoom.sourceKey, ...summary.worstRoom.sourceParams } as any, t)}` : '')}
              </li>
            )}
            {summary.cleanestRoom && (
              <li>
                {t.gharSummary.cleanestRoom
                  .replace('{{room}}', summary.cleanestRoom.name)
                  .replace('{{pm25}}', String(summary.cleanestRoom.pm25))}
              </li>
            )}
            {summary.biggestChange && (
              <li>
                {t.gharSummary.biggestChange
                  .replace('{{action}}', translatePlanItem({ key: summary.biggestChange.actionKey, ...summary.biggestChange.actionParams } as any, t))
                  .replace('{{reduction}}', String(summary.biggestChange.reduction))}
              </li>
            )}
          </ul>
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>{t.gharSummary.noData}</p>
        )}
      </Card>

      {planItems.length > 0 && (
        <Card padding="lg">
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#0f172a' }}>{t.gharSummary.titlePlan}</h3>
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
                      {translatePlanItem(item, t)}
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
