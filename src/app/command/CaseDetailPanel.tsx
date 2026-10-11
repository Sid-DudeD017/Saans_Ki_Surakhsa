'use client';

import React, { useState } from 'react';
import { Alert, Badge, Button, Card } from '../../components/ui';
import { CaseMap, type MapPoint } from './CaseMap';
import { ApiError, actOnTicket, OFFICERS } from './commandApi';
import { translations, type Lang } from './i18n';

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  pa: ['ਜਨਵਰੀ', 'ਫ਼ਰਵਰੀ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈਲ', 'ਮਈ', 'ਜੂਨ', 'ਜੁਲਾਈ', 'ਅਗਸਤ', 'ਸਤੰਬਰ', 'ਅਕਤੂਬਰ', 'ਨਵੰਬਰ', 'ਦਸੰਬਰ'],
};

export function when(iso: string, lang: Lang = 'en') {
  if (!iso) return '';
  const [date, time] = iso.split('T');
  if (!date) return iso;
  const [, m, d] = date.split('-').map(Number);
  const monthName = (MONTHS[lang] || MONTHS.en)[m - 1] || '';
  return `${d} ${monthName}, ${time ? time.slice(0, 5) : ''}`;
}

function getTypeNames(tr: (typeof translations)[Lang]): Record<string, string> {
  return {
    farm_fire: tr.type_farm_fire,
    garbage: tr.type_garbage,
    vehicle: tr.type_vehicle,
    firecrackers: tr.type_firecrackers,
    dust: tr.type_dust,
    industrial: tr.type_industrial,
    farmer_support: tr.type_farmer_support,
  };
}

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  fontSize: '0.875rem',
  color: '#334155',
  flexWrap: 'wrap',
};

const REPORT_CHIP_CATEGORIES = [
  {
    title: 'WHAT YOU SEE:',
    chips: [
      { id: 'thick_smoke', label: 'thick smoke', aliases: ['thick smoke', 'thick_smoke', 'ਗਾੜ੍ਹਾ ਧੂੰਆਂ', 'गाढ़ा धुआँ'] },
      { id: 'flames', label: 'flames', aliases: ['flames', 'flame', 'ਅੱਗ ਦੀਆਂ ਲਾਟਾਂ', 'आग की लपटें'] },
      { id: 'ash_falling', label: 'ash falling', aliases: ['ash falling', 'ash_falling', 'ਸੁਆਹ ਡਿੱਗ ਰਹੀ ਹੈ', 'राख गिर रही है'] },
      { id: 'strong_smell', label: 'strong smell', aliases: ['strong smell', 'strong_smell', 'ਤੇਜ਼ ਬਦਬੂ', 'तेज़ दुर्गंध'] },
      { id: 'dust_cloud', label: 'dust cloud', aliases: ['dust cloud', 'dust_cloud', 'ਧੂੜ ਦਾ ਗੁਬਾਰ', 'धूल का गुबार'] },
    ],
  },
  {
    title: 'HOW LONG:',
    chips: [
      { id: 'just_started', label: 'just started', aliases: ['just started', 'just_started', 'ਹੁਣੇ ਸ਼ੁਰੂ ਹੋਇਆ', 'अभी शुरू हुआ'] },
      { id: 'under_hour', label: 'under an hour', aliases: ['under an hour', 'under_hour', 'under hour', 'ਇੱਕ ਘੰਟੇ ਤੋਂ ਘੱਟ', 'एक घंटे से कम'] },
      { id: 'hours', label: 'hours', aliases: ['hours', 'ਕਈ ਘੰਟਿਆਂ ਤੋਂ', 'कई घंटों से'] },
      { id: 'every_day', label: 'every day', aliases: ['every day', 'every_day', 'daily', 'ਹਰ ਰੋਜ਼', 'हर रोज़'] },
    ],
  },
  {
    title: 'WHO IS AFFECTED:',
    chips: [
      { id: 'children_outside', label: 'children outside', aliases: ['children outside', 'children_outside', 'ਬਾਹਰ ਖੇਡਦੇ ਬੱਚੇ', 'बाहर खेलते बच्चे'] },
      { id: 'class_indoors', label: 'a class indoors', aliases: ['a class indoors', 'class indoors', 'class_indoors', 'ਅੰਦਰ ਕਲਾਸ', 'अंदर क्लास रूम'] },
      { id: 'nearby_homes', label: 'nearby homes', aliases: ['nearby homes', 'nearby_homes', 'homes', 'ਨੇੜਲੇ ਘਰ', 'आस-पास के घर'] },
    ],
  },
];

