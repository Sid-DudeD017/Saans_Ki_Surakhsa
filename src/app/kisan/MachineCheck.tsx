'use client';

// "Are your machines enough?" (K10), at the top of the Machines tab: a ring with how much of the paddy
// his machines clear before the wheat deadline, what's left, and how many more days of a machine would
// close it. It works itself out whenever the farm card or the machine list changes (POST
// /v1/farm/coverage; in demo mode the TypeScript copy of the engine). Below it, the season strip
// (machinePlan.ts) and the zero-burn plan (K11, POST /v1/farm/plan), which finds CHC machines on dry
// days. Nothing is booked here: "Ask Saathi to book it" sends the request in the Plan conversation,
// which files it with the department.
import React, { useEffect, useState } from 'react';

import { Alert, Badge, Button, Card } from '../../components/ui';
import { coverageInput, farmStore, planInput, verdictOf, type FarmProfile, type Verdict } from './farmProfile';
import { KisanError, getCoverage, getPlan, type CoverageResponse, type Language, type PlanResponse } from './kisanApi';
import type { Tab } from './KisanTabs';
import { daysLeft, seasonDays, whatIf, type DayKind } from './machinePlan';
import { cardLabel, dayMonth, dayWord, machineLabel, say, sayWith, type StringKey } from './strings';

