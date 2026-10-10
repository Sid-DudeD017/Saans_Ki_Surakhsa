'use client';

// The Shop tab (K14–K17): what stops stubble burning, from data/seed/kisan_shop.json. Renting from a
// CHC comes first; buying links only to the government subsidy portal. With the farm card filled in, it
// opens on the best way to clear this farm's gap: the machine and CHC that clear the most of it in the
// days the CHC is free this season, what that costs at the CHC's rate, and "Ask Saathi to book it",
// which sends the request in the Plan conversation (shopRank.ts rentOptions). Everything else follows
// as short rows, grouped by whether it clears the gap in time; a row opens to its details and subsidy.
import React, { useEffect, useState } from 'react';

import { Badge, Button, Card } from '../../components/ui';
import { farmStore, type FarmProfile } from './farmProfile';
import { KisanError, getChcs, type ChcsResponse, type Language } from './kisanApi';
import { SHOP, type ShopItem } from './shopCatalogue';
import { rankShop, rentOptions, type Fit, type RentOption } from './shopRank';
import { dayMonth, dayWord, inDays, machineLabel, say, sayWith, type StringKey } from './strings';

const GREEN = '#15803d';
const BIG: React.CSSProperties = { minHeight: '3rem', fontSize: '1rem' };
const CHC_KM = 25;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const range = ([from, to]: [number, number]) => (from === to ? rupees(from) : `${rupees(from)}–${rupees(to)}`);
// Demo seed numbers look like +91 00000 00001; a number nobody answers is worse than none.
const realPhone = (phone: string | null | undefined) => !!phone && !/0000/.test(phone.replace(/\s/g, ''));

type Group = 'inTime' | 'part' | 'other' | 'all';

function where(farm: FarmProfile) {
  const loc = farm.location;
  return loc?.lat !== undefined && loc.lon !== undefined ? { lat: loc.lat, lon: loc.lon } : loc?.village ? { village: loc.village } : null;
}

function groupOf(item: ShopItem, fit: Fit | undefined, gap: number): Group {
  if (!fit || fit.tooLate || fit.gainAcres === null || fit.gainAcres <= 0) return 'other';
  return fit.gainAcres >= gap - 0.01 ? 'inTime' : 'part';
}

