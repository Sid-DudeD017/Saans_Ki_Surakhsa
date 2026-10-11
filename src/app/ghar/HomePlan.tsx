'use client';

// "What to do": the whole home's plan for today as a checklist, in Kisan Saathi's look, with four facts on
// top (outside's worst hour, the worst and cleanest room, the one change that helps most). Advice every room
// shares ("keep the windows shut", "wear an N95") shows once, with the rooms it's for. Ticks last for today.
import React from 'react';

import { CATEGORY_COLOURS } from '../shala/airQuality';
import { aqiText, pm25Aqi } from './homeAir';
import { useGharLanguage } from './gharTranslations';
import { buildHomeSummary, buildMergedPlan, type MergedPlanItem, type RoomWithEstimate } from './summaryLogic';
import { usePlanChecks } from './usePlanChecks';

const ICONS: Record<MergedPlanItem['kind'], string> = { windows: '🪟', purifier: '🌀', source: '🔥', mask: '😷' };

type Lang = 'pa' | 'hi' | 'en';
const W = {
  facts: { en: 'Your home today', hi: 'आज आपका घर', pa: 'ਅੱਜ ਤੁਹਾਡਾ ਘਰ' },
  plan: { en: 'Your plan for today', hi: 'आज की योजना', pa: 'ਅੱਜ ਦੀ ਯੋਜਨਾ' },
  done: { en: 'done', hi: 'पूरे', pa: 'ਪੂਰੇ' },
  outsideWorst: { en: 'Outside is worst at', hi: 'बाहर सबसे ख़राब', pa: 'ਬਾਹਰ ਸਭ ਤੋਂ ਮਾੜੀ' },
  worstRoom: { en: 'Worst room', hi: 'सबसे ख़राब कमरा', pa: 'ਸਭ ਤੋਂ ਮਾੜਾ ਕਮਰਾ' },
  cleanestRoom: { en: 'Cleanest room: keep children and elders here', hi: 'सबसे साफ़ कमरा: बच्चे और बुज़ुर्ग यहाँ रहें', pa: 'ਸਭ ਤੋਂ ਸਾਫ਼ ਕਮਰਾ: ਬੱਚੇ ਅਤੇ ਬਜ਼ੁਰਗ ਇੱਥੇ ਰਹਿਣ' },
  biggest: { en: 'Helps most', hi: 'सबसे ज़्यादा मदद', pa: 'ਸਭ ਤੋਂ ਵੱਧ ਮਦਦ' },
  lowers: { en: 'lowers it by', hi: 'इतना घटाता है', pa: 'ਇੰਨਾ ਘਟਾਉਂਦਾ ਹੈ' },
  allRooms: { en: 'Every room', hi: 'हर कमरा', pa: 'ਹਰ ਕਮਰਾ' },
} satisfies Record<string, Record<Lang, string>>;

type TLocal = ReturnType<typeof useGharLanguage>['tLocal'];

/**
 * A plan item in the reader's language. In English, the model's own sentence (it has the numbers); in
 * Hindi or Punjabi, the translation when there is one, else the model's words.
 */
function planText(item: Pick<MergedPlanItem, 'key' | 'text' | 'pm25' | 'from' | 'to' | 'sourceType' | 'purifierCadr'>, tLocal: TLocal, lang: Lang) {
  if (!item.key || (lang === 'en' && item.text)) return item.text;
  const key = `plan.${item.key}`;
  const said = tLocal(key as Parameters<TLocal>[0], { pm25: item.pm25 ?? '', from: item.from ?? '', to: item.to ?? '', sourceType: item.sourceType ?? '', purifierCadr: item.purifierCadr ?? '' });
  return said === key ? item.text : said;
}

const clock = (iso: string) => (iso.length >= 16 ? iso.slice(11, 16) : iso);

interface Step {
  uid: string;
  item: MergedPlanItem;
  rooms: string[];
}

/** One step per piece of advice: the same words in several rooms become one step for those rooms. */
function steps(items: MergedPlanItem[]): Step[] {
  const out: Step[] = [];
  for (const item of items) {
    const same = out.find((s) => s.item.key === item.key && s.item.text === item.text);
    if (same) same.rooms.push(item.roomName);
    else out.push({ uid: `${item.key ?? 'plan'}|${item.text}`, item, rooms: [item.roomName] });
  }
  return out;
}