function parseReportDetails(descriptionText: string) {
  const desc = (descriptionText || '').toLowerCase();
  const matched = new Set<string>();

  for (const cat of REPORT_CHIP_CATEGORIES) {
    for (const chip of cat.chips) {
      if (chip.aliases.some((alias) => desc.includes(alias.toLowerCase()))) {
        matched.add(chip.id);
      }
    }
  }

  // Direct match for explicit Note: / Notes: section
  const noteMatch = (descriptionText || '').match(/(?:^|\n|\r)\s*notes?:\s*([\s\S]+)$/i);
  if (noteMatch && noteMatch[1].trim()) {
    return {
      matchedChips: matched,
      customNote: noteMatch[1].trim(),
    };
  }

  // Filter out chip labels from the description to extract the custom note
  let remainingNote = descriptionText || '';
  for (const cat of REPORT_CHIP_CATEGORIES) {
    for (const chip of cat.chips) {
      for (const alias of chip.aliases) {
        const regex = new RegExp(`(^|,|\\n|·|\\s*)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|\\n|·|\\s*|$)`, 'gi');
        remainingNote = remainingNote.replace(regex, ' ');
      }
    }
  }
  const cleanNote = remainingNote.trim().replace(/^notes?:\s*/i, '').replace(/^,\s*|,\s*$/g, '').trim();

  return {
    matchedChips: matched,
    customNote: cleanNote.length > 0 ? cleanNote : (matched.size === 0 ? descriptionText : ''),
  };
}

