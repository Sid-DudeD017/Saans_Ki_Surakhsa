// The principal's go/no-go board (P2): today's call for assembly, PE, recess and trips, big enough to
// read across a staff room, from GET /v1/schools/{id}/advisory's school_day.
import React from 'react';

import type { Language } from './airQuality';
import type { SchoolAdvisory } from './advisory';
import { schoolDay, type SchoolDay } from './schoolDay';

type Words = Record<Language, string>;

const W = {
  title: { pa: 'ਪ੍ਰਿੰਸੀਪਲ ਦਾ ਬੋਰਡ', hi: 'प्रधानाचार्य का बोर्ड', en: "Principal's board" },
  go: { pa: 'ਜਾਰੀ ਰੱਖੋ: ਆਮ ਸਕੂਲ ਦਿਨ', hi: 'जारी रखें: सामान्य स्कूल दिन', en: 'GO: a normal school day' },
  caution: { pa: 'ਧਿਆਨ ਨਾਲ: ਬਾਹਰ, ਪਰ ਸੰਭਲ ਕੇ', hi: 'सावधानी: बाहर, पर संभलकर', en: 'CAUTION: outdoors, with care' },
  no_go: { pa: 'ਰੋਕੋ: ਦਿਨ ਅੰਦਰ ਰੱਖੋ', hi: 'रोकें: दिन अंदर रखें', en: 'NO-GO: keep the day indoors' },
  assembly: { pa: 'ਸਵੇਰ ਦੀ ਸਭਾ', hi: 'प्रार्थना सभा', en: 'Assembly' },
  pe: { pa: 'ਖੇਡ ਪੀਰੀਅਡ', hi: 'पीटी / खेल', en: 'PE' },
  recess: { pa: 'ਅੱਧੀ ਛੁੱਟੀ', hi: 'मध्यावकाश', en: 'Recess' },
  trips: { pa: 'ਬਾਹਰੀ ਦੌਰੇ', hi: 'बाहरी यात्राएँ', en: 'Outdoor trips' },
  purifiers: { pa: 'ਕਲਾਸਾਂ ਵਿੱਚ ਪਿਊਰੀਫਾਇਰ', hi: 'कक्षाओं में प्यूरीफायर', en: 'Classroom purifiers' },
  sms: { pa: 'ਮਾਪਿਆਂ ਨੂੰ SMS', hi: 'अभिभावकों को SMS', en: 'Parent SMS' },
  masks: { pa: 'ਆਉਣ-ਜਾਣ ਲਈ ਮਾਸਕ', hi: 'आने-जाने में मास्क', en: 'Masks for the commute' },
  outdoors: { pa: 'ਬਾਹਰ', hi: 'बाहर', en: 'Outdoors' },
  indoors: { pa: 'ਅੰਦਰ', hi: 'अंदर', en: 'Indoors' },
  state_order: { pa: 'ਸਰਕਾਰੀ ਹੁਕਮ ਮੁਤਾਬਕ', hi: 'सरकारी आदेश के अनुसार', en: 'As the state order says' },
  normal: { pa: 'ਬਾਹਰ, ਆਮ ਵਾਂਗ', hi: 'बाहर, सामान्य', en: 'Outdoors, as normal' },
  light_for_asthma: { pa: 'ਬਾਹਰ, ਦਮੇ ਵਾਲੇ ਬੱਚਿਆਂ ਲਈ ਹਲਕਾ', hi: 'बाहर, दमे वाले बच्चों के लिए हल्का', en: 'Outdoors, light for children with asthma' },
  allowed: { pa: 'ਜਾ ਸਕਦੇ ਹਨ', hi: 'जा सकते हैं', en: 'Can go ahead' },
  notToday: { pa: 'ਅੱਜ ਨਹੀਂ', hi: 'आज नहीं', en: 'Not today' },
  on: { pa: 'ਚਾਲੂ ਰੱਖੋ', hi: 'चालू रखें', en: 'On' },
  notNeeded: { pa: 'ਲੋੜ ਨਹੀਂ', hi: 'ज़रूरत नहीं', en: 'Not needed' },
  once: { pa: 'ਅੱਜ ਭੇਜੋ', hi: 'आज भेजें', en: 'Send today' },
  every_morning: { pa: 'ਹਰ ਸਵੇਰ ਭੇਜੋ', hi: 'हर सुबह भेजें', en: 'Every morning' },
  yes: { pa: 'ਹਾਂ', hi: 'हाँ', en: 'Yes' },
  heat: { pa: 'ਹੀਟ ਇੰਡੈਕਸ', hi: 'हीट इंडेक्स', en: 'Heat index' },
  heatIndoors: { pa: 'ਬਹੁਤ ਗਰਮੀ: ਸਭ ਕੁਝ ਅੰਦਰ', hi: 'बहुत गर्मी: सब कुछ अंदर', en: 'too hot: everything moves indoors' },
  rule: { pa: 'ਸਕੂਲ ਦੇ ਨਿਯਮਾਂ ਵਿੱਚ AQI ਬੈਂਡ', hi: 'स्कूल नियमों में AQI बैंड', en: 'School rules, AQI band' },
  until: { pa: 'ਤੱਕ ਲਾਗੂ', hi: 'तक लागू', en: 'valid until' },
} satisfies Record<string, Words>;

