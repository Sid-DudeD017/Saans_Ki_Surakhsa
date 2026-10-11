'use client';

// Saans Command's case console (P4), as its own part of the app: the officer's queue (nearest deadline
// first), the cases on a map you can move and zoom, and one case at a time with the farmer's help request
// before any penalty. Mock mode runs on example cases; live, on /v1/cases from the local stack, signed in
// as one of the demo officers, so Cedar shows their district only.
import React, { useCallback, useEffect, useState } from 'react';

import { BottomTabs, TabPanel, useUrlTab, type TabItem } from '../../components/BottomTabs';
import { SlippyMap, type Pin } from '../../components/SlippyMap';
import { Alert, Container } from '../../components/ui';
import { SPACES } from '../../lib/space';
import { CaseDetailPanel, TYPE_NAMES, when } from './CaseDetailPanel';
import { DEFAULT_OFFICER, OFFICERS, USE_MOCKS, getCase, listCases, type CaseDetail, type CaseStatus, type CaseSummary } from './commandApi';
import { PIN_COLOURS, TONE, caseTone, type Tone } from './tones';

const TABS = ['cases', 'map', 'case'] as const;
type CommandTab = (typeof TABS)[number];
const TAB_ITEMS: TabItem<CommandTab>[] = [
  { id: 'cases', icon: '📋', label: 'Cases' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'case', icon: '📁', label: 'Case' },
];
const ACCENT = SPACES.command.accent;

const STATUSES: [CaseStatus | '', string][] = [['OPEN', 'Open'], ['ACTION_APPROVED', 'Help approved'], ['ACTION_CHANGED', 'Changed'], ['CLOSED', 'Closed'], ['', 'All']];
const DISTRICTS: [string, string][] = [['', 'All districts'], ['Sangrur', 'Sangrur'], ['Patiala', 'Patiala'], ['unassigned', 'Unassigned']];
const TYPE_ICONS: Record<string, string> = { farm_fire: '🔥', garbage: '🗑️', vehicle: '🚚', firecrackers: '🎆', farmer_support: '🌾', kisan_grievance: '📣' };

const pinFor = (s: CaseSummary, selected: boolean): Pin => ({
  id: s.case.id,
  label: `${TYPE_NAMES[s.type] ?? s.type}, ${s.district}`,
  colour: PIN_COLOURS[s.case.status === 'CLOSED' ? 'closed' : s.hasHelpRequest ? 'help' : 'report'],
  quiet: s.case.status === 'CLOSED',
  selected,
  ...s.location,
});