export function CaseDetailPanel({
  detail,
  officer,
  lang,
  onChanged,
}: {
  detail: any;
  officer: string;
  lang: Lang;
  onChanged: () => void;
}) {
  const tr = translations[lang];
  const t = detail.ticket;
  const closed = t.status === 'closed' || t.status === 'resolved';

  const currentOfficerObj = OFFICERS.find((o) => o.token === officer);
  const isCitizen =
    officer === 'local-citizen-1' ||
    currentOfficerObj?.role === 'citizen' ||
    (!t.threat_level && !t.internal_notes);
  const isAccepted = t.status === 'in_progress' || t.status === 'assigned';
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState('low');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  const act = async (action: string) => {
    if (
      (action === 'resolve' && !summary.trim()) ||
      (action === 'override_threat' && !reason.trim()) ||
      (action === 'note' && !reason.trim()) ||
      (action === 'request_info' && !reason.trim())
    ) {
      setMessage({ tone: 'warning', text: 'Provide a reason or summary for this action.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload: any = { action };
      if (reason) payload.reason = reason;
      if (summary) payload.summary = summary;
      if (action === 'override_threat') payload.overrideThreatLevel = overrideLevel;

      await actOnTicket(t.id, payload, officer);
      setReason('');
      setSummary('');
      setMessage({ tone: 'success', text: `Action recorded.` });
      onChanged();
    } catch (e: any) {
      setMessage({ tone: 'danger', text: e.message || 'Error executing action' });
    } finally {
      setBusy(false);
    }
  };

  const typeNames = getTypeNames(tr);
  const points: MapPoint[] = t.location
    ? [{ id: 'report', kind: t.type === 'farmer_support' ? 'farm' : 'report', label: typeNames[t.type] || 'Report', ...t.location }]
    : [];

  const [resolvedRegion, setResolvedRegion] = useState<string | null>(
    t.district && t.district !== 'unassigned' ? t.district : null
  );

  React.useEffect(() => {
    if (t.district && t.district !== 'unassigned') {
      setResolvedRegion(t.district);
      return;
    }
    if (!t.location?.lat || !t.location?.lon) {
      setResolvedRegion(null);
      return;
    }

    let active = true;
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${t.location.lat}&longitude=${t.location.lon}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const region =
          data.locality ||
          data.city ||
          data.localityInfo?.administrative?.[2]?.name ||
          data.principalSubdivision ||
          null;
        if (region) {
          setResolvedRegion(region);
        }
      })
      .catch(() => {
        if (active) setResolvedRegion(null);
      });

    return () => {
      active = false;
    };
  }, [t.id, t.district, t.location?.lat, t.location?.lon]);

  const rawDescription = t.description || t.complaint_body?.description || '';
  const { matchedChips, customNote } = parseReportDetails(rawDescription);
  const evidenceList = Array.isArray(t.evidence) && t.evidence.length > 0
    ? t.evidence
    : Array.isArray(t.complaint_body?.evidence) && t.complaint_body.evidence.length > 0
    ? t.complaint_body.evidence
    : [];

  // Progression steps for citizen view
  const progressSteps = [
    { key: 'submitted', label: tr.step_submitted },
    { key: 'under_review', label: tr.step_under_review },
    { key: 'in_progress', label: tr.step_in_progress },
    { key: 'resolved', label: tr.step_resolved },
  ];

  const currentStepIndex = (() => {
    if (t.status === 'closed' || t.status === 'resolved') return 3;
    if (t.status === 'in_progress' || t.status === 'assigned') return 2;
    if (t.status === 'under_review' || t.status === 'awaiting_information') return 1;
    return 0;
  })();

  const statusBadgeText =
    t.status === 'submitted' ? tr.status_submitted :
    t.status === 'under_review' ? tr.status_under_review :
    t.status === 'assigned' ? tr.status_assigned :
    t.status === 'in_progress' ? tr.status_in_progress :
    t.status === 'resolved' ? tr.status_resolved :
    t.status === 'closed' ? tr.status_closed : t.status.toUpperCase();

  const getChipLabel = (id: string) => {
    switch (id) {
      case 'thick_smoke': return tr.chip_thick_smoke;
      case 'flames': return tr.chip_flames;
      case 'ash_falling': return tr.chip_ash_falling;
      case 'strong_smell': return tr.chip_strong_smell;
      case 'dust_cloud': return tr.chip_dust_cloud;
      case 'just_started': return tr.chip_just_started;
      case 'under_hour': return tr.chip_under_hour;
      case 'hours': return tr.chip_hours;
      case 'every_day': return tr.chip_every_day;
      case 'children_outside': return tr.chip_children_outside;
      case 'class_indoors': return tr.chip_class_indoors;
      case 'nearby_homes': return tr.chip_nearby_homes;
      default: return id;
    }
  };

  const activeChipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    border: '2px solid #0284c7',
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    fontWeight: 600,
    fontSize: '0.9rem',
    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.1)',
  };

  const inactiveChipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    border: '1.5px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontWeight: 500,
    fontSize: '0.9rem',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
      {/* 1. Header Card */}
      <Card padding="lg">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Badge variant={closed ? 'neutral' : 'primary'}>{statusBadgeText}</Badge>
          {!isCitizen && t.automated_label && <Badge variant="warning">{tr.automated_rec}</Badge>}
          {!isCitizen && t.threat_level && (
            <Badge variant={t.threat_level === 'critical' ? 'danger' : 'warning'}>
              {tr.threat}: {t.threat_level}
            </Badge>
          )}
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.id}</span>
        </div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', color: '#0f172a' }}>
          {typeNames[t.type] ?? t.type}{resolvedRegion ? ` · ${resolvedRegion}` : ''}
        </h2>
        <div style={row}>
          <span>{tr.created} {when(t.created_at, lang)}</span>
          {!isCitizen && t.deadline && (
            <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>
              {tr.sla} {when(t.deadline, lang)}
            </span>
          )}
        </div>

        {/* Citizen Progression Bar */}
        {isCitizen && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
              {tr.report_status}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {progressSteps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div
                    key={step.key}
                    style={{
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.375rem',
                      backgroundColor: isCurrent ? '#0284c7' : isPassed ? '#e0f2fe' : '#f1f5f9',
                      color: isCurrent ? '#ffffff' : isPassed ? '#0369a1' : '#64748b',
                      fontSize: '0.75rem',
                      fontWeight: isCurrent || isPassed ? 600 : 500,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 2. Details Card (Matching 2nd Image) */}
      <Card padding="lg">
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📝</span> {tr.details_title}
        </h3>

        {/* WHAT YOU SEE */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            {tr.what_you_see}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {REPORT_CHIP_CATEGORIES[0].chips.map((chip) => {
              const isSelected = matchedChips.has(chip.id);
              return (
                <span key={chip.id} style={isSelected ? activeChipStyle : inactiveChipStyle}>
                  {isSelected ? '✓ ' : '+ '} {getChipLabel(chip.id)}
                </span>
              );
            })}
          </div>
        </div>

        {/* HOW LONG */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            {tr.how_long}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {REPORT_CHIP_CATEGORIES[1].chips.map((chip) => {
              const isSelected = matchedChips.has(chip.id);
              return (
                <span key={chip.id} style={isSelected ? activeChipStyle : inactiveChipStyle}>
                  {isSelected ? '✓ ' : '+ '} {getChipLabel(chip.id)}
                </span>
              );
            })}
          </div>
        </div>

        {/* WHO IS AFFECTED */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            {tr.who_is_affected}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {REPORT_CHIP_CATEGORIES[2].chips.map((chip) => {
              const isSelected = matchedChips.has(chip.id);
              return (
                <span key={chip.id} style={isSelected ? activeChipStyle : inactiveChipStyle}>
                  {isSelected ? '✓ ' : '+ '} {getChipLabel(chip.id)}
                </span>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
              {tr.note_optional}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {customNote.length}/1000
            </span>
          </div>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: customNote ? '#0f172a' : '#64748b',
              fontSize: '0.925rem',
              lineHeight: 1.5,
              minHeight: '70px',
              fontStyle: customNote ? 'normal' : 'italic',
            }}
          >
            {customNote || tr.no_details_noted}
          </div>
        </div>

        {/* Photo Evidence */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
            📷 {tr.photo_evidence_optional}
          </div>
          {evidenceList.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {evidenceList.map((ev: any, idx: number) => {
                const key = typeof ev === 'string' ? ev : ev.object_key || `Photo #${idx + 1}`;
                const isImage = typeof ev === 'object' ? (!ev.media_type || ev.media_type.startsWith('image/')) : Boolean(key.match(/\.(jpg|jpeg|png|heic|webp)$/i));
                const imageUrl = key.startsWith('evidence/') ? `/v1/evidence?key=${encodeURIComponent(key)}` : null;

                return (
                  <div
                    key={idx}
                    style={{
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <span style={{ fontSize: '1.25rem' }}>📷</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {key}
                          </div>
                          {ev.media_type && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ev.media_type}</div>
                          )}
                        </div>
                      </div>

                      {imageUrl && (
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#0284c7',
                            textDecoration: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            backgroundColor: '#e0f2fe',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ↗ Full Image
                        </a>
                      )}
                    </div>

                    {imageUrl && isImage && (
                      <div
                        style={{
                          borderTop: '1px solid #e2e8f0',
                          backgroundColor: '#0f172a',
                          textAlign: 'center',
                          padding: '0.5rem',
                        }}
                      >
                        <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={imageUrl}
                            alt="Photo evidence"
                            loading="lazy"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '340px',
                              objectFit: 'contain',
                              borderRadius: '0.25rem',
                              display: 'inline-block',
                              verticalAlign: 'middle',
                            }}
                          />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                border: '1.5px dashed #cbd5e1',
                borderRadius: '0.5rem',
                padding: '1.25rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                fontSize: '0.875rem',
              }}
            >
              <span>📷 {tr.no_photo_uploaded}</span>
            </div>
          )}
        </div>

        {/* Merged Incident Reports */}
        {t.all_reports && t.all_reports.length > 1 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                👥 {!isCitizen ? `All Incident Reports (${t.all_reports.length})` : `Combined Area Incident (${t.all_reports.length} reports)`}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Merged within 500m
              </span>
            </div>
            {!isCitizen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {t.all_reports.map((rep: any, idx: number) => {
                  const { customNote: repNote } = parseReportDetails(rep.description);
                  return (
                    <div
                      key={rep.id || idx}
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.5rem',
                        backgroundColor: rep.is_primary ? '#eff6ff' : '#f8fafc',
                        border: rep.is_primary ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span style={{ fontWeight: 600, color: rep.is_primary ? '#1d4ed8' : '#475569' }}>
                          {rep.reporter_identity} {rep.is_primary ? '★ Primary report' : '↳ Additional report'}
                        </span>
                        <span>{when(rep.received_at, lang)}</span>
                      </div>
                      <div style={{ color: repNote ? '#0f172a' : '#94a3b8', fontStyle: repNote ? 'normal' : 'italic' }}>
                        {repNote || 'No custom note attached'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#475569', backgroundColor: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', lineHeight: 1.4 }}>
                ℹ️ Multiple citizens in your area reported this incident. Your report was linked with {t.all_reports.length - 1} other report(s) so authorities can respond swiftly.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 3. Location Map Card */}
      <Card padding="lg">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>📍 {tr.incident_location}</h3>
        {t.location && (
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
            {tr.coordinates} {t.location.lat.toFixed(4)}, {t.location.lon.toFixed(4)}{resolvedRegion ? ` · ${resolvedRegion}` : ''}
          </div>
        )}
        <div style={{ marginTop: '0.5rem' }}>
          <CaseMap points={points} title="The report location" />
        </div>
      </Card>

      {/* 4. Closed / Resolved summary */}
      {closed && t.resolution_summary && (
        <Card padding="lg">
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#166534' }}>
            ✅ {tr.resolution_summary_title}
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#14532d' }}>
            {t.resolution_summary}
          </p>
        </Card>
      )}

      {/* 5. OFFICER-ONLY SECTIONS (Hidden for citizens) */}
      {!isCitizen && (
        <>
          {/* Threat Assessment Card */}
          <Card padding="lg">
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tr.threat}</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
              {tr.current_threat}: {t.threat_level || 'None'}
            </p>
            {t.threat_reasons && t.threat_reasons.length > 0 && (
              <ul style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>
                {t.threat_reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {t.override && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#c2410c' }}>
                {tr.overridden_by} {t.override.by}: {t.override.reason} ({t.override.level})
              </p>
            )}
          </Card>

          {/* Internal Notes Card */}
          {t.internal_notes && t.internal_notes.length > 0 && (
            <Card padding="lg">
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tr.internal_notes}</h3>
              <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem', margin: 0 }}>
                {t.internal_notes.map((n: any, i: number) => (
                  <li key={i}>
                    [{when(n.at)}] {n.by}: {n.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Officer Actions Card */}
          <Card padding="lg">
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>{tr.actions}</h3>
            {closed ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                {tr.resolved_desc} Resolution: {t.resolution_summary}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {isAccepted && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 600, fontSize: '0.875rem' }}>
                    <span>✓ Ticket Accepted · In Progress</span>
                    <Badge variant="primary">ACTIVE</Badge>
                  </div>
                )}

                {/* Show notes recorded earlier */}
                {t.internal_notes && t.internal_notes.length > 0 && (
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                      Notes & Activity ({t.internal_notes.length}):
                    </div>
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                      {t.internal_notes.map((n: any, i: number) => (
                        <div key={i} style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>[{when(n.at)}] <strong>{n.by}</strong>: </span>
                          <span>{n.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
                  {isAccepted ? 'Add Follow-up Note' : tr.reason_note}
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder={isAccepted ? 'Enter note or update...' : 'Enter reason or note...'}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!isAccepted && (
                    <Button style={{ minHeight: '44px' }} onClick={() => act('accept')} disabled={busy}>
                      {tr.accept}
                    </Button>
                  )}
                  <Button style={{ minHeight: '44px' }} variant="outline" onClick={() => act('note')} disabled={busy}>
                    {tr.add_note}
                  </Button>
                  <Button style={{ minHeight: '44px' }} variant="ghost" onClick={() => act('request_info')} disabled={busy}>
                    {tr.request_info}
                  </Button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: '#334155' }}>
                  {tr.resolve_summary}
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={2}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button style={{ minHeight: '44px' }} variant="danger" onClick={() => act('resolve')} disabled={busy}>
                    {tr.resolve}
                  </Button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', color: '#334155', minHeight: '44px' }}>
                    {tr.new_level}
                    <select
                      value={overrideLevel}
                      onChange={(e) => setOverrideLevel(e.target.value)}
                      style={{ padding: '0.4rem', borderRadius: '0.25rem', minHeight: '44px' }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <Button style={{ minHeight: '44px' }} variant="outline" onClick={() => act('override_threat')} disabled={busy}>
                    {tr.override_threat}
                  </Button>
                </div>
              </div>
            )}
            {message && (
              <div style={{ marginTop: '0.75rem' }}>
                <Alert variant={message.tone}>{message.text}</Alert>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
