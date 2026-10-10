'use client';

// The Shop tab (K14–K17): what stops stubble burning, from data/seed/kisan_shop.json. Renting from a
// CHC comes first; buying links only to the government subsidy portal. With the farm card filled in,
// items are ranked by how much of this farm's gap they clear (shopRank.ts), and the decomposer says
// whether there's still time for it to work.
import React, { useState } from 'react';

import { Badge, Button, Card } from '../../components/ui';
import { farmStore, type FarmProfile } from './farmProfile';
import { KisanError, getChcs, type ChcsResponse, type Language } from './kisanApi';
import { SHOP, type ShopItem } from './shopCatalogue';
import { rankShop, type Fit } from './shopRank';
import { dayMonth, inDays, say, sayWith } from './strings';

type Filter = 'fits' | 'machines' | 'decomposer';

const GREEN = '#15803d';
const BIG: React.CSSProperties = { minHeight: '3rem', fontSize: '1rem' };
const CHC_KM = 25;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const range = ([from, to]: [number, number]) => (from === to ? rupees(from) : `${rupees(from)}–${rupees(to)}`);
// Demo seed numbers look like +91 00000 00001; a number nobody answers is worse than none.
const realPhone = (phone: string | null | undefined) => !!phone && !/0000/.test(phone.replace(/\s/g, ''));

export function Shop({ language }: { language: Language }) {
  const farm = farmStore.use();
  const fit = rankShop(farm, SHOP.items);
  const [filter, setFilter] = useState<Filter>('fits');

  const byId = new Map(SHOP.items.map((i) => [i.id, i]));
  const fits = new Map(fit?.fits.map((f) => [f.id, f]) ?? []);
  const top = fit && fit.gapAcres > 0 ? fit.fits.find((f) => (f.gainAcres ?? 0) > 0)?.id : undefined;

  const shown: ShopItem[] =
    filter === 'machines'
      ? SHOP.items.filter((i) => i.kind === 'machine')
      : filter === 'decomposer'
        ? SHOP.items.filter((i) => i.kind === 'decomposer')
        : fit
          ? fit.fits.map((f) => byId.get(f.id)!)
          : SHOP.items;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card padding="md">
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>🛒 {say('shopTitle', language)}</h2>
        <p style={{ margin: '0.35rem 0 0.9rem', lineHeight: 1.5, color: '#334155' }}>{say('shopIntro', language)}</p>
        <div role="group" aria-label={say('shopTitle', language)} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {(['fits', 'machines', 'decomposer'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'outline'}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              style={{ minHeight: '2.75rem' }}
            >
              {say(f === 'fits' ? 'filterFits' : f === 'machines' ? 'filterMachines' : 'filterDecomposer', language)}
            </Button>
          ))}
        </div>
        {filter === 'fits' && !fit && <p style={{ margin: '0.75rem 0 0', color: '#475569' }}>{say('fitsNeedFarm', language)}</p>}
        {filter === 'fits' && fit && fit.gapAcres <= 0 && <p style={{ margin: '0.75rem 0 0', color: GREEN, fontWeight: 600 }}>✓ {say('noGap', language)}</p>}
      </Card>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
        {shown.map((item) => (
          <li key={item.id}>
            <ShopCard item={item} fit={fits.get(item.id)} gap={fit?.gapAcres} window={fit?.windowDays} top={item.id === top} farm={farm} language={language} />
          </li>
        ))}
      </ul>

      <footer style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, display: 'grid', gap: '0.35rem' }}>
        <p style={{ margin: 0 }}>{say('shopDisclaimer', language)}</p>
        <p style={{ margin: 0 }}>
          {say('shopSources', language)}:{' '}
          {Object.values(SHOP.sources)
            .filter((s) => s.url)
            .map((s, i) => (
              <React.Fragment key={s.url}>
                {i > 0 && ' · '}
                <a href={s.url!} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>
                  {s.title}
                </a>{' '}
                ({dayMonth(s.checked_on, language)} {s.checked_on.slice(0, 4)})
              </React.Fragment>
            ))}
        </p>
      </footer>
    </div>
  );
}