export function HomePlan({ rooms }: { rooms: RoomWithEstimate[] }) {
  const { tLocal, language } = useGharLanguage();
  const lang: Lang = language === 'hi' || language === 'pa' ? language : 'en';
  const summary = buildHomeSummary(rooms);
  const plan = steps(buildMergedPlan(rooms));
  const { checks, toggleCheck, ready } = usePlanChecks();
  if (!ready) return null;

  const done = plan.filter((s) => checks[s.uid]).length;
  const estimated = rooms.filter((r) => r.estimate).length;
  const facts: { icon: string; title: string; body: React.ReactNode; pm25?: number }[] = [];
  if (summary.outsidePeak) facts.push({ icon: '☁️', title: W.outsideWorst[lang], body: clock(summary.outsidePeak.time), pm25: summary.outsidePeak.pm25 });
  if (summary.worstRoom) {
    facts.push({
      icon: '🔥',
      title: W.worstRoom[lang],
      body: (
        <>
          {summary.worstRoom.name}
          {summary.worstRoom.sourceKey && (
            <span style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
              {(() => {
                const src = plan.find((p) => p.item.key === summary.worstRoom!.sourceKey && p.rooms.includes(summary.worstRoom!.name));
                return src ? planText(src.item, tLocal, lang) : planText({ ...summary.worstRoom.sourceParams, key: summary.worstRoom.sourceKey, text: '' } as MergedPlanItem, tLocal, lang);
              })()}
            </span>
          )}
        </>
      ),
      pm25: summary.worstRoom.pm25,
    });
  }
  if (summary.cleanestRoom) facts.push({ icon: '✨', title: W.cleanestRoom[lang], body: summary.cleanestRoom.name, pm25: summary.cleanestRoom.pm25 });
  if (summary.biggestChange) {
    const step = plan.find((s) => s.item.key === summary.biggestChange!.actionKey);
    facts.push({
      icon: '⚡',
      title: W.biggest[lang],
      body: (
        <>
          {step ? planText(step.item, tLocal, lang) : summary.biggestChange.actionKey}
          <span style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
            {summary.biggestChange.roomName}: {W.lowers[lang]} {Math.round(summary.biggestChange.reduction)} µg/m³
          </span>
        </>
      ),
    });
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section aria-labelledby="ghar-facts" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 id="ghar-facts" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
          📋 {W.facts[lang]}
        </h2>
        {facts.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>{tLocal('summary.noData')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))', gap: '0.75rem' }}>
            {facts.map((f) => {
              const a = f.pm25 !== undefined ? pm25Aqi(f.pm25) : null;
              const c = a ? CATEGORY_COLOURS[a.category] : null;
              return (
                <div key={f.title} style={{ background: c?.tint ?? '#ffffff', border: `1px solid ${c?.edge ?? '#e2e8f0'}`, borderRadius: '1.25rem', padding: '0.9rem 1rem', display: 'grid', gap: '0.35rem', alignContent: 'start' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    {f.icon} {f.title}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', overflowWrap: 'anywhere' }}>{f.body}</div>
                  {a && c && (
                    <div style={{ fontSize: '0.85rem', color: c.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      AQI {aqiText(a)} · PM2.5 {Math.round(f.pm25!)} µg/m³
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {plan.length > 0 && (
        <section aria-labelledby="ghar-plan" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 id="ghar-plan" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
              ✅ {W.plan[lang]}
            </h2>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f766e' }}>
              {done} / {plan.length} {W.done[lang]}
            </span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.6rem' }}>
            {plan.map((s) => {
              const on = !!checks[s.uid];
              const forAll = s.rooms.length > 1 && s.rooms.length === estimated;
              return (
                <li key={s.uid}>
                  <label
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto auto minmax(0, 1fr)',
                      gap: '0.75rem',
                      alignItems: 'start',
                      padding: '0.85rem 1rem',
                      borderRadius: '1rem',
                      background: on ? '#f0fdfa' : '#ffffff',
                      border: `1px solid ${on ? '#99f6e4' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleCheck(s.uid)} style={{ width: '1.35rem', height: '1.35rem', marginTop: '0.1rem', accentColor: '#0d9488' }} />
                    <span aria-hidden="true" style={{ fontSize: '1.3rem', lineHeight: 1.2 }}>
                      {ICONS[s.item.kind]}
                    </span>
                    <span style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.98rem', lineHeight: 1.45, color: on ? '#64748b' : '#0f172a', textDecoration: on ? 'line-through' : 'none' }}>{planText(s.item, tLocal, lang)}</span>
                      <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {(forAll ? [W.allRooms[lang]] : s.rooms).map((r) => (
                          <span key={r} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '9999px', padding: '0.1rem 0.5rem' }}>
                            {r}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