export default function CommandPage() {
  const [tab, go] = useUrlTab(TABS);
  const [status, setStatus] = useState<CaseStatus | ''>('OPEN');
  const [district, setDistrict] = useState('');
  const [queue, setQueue] = useState<{ cases?: CaseSummary[]; error?: string }>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ case?: CaseDetail; error?: string }>({});
  const [reloads, setReloads] = useState(0);
  const [officer, setOfficer] = useState(DEFAULT_OFFICER);

  useEffect(() => {
    let on = true;
    listCases({ status: status || undefined, district: district || undefined }, officer).then(
      (cases) => on && setQueue({ cases }),
      (e: Error) => on && setQueue({ error: e.message }),
    );
    return () => {
      on = false;
    };
  }, [status, district, officer, reloads]);

  useEffect(() => {
    if (!selected) return;
    let on = true;
    getCase(selected, officer).then(
      (c) => on && setDetail({ case: c }),
      (e: Error) => on && setDetail({ error: e.message }),
    );
    return () => {
      on = false;
    };
  }, [selected, officer, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const open = (id: string) => {
    setSelected(id);
    go('case');
  };
  const cases = queue.cases ?? [];
  const shown = selected && detail.case?.case.id === selected ? detail.case : null;
  const picked = cases.find((s) => s.case.id === selected);

  return (
    <Container maxWidth="lg" style={{ paddingTop: '0.25rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <TabPanel id="cases" current={tab} prefix="command">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <Counts cases={cases} />
            <Filters
              status={status}
              onStatus={setStatus}
              district={district}
              onDistrict={setDistrict}
              officer={officer}
              onOfficer={(o) => {
                setOfficer(o);
                setSelected(null);
              }}
            />
            {queue.error && <Alert variant="danger" title="No queue">{queue.error}</Alert>}
            {!queue.cases && !queue.error && <p style={{ margin: 0, color: '#64748b' }}>Loading cases…</p>}
            {queue.cases && cases.length === 0 && <p style={{ margin: 0, color: '#64748b' }}>No cases match.</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))', gap: '0.75rem' }}>
              {cases.map((s) => (
                <li key={s.case.id} style={{ display: 'grid' }}>
                  <CaseCard summary={s} selected={s.case.id === selected} onOpen={() => open(s.case.id)} />
                </li>
              ))}
            </ul>
          </div>
        </TabPanel>

        <TabPanel id="map" current={tab} prefix="command">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <Legend />
            <SlippyMap label="Cases on the map" height="min(62vh, 34rem)" pins={cases.map((s) => pinFor(s, s.case.id === selected))} onPick={setSelected} />
            {picked ? (
              <CaseCard summary={picked} selected onOpen={() => go('case')} cta="Open case →" />
            ) : (
              <p style={{ margin: 0, color: '#475569' }}>
                Tap a pin to see the case. {cases.length} {cases.length === 1 ? 'case' : 'cases'} on the map.
              </p>
            )}
          </div>
        </TabPanel>

        <TabPanel id="case" current={tab} prefix="command">
          {!selected && (
            <div style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem', padding: '2.5rem 1rem', textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem' }}>
              <span aria-hidden="true" style={{ fontSize: '2.5rem' }}>
                📁
              </span>
              <p style={{ margin: 0, fontSize: '1.05rem', color: '#334155' }}>Pick a case from the list or the map.</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pill onClick={() => go('cases')}>📋 Cases</Pill>
                <Pill onClick={() => go('map')}>🗺️ Map</Pill>
              </div>
            </div>
          )}
          {selected && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <Pill onClick={() => go('cases')}>← All cases</Pill>
              </div>
              {detail.error && <Alert variant="danger" title="Couldn't open the case">{detail.error}</Alert>}
              {!shown && !detail.error && <p style={{ margin: 0, color: '#64748b' }}>Opening the case…</p>}
              {shown && <CaseDetailPanel key={`${shown.case.id}-${shown.case.version}`} detail={shown} officer={officer} onChanged={reload} />}
            </div>
          )}
        </TabPanel>
      </div>

      <BottomTabs tabs={TAB_ITEMS} current={tab} onChange={go} prefix="command" label="Command sections" accent={ACCENT} space="command" />
    </Container>
  );
}

function Pill({ children, onClick, on }: { children: React.ReactNode; onClick: () => void; on?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        minHeight: '2.5rem',
        padding: '0 0.95rem',
        borderRadius: '9999px',
        border: `1.5px solid ${on ? ACCENT : '#cbd5e1'}`,
        background: on ? SPACES.command.wash : '#ffffff',
        color: on ? ACCENT : '#334155',
        fontWeight: on ? 800 : 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {children}
    </button>
  );
}