export function Shop({ language, onAsk }: { language: Language; onAsk: (text: string) => void }) {
  const farm = farmStore.use();
  const fit = rankShop(farm, SHOP.items);
  const place = where(farm);
  const season = farm.harvestDate && farm.wheatBy ? { harvest_date: farm.harvestDate, wheat_deadline: farm.wheatBy } : undefined;
  const gap = fit?.gapAcres ?? 0;

  // Which CHCs have each machine that would help, and when they're free this season.
  const helpful = fit && gap > 0
    ? [...new Set(fit.fits.flatMap((f) => {
        const item = SHOP.items.find((i) => i.id === f.id);
        return item?.engine_type && item.rent_from_chc && (f.gainAcres ?? 0) > 0 ? [item.engine_type] : [];
      }))]
    : [];
  const lookup = place && helpful.length ? JSON.stringify({ place, season, helpful }) : null;
  const [found, setFound] = useState<{ key: string; chcs: Record<string, ChcsResponse | undefined> } | null>(null);
  useEffect(() => {
    if (!lookup || !place) return;
    let live = true;
    void Promise.all(helpful.map((m) => getChcs(place, m, CHC_KM, season).then((r) => [m, r] as const, () => [m, undefined] as const))).then(
      (pairs) => live && setFound({ key: lookup, chcs: Object.fromEntries(pairs) }),
    );
    return () => {
      live = false;
    };
    // The lookup key holds everything the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup]);
  const chcs = found?.key === lookup ? found.chcs : null;
  const options = fit && chcs ? rentOptions(fit, SHOP.items, chcs) : [];
  const demo = !!chcs && Object.values(chcs).some((r) => r?.demo_data);

  const fits = new Map(fit?.fits.map((f) => [f.id, f]) ?? []);
  const byId = new Map(SHOP.items.map((i) => [i.id, i]));
  const ordered = fit ? fit.fits.map((f) => byId.get(f.id)!) : SHOP.items;
  const groups: Group[] = !fit || gap <= 0 ? ['all'] : ['inTime', 'part', 'other'];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card padding="md">
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>🛒 {say('shopTitle', language)}</h2>
        <p style={{ margin: '0.35rem 0 0', lineHeight: 1.5, color: '#334155' }}>{say('shopIntro', language)}</p>
        {!fit && <p style={{ margin: '0.75rem 0 0', color: '#475569' }}>{say('fitsNeedFarm', language)}</p>}
        {fit && gap <= 0 && <p style={{ margin: '0.75rem 0 0', color: GREEN, fontWeight: 600 }}>✓ {say('noGap', language)}</p>}
        {fit && gap > 0 && farm.wheatBy && (
          <p style={{ margin: '0.75rem 0 0', fontWeight: 700, color: '#b45309' }}>
            {sayWith('forYourGap', language, { gap: fmt(gap), date: dayMonth(farm.wheatBy, language) })}
          </p>
        )}
      </Card>

      {fit && gap > 0 && (
        <BestPick
          best={options[0]}
          loading={!!lookup && !chcs}
          located={!!place}
          demo={demo}
          topFit={fit.fits.find((f) => (f.gainAcres ?? 0) > 0)}
          gap={gap}
          farm={farm}
          language={language}
          onAsk={onAsk}
        />
      )}

      {groups.map((g) => {
        const items = ordered.filter((i) => g === 'all' || groupOf(i, fits.get(i.id), gap) === g);
        if (!items.length) return null;
        return (
          <section key={g} aria-labelledby={`kisan-shop-${g}`} style={{ display: 'grid', gap: '0.5rem' }}>
            <h3 id={`kisan-shop-${g}`} style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>
              {say(`group_${g}` as StringKey, language)}
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
              {items.map((item) => (
                <li key={item.id}>
                  <ShopRow
                    item={item}
                    fit={fits.get(item.id)}
                    gap={fit ? gap : undefined}
                    window={fit?.windowDays}
                    rent={options.find((o) => o.itemId === item.id)}
                    farm={farm}
                    language={language}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

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

/** The one thing to do: rent this machine from this CHC, what it clears, what it costs, when it's free. */
function BestPick({ best, loading, located, demo, topFit, gap, farm, language, onAsk }: {
  best?: RentOption;
  loading: boolean;
  located: boolean;
  demo: boolean;
  topFit?: Fit;
  gap: number;
  farm: FarmProfile;
  language: Language;
  onAsk: (text: string) => void;
}) {
  const deadline = farm.wheatBy ? dayMonth(farm.wheatBy, language) : '';
  const topItem = topFit && SHOP.items.find((i) => i.id === topFit.id);
  const machineName = (m: string) => machineLabel(m, language);

  let body: React.ReactNode;
  if (!located || loading || !best) {
    body = (
      <>
        {topItem && (
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
            {topItem.names[language]}
          </div>
        )}
        {topFit && topFit.days !== null && (
          <p style={{ margin: 0, fontWeight: 600, color: GREEN }}>
            {sayWith('clearsGap', language, { gap: fmt(gap), inDays: inDays(Number(fmt(topFit.days)), language) })}
          </p>
        )}
        <p role="status" style={{ margin: 0, color: '#475569' }}>
          {!located ? say('pricesNeedLocation', language) : loading ? say('checkingChcs', language) : say('noRental', language)}
        </p>
        {located && !loading && topItem?.engine_type && (
          <div>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onAsk(sayWith('needMachineMsg', language, { machine: machineName(topItem.engine_type!), acres: fmt(gap), deadline }))}
              style={BIG}
            >
              💬 {say('askSaathiBook', language)}
            </Button>
          </div>
        )}
      </>
    );
  } else {
    const short = Math.max(0, gap - best.acres);
    body = (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#475569' }}>
          <span style={{ overflowWrap: 'anywhere' }}>
            {best.chc.name}
            {best.chc.distanceKm !== null ? ` · ${fmt(best.chc.distanceKm)} km` : ''}
          </span>
          {demo && (
            <Badge variant="warning" size="sm">
              {say('demoChc', language)}
            </Badge>
          )}
        </div>
        <div id="kisan-best-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
          {sayWith('rentA', language, { machine: machineName(best.machine) })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem', textAlign: 'center' }}>
          <Stat value={sayWith('acresN', language, { n: fmt(best.acres) })} label={say('statClears', language)} />
          <Stat value={rupees(best.cost)} label={sayWith('statCost', language, { rate: best.ratePerAcre.toLocaleString('en-IN') })} />
          <Stat value={best.firstFree ? dayMonth(best.firstFree, language) : say('askChc', language)} label={say('statFree', language)} />
        </div>
        {!best.enough && best.freeDays !== null && (
          <p style={{ margin: 0, color: '#b45309' }}>⚠️ {sayWith('freeOnly', language, { n: best.freeDays, dayWord: dayWord(best.freeDays) })}</p>
        )}
        {short > 0.01 && <p style={{ margin: 0, color: '#b45309' }}>{sayWith('stillShortAsk', language, { acres: fmt(short) })}</p>}
        <Button
          size="lg"
          onClick={() => onAsk(sayWith('bookOneMsg', language, { machine: machineName(best.machine), chc: best.chc.name, acres: fmt(best.acres), deadline }))}
          style={BIG}
        >
          💬 {say('askSaathiBook', language)}
        </Button>
      </>
    );
  }

  return (
    <Card padding="md" style={{ borderColor: GREEN, borderWidth: 2 }}>
      <section id="kisan-best" aria-label={say('bestForYou', language)} style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <Badge variant="success" size="sm">
            ★ {say('bestForYou', language)}
          </Badge>
        </div>
        {body}
      </section>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.25rem', minWidth: 0 }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</div>
    </div>
  );
}

/** One line of what it does for this farm: clears all, part, or why not. */
function fitLine(item: ShopItem, fit: Fit | undefined, gap: number | undefined, window: number | undefined, language: Language) {
  if (item.kind === 'decomposer' && window !== undefined) {
    return { text: sayWith(fit?.tooLate ? 'tooLate' : 'inTime', language, { need: item.min_window_days ?? 25, have: window }), colour: fit?.tooLate ? '#b91c1c' : GREEN };
  }
  if (!fit || gap === undefined || gap <= 0) return null;
  if (fit.gainAcres === null) return { text: say('notInCheck', language), colour: '#64748b' };
  if (fit.gainAcres <= 0) return { text: say('needsTractor', language), colour: '#b45309' };
  if (fit.gainAcres >= gap - 0.01) return { text: sayWith('clearsGap', language, { gap: fmt(gap), inDays: inDays(Number(fmt(fit.days ?? 0)), language) }), colour: GREEN };
  return { text: sayWith('clearsPart', language, { acres: fmt(fit.gainAcres), gap: fmt(gap) }), colour: '#b45309' };
}

/** A short row: name, what it does for this farm, the CHC price if known. Tap for the details. */
function ShopRow({ item, fit, gap, window, rent, farm, language }: {
  item: ShopItem;
  fit?: Fit;
  gap?: number;
  window?: number;
  rent?: RentOption;
  farm: FarmProfile;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  const line = fitLine(item, fit, gap, window, language);
  const late = item.kind === 'decomposer' && fit?.tooLate;
  return (
    <Card padding="sm" style={{ opacity: late ? 0.85 : 1 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem', border: 'none', background: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', minHeight: '3rem' }}
      >
        <span style={{ display: 'grid', gap: '0.15rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{item.names[language]}</span>
          {line && <span style={{ fontSize: '0.92rem', fontWeight: 600, color: line.colour }}>{line.text}</span>}
          {rent && (
            <span style={{ fontSize: '0.88rem', color: '#475569', overflowWrap: 'anywhere' }}>
              {sayWith('rentSummary', language, {
                chc: rent.chc.name,
                cost: rent.cost.toLocaleString('en-IN'),
                date: rent.firstFree ? dayMonth(rent.firstFree, language) : say('askChc', language),
              })}
            </span>
          )}
        </span>
        <span aria-hidden="true" style={{ color: '#64748b', fontSize: '1.2rem', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
          ›
        </span>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{say(open ? 'hideDetails' : 'showDetails', language)}</span>
      </button>
      {open && <ShopDetails item={item} farm={farm} language={language} />}
    </Card>
  );
}

/** What it is, its rate, the subsidy, and renting it or applying for the subsidy. */
function ShopDetails({ item, farm, language }: { item: ShopItem; farm: FarmProfile; language: Language }) {
  const [chcs, setChcs] = useState<ChcsResponse | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'noLocation' | 'untracked' | 'error'>('idle');
  const [error, setError] = useState('');

  async function rent() {
    const place = where(farm);
    if (!item.engine_type) {
      setState('untracked'); // the CHC list only records the four machines the check knows
      return;
    }
    if (!place) {
      setState('noLocation');
      return;
    }
    setState('busy');
    try {
      const season = farm.harvestDate && farm.wheatBy ? { harvest_date: farm.harvestDate, wheat_deadline: farm.wheatBy } : undefined;
      setChcs(await getChcs(place, item.engine_type, CHC_KM, season));
      setState('idle');
    } catch (e) {
      setError(e instanceof KisanError && e.status !== 0 ? e.message : say('network', language));
      setState('error');
    }
  }

  const portal = item.links.find((l) => l.kind === 'subsidy');

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.6rem', borderTop: '1px solid #e2e8f0' }}>
      <p style={{ margin: 0, lineHeight: 1.5, color: '#334155' }}>{item.does[language]}</p>
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
            <Button size="lg" variant="secondary" onClick={() => void rent()} disabled={state === 'busy'} style={BIG}>
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
                {m?.first_free ? ` · ${say('statFree', language)}: ${dayMonth(m.first_free, language)}` : ''}
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