const COLOURS: Record<Verdict, { ink: string; wash: string }> = {
  enough: { ink: '#15803d', wash: '#f0fdf4' },
  almost: { ink: '#b45309', wash: '#fffbeb' },
  short: { ink: '#b91c1c', wash: '#fef2f2' },
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const BIG: React.CSSProperties = { minHeight: '3rem', fontSize: '1rem' };

export function MachineCheck({ language, onGo, onAsk }: { language: Language; onGo: (tab: Tab) => void; onAsk: (text: string) => void }) {
  const farm = farmStore.use();
  const [result, setResult] = useState<{ key: string; coverage: CoverageResponse } | null>(null);
  const [plan, setPlan] = useState<{ key: string; plan: PlanResponse } | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noLocation, setNoLocation] = useState(false);

  const input = coverageInput(farm);
  const key = JSON.stringify(input);
  const planReq = planInput(farm);
  const planKey = JSON.stringify(planReq);
  const current = result?.key === key ? result.coverage : null;
  const currentPlan = plan?.key === planKey ? plan.plan : null;

  const why = (e: unknown) => (e instanceof KisanError && e.status !== 0 ? e.message : say('network', language));

  // Work it out whenever the farm or the machines change; a short pause lets a few taps on − / + settle.
  useEffect(() => {
    if ('missing' in input) return;
    let live = true;
    const t = window.setTimeout(() => {
      getCoverage(input).then(
        (coverage) => {
          if (!live) return;
          setResult({ key, coverage });
          setError(null);
        },
        (e) => live && setError(why(e)),
      );
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // `input` is rebuilt every render; its JSON (`key`) is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function findChc() {
    if (!planReq) {
      setNoLocation(true);
      return;
    }
    setNoLocation(false);
    setPlanning(true);
    setError(null);
    try {
      setPlan({ key: planKey, plan: await getPlan(planReq) });
    } catch (e) {
      setError(why(e));
    } finally {
      setPlanning(false);
    }
  }

  return (
    <Card padding="md">
      <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>⚖️ {say('checkTitle', language)}</h2>

      {'missing' in input ? (
        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.25rem' }}>
          {input.missing.map((m) => (
            <p key={m} style={{ margin: 0, color: '#475569' }}>
              {say(m === 'paddy' ? 'needPaddy' : 'needDates', language)}
            </p>
          ))}
        </div>
      ) : current ? (
        <Gauge coverage={current} farm={farm} language={language} />
      ) : (
        <p role="status" style={{ margin: '0.75rem 0 0', color: '#475569' }}>
          {say('workingOut', language)}
        </p>
      )}

      {current && current.gap_acres > 0 && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))' }}>
          <Button size="lg" onClick={() => onGo('shop')} style={BIG}>
            {say('closeGap', language)} →
          </Button>
          <Button size="lg" variant="secondary" onClick={() => void findChc()} disabled={planning} style={BIG}>
            {planning ? say('planning', language) : `🚜 ${say('findChc', language)}`}
          </Button>
        </div>
      )}

      {noLocation && !planReq && (
        <p role="alert" style={{ margin: '0.75rem 0 0', color: '#b45309' }}>
          {say('needLocation', language)}
        </p>
      )}

      {error && (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {current && <SeasonStrip farm={farm} plan={currentPlan} language={language} />}

      {current && currentPlan && <ChcPlan plan={currentPlan} language={language} onAsk={onAsk} />}
    </Card>
  );
}

/** The coverage ring, what's left, and how many more days would close it. */
function Gauge({ coverage, farm, language }: { coverage: CoverageResponse; farm: FarmProfile; language: Language }) {
  const verdict = verdictOf(coverage.coverage_pct);
  const colour = COLOURS[verdict];
  const pct = Math.min(100, coverage.coverage_pct);
  const r = 42;
  const around = 2 * Math.PI * r;
  const next = coverage.gap_acres > 0 ? whatIf(farm) : null;
  return (
    <div
      role="status"
      style={{ marginTop: '0.75rem', border: `2px solid ${colour.ink}`, background: colour.wash, borderRadius: '0.75rem', padding: '0.9rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}
    >
      <svg
        width="112"
        height="112"
        viewBox="0 0 112 112"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={coverage.coverage_pct}
        aria-label={`${say(`verdict_${verdict}`, language)}: ${coverage.coverage_pct}%`}
        style={{ flex: 'none' }}
      >
        <circle cx="56" cy="56" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          className="kisan-motion"
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke={colour.ink}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * around} ${around}`}
          transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dasharray 450ms ease-out' }}
        />
        <text x="56" y="62" textAnchor="middle" fontSize="24" fontWeight="800" fill={colour.ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {coverage.coverage_pct}%
        </text>
      </svg>
      <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0, flex: '1 1 12rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: colour.ink }}>{say(`verdict_${verdict}`, language)}</span>
        <span id="kisan-gap" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
          {coverage.gap_acres > 0
            ? sayWith('gapNotCovered', language, { gap: fmt(coverage.gap_acres) })
            : sayWith('allCovered', language, { total: fmt(coverage.paddy_acres) })}
        </span>
        <span style={{ color: '#334155' }}>
          {sayWith('coveredBy', language, {
            covered: fmt(coverage.covered_acres),
            total: fmt(coverage.paddy_acres),
            date: farm.wheatBy ? dayMonth(farm.wheatBy, language) : '',
          })}
        </span>
        {coverage.gap_acres > 0 && (
          <span style={{ fontSize: '0.9rem', color: '#475569' }}>
            {sayWith('atRisk', language, { straw: fmt(coverage.straw_t), kg: Math.round(coverage.pm25_kg) })}
          </span>
        )}
        {next && (
          <span id="kisan-what-if" style={{ fontWeight: 700, color: '#15803d' }}>
            {sayWith('whatIfDays', language, { days: fmt(next.extraDays), dayWord: dayWord(next.extraDays), machine: machineLabel(next.machine, language), pct: next.pct })}
          </span>
        )}
      </div>
    </div>
  );
}

const DAY_STYLE: Record<DayKind, React.CSSProperties> = {
  own: { background: '#b45309' },
  chc: { background: '#15803d' },
  rain: { background: '#60a5fa' },
  idle: { background: '#ffffff', border: '1px dashed #cbd5e1' },
};

/** One square per day from harvest to the wheat deadline: his machines, CHC bookings, rain, idle days. */
function SeasonStrip({ farm, plan, language }: { farm: FarmProfile; plan: PlanResponse | null; language: Language }) {
  const days = seasonDays(farm, { rain: plan?.rain_dates_used ?? [], chc: plan?.plan.map((b) => b.date) ?? [] });
  if (!days.length || !farm.harvestDate || !farm.wheatBy) return null;
  const left = daysLeft(farm);
  const count = (k: DayKind) => days.filter((d) => d.kind === k).length;
  const kinds = (['own', 'chc', 'rain', 'idle'] as const).filter((k) => count(k) > 0);
  const summary = kinds.map((k) => `${count(k)} ${say(`day_${k}` as StringKey, language)}`).join(', ');
  return (
    <section style={{ marginTop: '1rem', display: 'grid', gap: '0.45rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.95rem' }}>
        <strong style={{ color: '#0f172a' }}>
          {sayWith('seasonTitle', language, { from: dayMonth(farm.harvestDate, language), to: dayMonth(farm.wheatBy, language) })}
        </strong>
        {left !== null && (
          <span style={{ color: left < 0 ? '#b91c1c' : '#b45309', fontWeight: 600 }}>
            {left < 0 ? say('sowingPassed', language) : sayWith('daysLeftToSow', language, { n: left })}
          </span>
        )}
      </div>
      <div
        id="kisan-season"
        role="img"
        aria-label={summary}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(days.length, 31)}, minmax(0, 1fr))`, gap: 3 }}
      >
        {days.map((d) => (
          <span
            key={d.date}
            data-kind={d.kind}
            title={`${dayMonth(d.date, language)}: ${say(`day_${d.kind}` as StringKey, language)}`}
            style={{ height: 18, borderRadius: 3, boxSizing: 'border-box', opacity: d.past ? 0.45 : 1, ...DAY_STYLE[d.kind] }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#475569' }}>
        {kinds.map((k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, boxSizing: 'border-box', ...DAY_STYLE[k] }} />
            {count(k)} · {say(`day_${k}` as StringKey, language)}
          </span>
        ))}
      </div>
      {!plan && <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{say('seasonHint', language)}</p>}
    </section>
  );
}

function ChcPlan({ plan, language, onAsk }: { plan: PlanResponse; language: Language; onAsk: (text: string) => void }) {
  const short = plan.unmet.reduce((sum, u) => sum + u.acres, 0);
  const items = plan.plan.map((b) => `${machineLabel(b.machine, language)}, ${dayMonth(b.date, language)}, ${b.chc_name}`).join('; ');
  return (
    <section style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gap: '0.6rem' }}>
      <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {say('chcPlanTitle', language)}
        {plan.demo_data && (
          <Badge variant="warning" size="sm">
            {say('demoChc', language)}
          </Badge>
        )}
      </h3>
      {plan.plan.length === 0 ? (
        <p style={{ margin: 0, color: '#475569' }}>{say('noChcFree', language)}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
          {plan.plan.map((b) => (
            <li key={`${b.date}-${b.chc_id}-${b.machine}`} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem 0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>
                📅 {dayMonth(b.date, language)} · {machineLabel(b.machine, language)}
              </div>
              <div style={{ fontSize: '0.95rem', color: '#334155', overflowWrap: 'anywhere' }}>
                {sayWith('fromChc', language, { chc: b.chc_name })}
                {b.distance_km !== null ? ` (${fmt(b.distance_km)} km)` : ''} · {fmt(b.acres)} {say('killa', language)} · {rupees(b.cost_inr)}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: 0, fontWeight: 700, color: '#15803d' }}>{sayWith('withThese', language, { pct: plan.coverage_after_pct })}</p>
      {short > 0 && (
        <p style={{ margin: 0, color: '#b45309' }}>
          {cardLabel('short', language)}: {fmt(short)} {say('killa', language)}
        </p>
      )}
      {plan.rain_dates_used.length > 0 && (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>🌧️ {sayWith('rainDays', language, { n: plan.rain_dates_used.length })}</p>
      )}
      <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>{say('notBookedYet', language)}</p>
      {plan.plan.length > 0 && (
        <div>
          <Button size="lg" onClick={() => onAsk(sayWith('bookPlanMsg', language, { items }))} style={BIG}>
            💬 {say('askSaathiBook', language)}
          </Button>
        </div>
      )}
    </section>
  );
}