function Counts({ cases }: { cases: CaseSummary[] }) {
  const tiles: [string, number, Tone][] = [
    ['Cases', cases.length, 'neutral'],
    ['Help requests', cases.filter((s) => s.hasHelpRequest).length, 'good'],
    ['Escalated', cases.filter((s) => s.escalatedAt).length, 'bad'],
    ['Satellite fires', cases.filter((s) => s.case.verificationStatus === 'SATELLITE_CORROBORATED').length, 'warn'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr))', gap: '0.6rem' }}>
      {tiles.map(([name, n, tone]) => (
        <div key={name} style={{ background: TONE[tone].wash, border: `1px solid ${TONE[tone].edge}`, borderRadius: '1rem', padding: '0.75rem 0.9rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: TONE[tone].ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{name}</div>
        </div>
      ))}
    </div>
  );
}

function Filters({ status, onStatus, district, onDistrict, officer, onOfficer }: {
  status: CaseStatus | '';
  onStatus: (s: CaseStatus | '') => void;
  district: string;
  onDistrict: (d: string) => void;
  officer: string;
  onOfficer: (o: string) => void;
}) {
  const row: React.CSSProperties = { display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.15rem' };
  return (
    <div style={{ display: 'grid', gap: '0.6rem', minWidth: 0 }}>
      {!USE_MOCKS && (
        <label style={{ fontSize: '0.9rem', color: '#334155', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          Signed in as
          <select value={officer} onChange={(e) => onOfficer(e.target.value)} style={{ minHeight: '2.5rem', padding: '0 0.6rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#ffffff' }}>
            {OFFICERS.map((o) => (
              <option key={o.token} value={o.token}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div role="group" aria-label="Status" style={row}>
        {STATUSES.map(([v, name]) => (
          <Pill key={v || 'all'} on={status === v} onClick={() => onStatus(v)}>
            {name}
          </Pill>
        ))}
      </div>
      <div role="group" aria-label="District" style={row}>
        {DISTRICTS.map(([v, name]) => (
          <Pill key={v || 'all'} on={district === v} onClick={() => onDistrict(v)}>
            {name}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    [PIN_COLOURS.report, 'Report'],
    [PIN_COLOURS.help, 'Farmer asked for help'],
    [PIN_COLOURS.closed, 'Closed'],
  ];
  return (
    <ul aria-label="Map key" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#334155' }}>
      {items.map(([colour, name]) => (
        <li key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span aria-hidden="true" style={{ width: '0.8rem', height: '0.8rem', borderRadius: '50%', background: colour, border: '2px solid #ffffff', boxShadow: '0 0 0 1px #cbd5e1' }} />
          {name}
        </li>
      ))}
    </ul>
  );
}

function CaseCard({ summary: s, selected, onOpen, cta }: { summary: CaseSummary; selected: boolean; onOpen: () => void; cta?: string }) {
  const tone = caseTone(s);
  const due = s.escalatedAt ? '⏫ Escalated' : s.case.status === 'CLOSED' ? 'Closed' : `Act by ${when(s.deadline)}`;
  const lines = [
    s.hasHelpRequest ? '🌾 Help request: offer a machine first' : null,
    (s.reports ?? 1) > 1 ? `${s.reports} reports merged` : null,
    s.case.verificationStatus === 'SATELLITE_CORROBORATED' ? '🛰️ Satellite saw a fire' : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected || undefined}
      data-case={s.case.id}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: '0.75rem',
        alignItems: 'start',
        padding: '0.9rem',
        borderRadius: '1rem',
        border: selected ? `2px solid ${ACCENT}` : '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: '#0f172a',
      }}
    >
      <span aria-hidden="true" style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.9rem', background: TONE[tone].wash, border: `1px solid ${TONE[tone].edge}`, display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}>
        {TYPE_ICONS[s.type] ?? '•'}
      </span>
      <span style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1rem' }}>{TYPE_NAMES[s.type] ?? s.type}</strong>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: TONE[tone].ink, background: TONE[tone].wash, border: `1px solid ${TONE[tone].edge}`, borderRadius: '9999px', padding: '0.1rem 0.55rem', whiteSpace: 'nowrap' }}>{due}</span>
        </span>
        <span style={{ fontSize: '0.88rem', color: '#475569' }}>📍 {s.district}</span>
        {lines.length > 0 && <span style={{ fontSize: '0.85rem', color: '#334155' }}>{lines.join(' · ')}</span>}
        <span style={{ fontSize: '0.82rem', color: '#64748b', overflowWrap: 'anywhere' }}>{s.case.evidenceSummary}</span>
        {cta && <span style={{ marginTop: '0.2rem', fontWeight: 800, color: ACCENT }}>{cta}</span>}
      </span>
    </button>
  );
}