function ShopCard({ item, fit, gap, window, top, farm, language }: {
  item: ShopItem;
  fit?: Fit;
  gap?: number;
  window?: number;
  top: boolean;
  farm: FarmProfile;
  language: Language;
}) {
  const [chcs, setChcs] = useState<ChcsResponse | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'noLocation' | 'untracked' | 'error'>('idle');
  const [error, setError] = useState('');

  async function rent() {
    const loc = farm.location;
    const where = loc?.lat !== undefined && loc.lon !== undefined ? { lat: loc.lat, lon: loc.lon } : loc?.village ? { village: loc.village } : null;
    if (!item.engine_type) {
      setState('untracked'); // the CHC list only records the four machines the check knows
      return;
    }
    if (!where) {
      setState('noLocation');
      return;
    }
    setState('busy');
    try {
      setChcs(await getChcs(where, item.engine_type, CHC_KM));
      setState('idle');
    } catch (e) {
      setError(e instanceof KisanError && e.status !== 0 ? e.message : say('network', language));
      setState('error');
    }
  }

  const portal = item.links.find((l) => l.kind === 'subsidy');

  return (
    <Card padding="md" style={top ? { borderColor: GREEN, borderWidth: 2 } : undefined}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{item.names[language]}</h3>
          {top && (
            <Badge variant="success" size="sm">
              ✓ {say('fitsBadge', language)}
            </Badge>
          )}
        </div>
        <p style={{ margin: 0, lineHeight: 1.5, color: '#334155' }}>{item.does[language]}</p>

        {/* What it does for this farm */}
        {fit && gap !== undefined && gap > 0 && fit.gainAcres !== null && item.kind === 'machine' && (
          <p style={{ margin: 0, fontWeight: 600, color: fit.gainAcres > 0 ? GREEN : '#b45309' }}>
            {fit.gainAcres <= 0
              ? say('needsTractor', language)
              : fit.gainAcres >= gap - 0.01
                ? sayWith('clearsGap', language, { gap: fmt(gap), inDays: inDays(Number(fmt(fit.days ?? 0)), language) })
                : sayWith('clearsPart', language, { acres: fmt(fit.gainAcres), gap: fmt(gap) })}
          </p>
        )}
        {item.kind === 'decomposer' && window !== undefined && (
          <p style={{ margin: 0, fontWeight: 600, color: fit?.tooLate ? '#b91c1c' : GREEN }}>
            {sayWith(fit?.tooLate ? 'tooLate' : 'inTime', language, { need: item.min_window_days ?? 25, have: window })}
          </p>
        )}

        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.2rem', fontSize: '0.95rem', color: '#334155' }}>
          <li>{item.acres_per_day !== null ? sayWith('acresPerDay', language, { n: fmt(item.acres_per_day) }) : item.kind === 'machine' ? say('notInCheck', language) : null}</li>
          <li>
            {item.price_inr
              ? sayWith('priceAbout', language, { amount: item.price_inr.amount, per: item.price_inr.per[language] })
              : item.kind === 'machine'
                ? say('priceAsk', language)
                : say('askKvk', language)}
          </li>
          {item.subsidy.map((s, i) => (
            <li key={i}>
              {s.part && <strong>{s.part[language]}: </strong>}
              {sayWith('subsidyFarmer', language, { pct: s.farmer.pct, max: range(s.farmer.max_inr) })}.{' '}
              {sayWith('subsidyChc', language, { pct: s.chc.pct, max: range(s.chc.max_inr) })}.
            </li>
          ))}
        </ul>

        {(item.rent_from_chc || portal) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))', gap: '0.5rem' }}>
            {item.rent_from_chc && (
              <Button size="lg" onClick={() => void rent()} disabled={state === 'busy'} style={BIG}>
                {state === 'busy' ? say('findingChcs', language) : `🚜 ${say('rentFromChc', language)}`}
              </Button>
            )}
            {portal && (
              <a
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...BIG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1.5px solid #0369a1', color: '#0369a1', fontWeight: 600, textDecoration: 'none' }}
              >
                {say('applySubsidy', language)}
              </a>
            )}
          </div>
        )}

        {state === 'noLocation' && <p role="alert" style={{ margin: 0, color: '#b45309' }}>{say('needLocation', language)}</p>}
        {state === 'untracked' && <p style={{ margin: 0, color: '#475569' }}>{say('chcUntracked', language)}</p>}
        {state === 'error' && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
        {chcs && <ChcList chcs={chcs} machine={item.engine_type ?? item.id} language={language} />}
      </div>
    </Card>
  );
}

function ChcList({ chcs, machine, language }: { chcs: ChcsResponse; machine: string; language: Language }) {
  if (chcs.chcs.length === 0) return <p style={{ margin: 0, color: '#475569' }}>{sayWith('noChcHas', language, { km: CHC_KM })}</p>;
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      {chcs.demo_data && (
        <div>
          <Badge variant="warning" size="sm">
            {say('demoChc', language)}
          </Badge>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
        {chcs.chcs.slice(0, 3).map((c) => {
          const m = c.machines.find((x) => x.machine === machine);
          return (
            <li key={c.chc_id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>{c.name}</div>
              <div style={{ fontSize: '0.95rem', color: '#334155' }}>
                {c.distance_km !== null && c.distance_km !== undefined ? sayWith('chcAway', language, { km: fmt(c.distance_km) }) : ''}
                {m?.cost_per_acre_inr ? ` · ${sayWith('chcRate', language, { rate: m.cost_per_acre_inr.toLocaleString('en-IN') })}` : ''}
              </div>
              {realPhone(c.phone) && (
                <a href={`tel:${c.phone!.replace(/\s/g, '')}`} style={{ display: 'inline-block', marginTop: '0.25rem', color: '#0369a1', fontWeight: 600 }}>
                  📞 {c.phone}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