const GOOD = { bg: '#dcfce7', ink: '#14532d', edge: '#16a34a' };
const MID = { bg: '#fef3c7', ink: '#78350f', edge: '#d97706' };
const BAD = { bg: '#fee2e2', ink: '#7f1d1d', edge: '#dc2626' };

function tone(value: string | boolean, goodWhen: 'outdoors' | 'true' | 'false' | 'none') {
  if (value === 'light_for_asthma') return MID;
  if (goodWhen === 'outdoors') return value === 'outdoors' || value === 'normal' ? GOOD : BAD;
  if (goodWhen === 'none') return value === 'none' ? GOOD : BAD;
  return String(value) === goodWhen ? GOOD : MID;
}

function Tile({ label, value, colours }: { label: string; value: string; colours: typeof GOOD }) {
  return (
    <div style={{ padding: '0.9rem 1rem', borderRadius: '0.75rem', background: colours.bg, borderLeft: `6px solid ${colours.edge}`, minWidth: 0 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.03em', color: colours.ink, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.25, color: colours.ink, marginTop: '0.2rem', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function clock(at: string) {
  const m = at.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : at;
}

export function PrincipalBoard({ advisory, language }: { advisory: SchoolAdvisory; language: Language }) {
  const day: SchoolDay = (advisory.school_day as SchoolDay | undefined) ?? schoolDay(advisory.aqi, null);
  const banner = day.decision === 'go' ? GOOD : day.decision === 'caution' ? MID : BAD;
  const where = (v: string) => W[v as keyof typeof W]?.[language] ?? v;
  return (
    <section aria-labelledby="principal-board-title" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 id="principal-board-title" style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
        📋 {W.title[language]} · {advisory.school.name}
      </h3>
      <div role="status" style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: banner.edge, color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, lineHeight: 1.2 }}>
        {W[day.decision][language]}
        <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.35rem', opacity: 0.95 }}>
          AQI {day.aqi} · {W.rule[language]} {day.band.from}–{day.band.to} · {W.until[language]} {clock(advisory.valid_until)}
        </div>
      </div>
      {day.heat_override && (
        <div style={{ padding: '0.6rem 0.9rem', borderRadius: '0.5rem', background: '#fff7ed', color: '#9a3412', fontWeight: 700 }}>
          🌡️ {W.heat[language]} {day.heat_index_c?.toFixed(1)} °C: {W.heatIndoors[language]}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))', gap: '0.75rem' }}>
        <Tile label={W.assembly[language]} value={where(day.assembly)} colours={tone(day.assembly, 'outdoors')} />
        <Tile label={W.pe[language]} value={where(day.pe)} colours={tone(day.pe, 'outdoors')} />
        <Tile label={W.recess[language]} value={where(day.recess)} colours={tone(day.recess, 'outdoors')} />
        <Tile label={W.trips[language]} value={day.outdoor_trips ? W.allowed[language] : W.notToday[language]} colours={day.outdoor_trips ? GOOD : BAD} />
        <Tile label={W.purifiers[language]} value={day.classroom_purifiers ? W.on[language] : W.notNeeded[language]} colours={tone(day.classroom_purifiers, 'false')} />
        <Tile label={W.sms[language]} value={day.parent_sms === 'none' ? W.notNeeded[language] : W[day.parent_sms][language]} colours={tone(day.parent_sms, 'none')} />
        <Tile label={W.masks[language]} value={day.commute_masks ? W.yes[language] : W.notNeeded[language]} colours={tone(day.commute_masks, 'false')} />
      </div>
    </section>
  );
}
