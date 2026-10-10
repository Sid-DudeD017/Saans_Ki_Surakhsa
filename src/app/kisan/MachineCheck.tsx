'use client';

// "Are your machines enough?" (K10) and what to do about the gap (K11). The farm card and the machine
// list go to the coverage engine (POST /v1/farm/coverage); the gap goes to the zero-burn planner
// (POST /v1/farm/plan), which finds CHC machines on dry days. Nothing is booked here: the farmer asks
// for it in the Plan conversation, which files the request with the department.
import React, { useState } from 'react';

import { Alert, Badge, Button, Card } from '../../components/ui';
import { coverageInput, daysToClear, farmStore, planInput, verdictOf, type MachineType, type Verdict } from './farmProfile';
import { KisanError, getCoverage, getPlan, type CoverageResponse, type Language, type PlanResponse } from './kisanApi';
import type { Tab } from './KisanTabs';
import { cardLabel, dayMonth, machineLabel, say, sayWith } from './strings';

const COLOURS: Record<Verdict, { ink: string; wash: string }> = {
  enough: { ink: '#15803d', wash: '#f0fdf4' },
  almost: { ink: '#b45309', wash: '#fffbeb' },
  short: { ink: '#b91c1c', wash: '#fef2f2' },
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const BIG: React.CSSProperties = { minHeight: '3rem', fontSize: '1rem' };

export function MachineCheck({ language, onGo }: { language: Language; onGo: (tab: Tab) => void }) {
  const farm = farmStore.use();
  const [result, setResult] = useState<{ key: string; coverage: CoverageResponse } | null>(null);
  const [plan, setPlan] = useState<{ key: string; plan: PlanResponse } | null>(null);
  const [busy, setBusy] = useState<'check' | 'plan' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noLocation, setNoLocation] = useState(false);

  const input = coverageInput(farm);
  const key = JSON.stringify(input);
  const planReq = planInput(farm);
  const planKey = JSON.stringify(planReq);
  const current = result?.key === key ? result.coverage : null;
  const currentPlan = plan?.key === planKey ? plan.plan : null;

  const why = (e: unknown) => (e instanceof KisanError && e.status !== 0 ? e.message : say('network', language));

  async function check() {
    if ('missing' in input) return;
    setBusy('check');
    setError(null);
    try {
      setResult({ key, coverage: await getCoverage(input) });
    } catch (e) {
      setError(why(e));
    } finally {
      setBusy(null);
    }
  }

  async function findChc() {
    if (!planReq) {
      setNoLocation(true);
      return;
    }
    setNoLocation(false);
    setBusy('plan');
    setError(null);
    try {
      setPlan({ key: planKey, plan: await getPlan(planReq) });
    } catch (e) {
      setError(why(e));
    } finally {
      setBusy(null);
    }
  }

  // The fastest machine the farmer already has, or the Super Seeder CHCs usually rent out.
  const capacities = current?.assumptions.capacity_acres_per_day ?? {};
  const own = farm.machines.map((m) => m.type).filter((t): t is MachineType => t !== 'other');
  const helper: MachineType = own.sort((a, b) => (capacities[b] ?? 0) - (capacities[a] ?? 0))[0] ?? 'super_seeder';

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
      ) : !current ? (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
          {result && <p style={{ margin: 0, color: '#475569' }}>{say('changed', language)}</p>}
          <Button size="lg" onClick={() => void check()} disabled={busy !== null} style={BIG}>
            {busy === 'check' ? say('checking', language) : say(result ? 'checkAgain' : 'checkButton', language)}
          </Button>
        </div>
      ) : (
        <VerdictPanel coverage={current} wheatBy={farm.wheatBy} helper={helper} language={language} />
      )}

      {current && current.gap_acres > 0 && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))' }}>
          <Button size="lg" onClick={() => void findChc()} disabled={busy !== null} style={BIG}>
            {busy === 'plan' ? say('planning', language) : `🚜 ${say('findChc', language)}`}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => onGo('shop')} style={BIG}>
            🛒 {say('seeShop', language)}
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

      {current && currentPlan && <ChcPlan plan={currentPlan} language={language} onAsk={() => onGo('plan')} />}
    </Card>
  );
}

function VerdictPanel({ coverage, wheatBy, helper, language }: { coverage: CoverageResponse; wheatBy?: string; helper: MachineType; language: Language }) {
  const verdict = verdictOf(coverage.coverage_pct);
  const colour = COLOURS[verdict];
  const more = daysToClear(coverage.gap_acres, helper, coverage.assumptions.capacity_acres_per_day);
  return (
    <div
      role="status"
      style={{ marginTop: '0.75rem', border: `2px solid ${colour.ink}`, background: colour.wash, borderRadius: '0.75rem', padding: '0.9rem 1rem', display: 'grid', gap: '0.4rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: colour.ink }}>{say(`verdict_${verdict}`, language)}</span>
        <span style={{ fontSize: '2.25rem', fontWeight: 800, color: colour.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {coverage.coverage_pct}%
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={coverage.coverage_pct}
        aria-label={say('checkTitle', language)}
        style={{ height: '0.6rem', borderRadius: '1rem', background: '#e2e8f0', overflow: 'hidden' }}
      >
        <div style={{ width: `${Math.min(100, coverage.coverage_pct)}%`, height: '100%', background: colour.ink }} />
      </div>
      <p style={{ margin: 0, color: '#0f172a' }}>
        {sayWith('coveredBy', language, {
          covered: fmt(coverage.covered_acres),
          total: fmt(coverage.paddy_acres),
          date: wheatBy ? dayMonth(wheatBy, language) : '',
        })}
      </p>
      {coverage.gap_acres > 0 && (
        <>
          <p style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>
            {sayWith('gapLeft', language, { gap: fmt(coverage.gap_acres), straw: fmt(coverage.straw_t) })}
          </p>
          <p style={{ margin: 0, color: '#334155' }}>{sayWith('smokeIfBurnt', language, { kg: Math.round(coverage.pm25_kg) })}</p>
          {more > 0 && (
            <p style={{ margin: 0, color: '#334155' }}>{sayWith('moreDays', language, { days: fmt(more), machine: machineLabel(helper, language) })}</p>
          )}
        </>
      )}
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{say('assumedDry', language)}</p>
    </div>
  );
}

function ChcPlan({ plan, language, onAsk }: { plan: PlanResponse; language: Language; onAsk: () => void }) {
  const short = plan.unmet.reduce((sum, u) => sum + u.acres, 0);
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
      <div>
        <Button size="lg" variant="outline" onClick={onAsk} style={BIG}>
          💬 {say('askInChat', language)}
        </Button>
      </div>
    </section>
  );
}
