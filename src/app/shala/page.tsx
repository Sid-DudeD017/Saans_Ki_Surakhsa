'use client';

import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import { Card, Button, Container, Stack, Badge, Alert } from '../../components/ui';
import { ReportSheet } from './ReportSheet';
import { AirBuddy } from './AirBuddy';
import {
  CATEGORIES,
  CATEGORY_COLOURS,
  CATEGORY_NAMES,
  WORDS,
  formatFiresWindSummary,
  formatForecastHour,
  buildForecastTrendSentence,
  type Category,
  type ForecastResponse,
} from './airQuality';
import type { SchoolAdvisory } from './advisory';
import { FilterFrenzy } from './FilterFrenzy';
import { StudentQuiz } from './StudentQuiz';
import { GasCards } from './GasCards';
import { PrincipalBoard } from './PrincipalBoard';
import { RedZoneMap } from './RedZoneMap';
import { DEMO_STATIONS } from './redZoneFixtures';
import { USE_MOCKS } from './shalaApi';
import {
  useShalaAir,
  formatMeasurementTime,
  type ForecastStatus,
} from './useShalaAir';
import {
  useLocation,
  type Place,
  type LocationStatus,
} from '../../lib/useLocation';
import schoolsConfig from '../../config/schools.json';
import { BottomTabs, TabPanel, useUrlTab, type TabItem } from '../../components/BottomTabs';

function CampusOverviewSkeleton({ language }: { language: 'pa' | 'hi' | 'en' }) {
  return (
    <Card padding="lg">
      <div
        role="status"
        aria-busy="true"
        aria-label={WORDS.loadingAir[language]}
        style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div className="saans-skeleton" style={{ width: '120px', height: '14px', borderRadius: '4px', marginBottom: '0.5rem' }} />
            <div className="saans-skeleton" style={{ width: '260px', height: '24px', borderRadius: '4px', marginBottom: '0.5rem' }} />
            <div className="saans-skeleton" style={{ width: '180px', height: '14px', borderRadius: '4px' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="saans-skeleton" style={{ width: '80px', height: '48px', borderRadius: '6px', marginLeft: 'auto', marginBottom: '0.5rem' }} />
            <div className="saans-skeleton" style={{ width: '100px', height: '20px', borderRadius: '9999px', marginLeft: 'auto' }} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div style={{ width: '70px', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '0.375rem' }} />
              <div style={{ width: '90px', height: '18px', backgroundColor: '#cbd5e1', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ForecastStripSkeleton({ language }: { language: 'pa' | 'hi' | 'en' }) {
  return (
    <Card padding="md" style={{ backgroundColor: '#ffffff' }}>
      <div
        role="status"
        aria-busy="true"
        aria-label={WORDS.loadingAir[language]}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '120px', height: '20px', backgroundColor: '#cbd5e1', borderRadius: '4px' }} />
          <div style={{ width: '60px', height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '220px', height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            overflowX: 'hidden',
            paddingBottom: '0.25rem',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                minWidth: '85px',
                height: '110px',
                backgroundColor: '#f1f5f9',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ width: '40px', height: '14px', backgroundColor: '#cbd5e1', borderRadius: '3px' }} />
              <div style={{ width: '55px', height: '18px', backgroundColor: '#e2e8f0', borderRadius: '9999px' }} />
              <div style={{ width: '35px', height: '22px', backgroundColor: '#cbd5e1', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ForecastStrip({
  forecast,
  status,
  language,
  onRetry,
  isExample,
}: {
  forecast: ForecastResponse | null;
  status: ForecastStatus;
  language: 'pa' | 'hi' | 'en';
  onRetry: () => void;
  isExample: boolean;
}) {
  if (status === 'loading') {
    return <ForecastStripSkeleton language={language} />;
  }

  if (status === 'no_coverage') {
    return (
      <Card padding="md" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem' }}>
              ⏱️ {WORDS.nextHours[language]}
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              {WORDS.forecastCoverageNotice[language]}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'error' || !forecast) {
    return (
      <Card padding="md" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem' }}>
              ⏱️ {WORDS.nextHours[language]}
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              {WORDS.forecastUnavailable[language]}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            🔄 {WORDS.retry[language]}
          </Button>
        </div>
      </Card>
    );
  }

  const hours12 = forecast.hours.slice(0, 12);
  const trendSentence = buildForecastTrendSentence(hours12, language);

  return (
    <Card padding="md" style={{ backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Title row with optional Example tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>
            ⏱️ {WORDS.nextHours[language]}
          </h2>
          {isExample && (
            <Badge variant="neutral" size="sm">
              {WORDS.example[language]}
            </Badge>
          )}
        </div>

        {/* Derived trend sentence if supported by data */}
        {trendSentence && (
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#334155',
              padding: '0.35rem 0.6rem',
              backgroundColor: '#f1f5f9',
              borderRadius: '0.375rem',
              lineHeight: 1.35,
            }}
          >
            📈 {trendSentence}
          </div>
        )}

        {/* Horizontally scrollable 12-hour strip */}
        <div
          role="region"
          aria-label={WORDS.nextHours[language]}
          className="saans-scrollbar"
          style={{
            display: 'flex',
            gap: '0.75rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {hours12.map((h, i) => {
            const timeLabel = formatForecastHour(h.time, language);
            const categoryName = CATEGORY_NAMES[h.category][language];
            const colours = CATEGORY_COLOURS[h.category];
            const srText = `${timeLabel}: ${categoryName}, AQI ${h.aqi}`;

            return (
              <div
                key={i}
                role="group"
                aria-label={srText}
                className="saans-forecast-cell"
                style={{
                  minWidth: '85px',
                  flex: '0 0 auto',
                  padding: '0.625rem 0.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: colours.tint,
                  border: `1.5px solid ${colours.fill}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '0.35rem',
                }}
              >
                {/* Hour */}
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                  {timeLabel}
                </div>

                {/* AQI number */}
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: colours.ink, lineHeight: 1 }}>
                  {h.aqi}
                </div>

                {/* Category name */}
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: colours.ink,
                    lineHeight: 1.2,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                  }}
                >
                  {categoryName}
                </div>

                {/* PM2.5 concentration */}
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {h.pm25_ug_m3} µg/m³
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function LocationBar({
  place,
  status,
  isRough,
  language,
  onAsk,
  onOpenSearch,
}: {
  place: Place;
  status: LocationStatus;
  isRough: boolean;
  language: 'pa' | 'hi' | 'en';
  onAsk: () => void;
  onOpenSearch: () => void;
}) {
  const isDevice = place.kind === 'device';
  const district = place.district || 'Sangrur';

  const srText = isDevice
    ? `Location: near you, accurate to ${place.accuracyM} metres`
    : `Location: showing your school, ${district}`;

  return (
    <div
      role="region"
      aria-label={srText}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
        fontSize: '0.875rem',
        color: '#334155',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {status === 'asking' ? (
          <>
            <span>⏳</span>
            <span style={{ fontWeight: 600, color: '#0369a1' }}>
              {WORDS.findingYou[language]}
            </span>
          </>
        ) : isDevice ? (
          <>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              📍 {WORDS.nearYou[language]}
            </span>
            <span style={{ color: '#64748b' }}>•</span>
            <Badge variant="neutral" size="sm">
              ±{place.accuracyM} m
            </Badge>
            {isRough && (
              <Badge variant="warning" size="sm">
                ⚠️ {WORDS.roughAccuracy[language].replace('{meters}', String(place.accuracyM))}
              </Badge>
            )}
          </>
        ) : status === 'denied' ? (
          <>
            <span style={{ color: '#dc2626' }}>🔒 {WORDS.locationOff[language]}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span>
              {WORDS.showingSchool[language].replace('{district}', district)}
            </span>
          </>
        ) : status === 'unavailable' ? (
          <>
            <span style={{ color: '#b45309' }}>⚠️ {WORDS.couldNotFindYou[language]}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span>
              {WORDS.showingSchool[language].replace('{district}', district)}
            </span>
          </>
        ) : status === 'insecure' ? (
          <>
            <span style={{ color: '#64748b' }}>🔒 {WORDS.insecureConnection[language]}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span>
              {WORDS.showingSchool[language].replace('{district}', district)}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>
              🏫 {WORDS.showingSchool[language].replace('{district}', district)}
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {status !== 'insecure' && !isDevice && status !== 'asking' && (
          <Button
            size="sm"
            variant="primary"
            onClick={onAsk}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            📍 {WORDS.useMyLocation[language]}
          </Button>
        )}
        {status === 'unavailable' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onAsk}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            🔄 {WORDS.retry[language]}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenSearch}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          🔍 {isDevice ? WORDS.change[language] : WORDS.searchPlace[language]}
        </Button>
      </div>
    </div>
  );
}

function LocationPermissionCard({
  language,
  onAsk,
  onDismiss,
}: {
  language: 'pa' | 'hi' | 'en';
  onAsk: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card padding="md" style={{ backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>📍</span>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0369a1' }}>
              {WORDS.seeAirWhereYouAre[language]}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.4 }}>
              {WORDS.locationRationale[language]}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDismiss}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            {WORDS.notNow[language]}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onAsk}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            📍 {WORDS.useMyLocation[language]}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PlaceSearchModal({
  schools,
  currentPlace,
  language,
  onSelectSchool,
  onUseDevice,
  canUseDevice,
  onClose,
}: {
  schools: Array<{ id: string; name: string; district: string; location: { lat: number; lon: number } }>;
  currentPlace: Place;
  language: 'pa' | 'hi' | 'en';
  onSelectSchool: (school: { id: string; name: string; district: string; location: { lat: number; lon: number } }) => void;
  onUseDevice: () => void;
  canUseDevice: boolean;
  onClose: () => void;
}) {
  return (
    <Card padding="lg" style={{ backgroundColor: '#ffffff', border: '2px solid #0284c7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>
          🔍 {WORDS.searchPlace[language]}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} style={{ minHeight: '44px', minWidth: '44px' }}>
          ✕
        </Button>
      </div>

      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
        <p style={{ margin: '0 0 0.5rem 0' }}>
          ℹ️ {WORDS.freeTextUnavailable[language]}
        </p>
      </div>

      <Stack gap="sm">
        {schools.map((school) => {
          const isSelected = currentPlace.kind === 'school' && currentPlace.id === school.id;
          return (
            <button
              key={school.id}
              type="button"
              onClick={() => {
                onSelectSchool(school);
                onClose();
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: `1.5px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: '44px',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                  🏫 {school.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {school.district} • ({school.location.lat}°N, {school.location.lon}°E)
                </div>
              </div>
              {isSelected && <Badge variant="primary" size="sm">Active</Badge>}
            </button>
          );
        })}

        {canUseDevice && (
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              onUseDevice();
              onClose();
            }}
            style={{ marginTop: '0.5rem', minHeight: '44px', minWidth: '44px' }}
          >
            📍 {WORDS.useMyLocation[language]}
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function RoleAdvisoryCard({
  advisory,
  role,
  language,
}: {
  advisory: SchoolAdvisory;
  role: string;
  language: 'pa' | 'hi' | 'en';
}) {
  const roleAdvisory =
    role in advisory.role_advisories
      ? advisory.role_advisories[role as keyof typeof advisory.role_advisories]
      : null;
  const summary = roleAdvisory?.summary || advisory.summary;
  const actionItems = roleAdvisory?.action_items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
          {roleAdvisory?.title || `${WORDS.todaysAdvisory[language]} (${role.charAt(0).toUpperCase() + role.slice(1)})`}
        </h3>
        {roleAdvisory && ('mask_recommended' in roleAdvisory ? roleAdvisory.mask_recommended : 'mask_mandated' in roleAdvisory ? roleAdvisory.mask_mandated : false) && (
          <Badge variant="warning" size="sm">
            😷 Mask recommended
          </Badge>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>
        {summary}
      </p>

      {actionItems.length > 0 && (
        <div style={{ marginTop: '0.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            {WORDS.actionItems[language]}:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
            {actionItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// The page's parts on the shared bottom bar (/shala?tab=learn): today's air and advice, the red-zone
// map around you, learning, the quiz and game, and reporting smoke. The location bar stays above every tab.
const SHALA_TABS = ['today', 'around', 'learn', 'play', 'report'] as const;
type ShalaTab = (typeof SHALA_TABS)[number];
const SHALA_BLUE = '#0369a1';
const SHALA_TAB_LABELS: Record<ShalaTab, { icon: string; label: Record<'pa' | 'hi' | 'en', string> }> = {
  today: { icon: '☀️', label: { pa: 'ਅੱਜ', hi: 'आज', en: 'Today' } },
  around: { icon: '🗺️', label: { pa: 'ਆਲੇ-ਦੁਆਲੇ', hi: 'आसपास', en: 'Around' } },
  learn: { icon: '📚', label: { pa: 'ਸਿੱਖੋ', hi: 'सीखें', en: 'Learn' } },
  play: { icon: '🎮', label: { pa: 'ਖੇਡੋ', hi: 'खेलें', en: 'Play' } },
  report: { icon: '📢', label: { pa: 'ਰਿਪੋਰਟ', hi: 'रिपोर्ट', en: 'Report' } },
};
const SHALA_TABS_NAME = { pa: 'ਸਾਂਸ ਸ਼ਾਲਾ ਦੇ ਹਿੱਸੇ', hi: 'साँस शाला के हिस्से', en: 'Saans Shala sections' };

export default function ShalaPage() {
  const { role } = useAuth();
  const { language } = useLanguage();
  const [fixtureDay, setFixtureDay] = useState<Category>('poor');
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [aroundYouOpen, setAroundYouOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [tab, go] = useUrlTab(SHALA_TABS);
  // On its own tab a section is always open.
  const aroundShown = aroundYouOpen || tab === 'around';
  const learnShown = learnOpen || tab === 'learn';
  const gameShown = gameOpen || tab === 'play';
  const shalaTabs: TabItem<ShalaTab>[] = SHALA_TABS.map((id) => ({ id, icon: SHALA_TAB_LABELS[id].icon, label: SHALA_TAB_LABELS[id].label[language] }));
  const [activityTab, setActivityTab] = useState<'quiz' | 'game'>('quiz');

  // Shared privacy-first location hook
  const {
    place,
    status: locationStatus,
    ask: askLocation,
    setPlace,
    dismissPrompt,
    promptDismissed,
    isRough,
  } = useLocation();

  const {
    status,
    air,
    advisory,
    fires,
    firesStatus,
    firesError,
    forecast,
    forecastStatus,
    forecastError,
    error,
    isStale,
    staleHours,
    refetch,
    refetchForecast,
    refetchFires,
    fetchedForPlace,
  } = useShalaAir(place, fixtureDay);

  const isDeviceReading = fetchedForPlace?.kind === 'device' && place.kind === 'device';

  const stations =
    USE_MOCKS && air
      ? DEMO_STATIONS.map((s) => ({
          ...s,
          aqi: Math.max(0, Math.min(500, air.aqi + s.aqiOffset)),
        }))
      : null;

  const isStaff = role === 'teacher' || role === 'principal';

  const stationLabel = air
    ? air.station_name && air.city && !air.station_name.includes(air.city)
      ? `${air.station_name}, ${air.city}`
      : (air.station_name || air.city || 'CPCB')
    : '';

  const stationSubtitle = air
    ? (() => {
        if (isDeviceReading) {
          const isFar = air.distance_km !== undefined && air.distance_km >= 0.5;
          const distancePart = isFar
            ? `${WORDS.nearestStation[language]}: ${stationLabel}, ${WORDS.kmAway[language].replace('{km}', String(air.distance_km))}`
            : stationLabel;
          const countPart = air.station_count
            ? `${air.station_count} ${WORDS.stations[language]}`
            : null;
          const timePart = formatMeasurementTime(air.data_timestamp);

          return [distancePart, countPart, timePart].filter(Boolean).join(' • ');
        }

        const schoolLocPart = place.district || air.city || 'Punjab';
        const stationPart = air.station_name;
        const countPart = air.station_count
          ? `${air.station_count} ${WORDS.stations[language]}`
          : null;
        const timePart = formatMeasurementTime(air.data_timestamp);

        return [schoolLocPart, stationPart, countPart, timePart].filter(Boolean).join(' • ');
      })()
    : '';

  const roleAdviceSummary = advisory
    ? (role in advisory.role_advisories
        ? advisory.role_advisories[role as keyof typeof advisory.role_advisories]?.summary
        : null) || advisory.summary
    : null;

  const firesSummary =
    firesStatus === 'error'
      ? `⚠️ ${WORDS.firesUnavailable[language]}`
      : firesStatus === 'ok' && air
      ? formatFiresWindSummary(fires.length, air.wind, language)
      : null;



  return (
    <Container maxWidth="md" className="saans-compact-mobile" style={{ paddingTop: '0.25rem', paddingBottom: '4rem' }}>
      {/* The app header (src/components/AppHeader.tsx) carries the name. */}

      <Stack gap="md">
        {/* Section A: Location bar */}
        <LocationBar
          place={place}
          status={locationStatus}
          isRough={isRough}
          language={language}
          onAsk={askLocation}
          onOpenSearch={() => setSearchDrawerOpen((open) => !open)}
        />

        {/* First visit permission prompt card */}
        {tab === 'today' && locationStatus === 'idle' && !promptDismissed && place.kind === 'school' && (
          <LocationPermissionCard
            language={language}
            onAsk={askLocation}
            onDismiss={dismissPrompt}
          />
        )}

        {/* Location permission denied help banner */}
        {locationStatus === 'denied' && (
          <Alert variant="warning">
            <div style={{ fontSize: '0.875rem' }}>
              <strong>🔒 {WORDS.locationOff[language]}:</strong> {WORDS.howToEnableLocation[language]}
            </div>
          </Alert>
        )}

        {/* Place search modal / picker */}
        {searchDrawerOpen && (
          <PlaceSearchModal
            schools={schoolsConfig.schools}
            currentPlace={place}
            language={language}
            onSelectSchool={(school) => {
              setPlace({
                kind: 'school',
                id: school.id,
                label: school.name,
                lat: school.location.lat,
                lon: school.location.lon,
                district: school.district,
              });
              setSearchDrawerOpen(false);
            }}
            onUseDevice={askLocation}
            canUseDevice={locationStatus !== 'insecure'}
            onClose={() => setSearchDrawerOpen(false)}
          />
        )}

        {/* Loading and error for the air reading: every tab but Report depends on it. */}
        {tab !== 'report' && (
          <>
        {/* Section B: Right now - Honest 3-State Representation (loading / error / ok) */}
        {status === 'loading' && <CampusOverviewSkeleton language={language} />}

        {status === 'error' && (
          <Card padding="lg">
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }} role="alert">
              <div style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>⚠️</div>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#0f172a' }}>
                {WORDS.noReading[language]}
              </h2>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#64748b' }}>
                {error || WORDS.noAdvice[language]}
              </p>
              {error && (error.toLowerCase().includes('coverage') || error.toLowerCase().includes('unsupported')) && (
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8125rem', color: '#b45309' }}>
                  ℹ️ {WORDS.coverageNotice[language]}
                </p>
              )}
              <Button variant="primary" size="md" onClick={refetch} style={{ minHeight: '44px', minWidth: '44px' }}>
                🔄 {WORDS.retry[language]}
              </Button>
            </div>
          </Card>
        )}
          </>
        )}

        <TabPanel id="today" current={tab} prefix="shala">
        <Stack gap="md">
        {status === 'ok' && air && (
          <Card
            padding="md"
            className="saans-interactive-card"
            style={{ backgroundColor: '#ffffff' }}
            role="region"
            aria-label={`Air quality ${air.aqi}, ${CATEGORY_NAMES[air.category].en.toLowerCase()}`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {/* Header row: Status chip, Badges, AQI number and Category */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                      📍 {isDeviceReading ? WORDS.nearYou[language] : (place.district ? `${place.district} Campus` : 'Campus Overview')}
                    </span>
                    {isDeviceReading && (
                      <Badge variant="neutral" size="sm">
                        ±{place.accuracyM} m
                      </Badge>
                    )}
                    {isStale ? (
                      <Badge variant="warning" size="sm">
                        ⏱️ {WORDS.staleReading[language]} ({WORDS.measuredAgo[language].replace('{hours}', String(staleHours))})
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        {WORDS.liveRecording[language]}
                      </Badge>
                    )}
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                    {WORDS.rightNow[language]}: {isDeviceReading ? WORDS.nearYou[language] : place.label}
                  </h2>
                </div>

                {/* Large AQI number + Category name beside colour */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textAlign: 'right' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                    {air.aqi}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        backgroundColor: CATEGORY_COLOURS[air.category].tint,
                        color: CATEGORY_COLOURS[air.category].ink,
                        border: `1.5px solid ${CATEGORY_COLOURS[air.category].fill}`,
                        lineHeight: 1.2,
                      }}
                    >
                      {CATEGORY_NAMES[air.category][language]}
                    </span>
                    {advisory?.grap_stage && advisory.grap_stage !== 'none' && (
                      <Badge variant="neutral" size="sm">
                        GRAP {advisory.grap_stage}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* One line of advice for current role (taken from existing advisory rules) */}
              {roleAdviceSummary && (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: CATEGORY_COLOURS[air.category].tint,
                    borderLeft: `4px solid ${CATEGORY_COLOURS[air.category].fill}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: CATEGORY_COLOURS[air.category].ink,
                    lineHeight: 1.35,
                  }}
                >
                  💡 {roleAdviceSummary}
                </div>
              )}

              {/* Station summary & collapsible secondary details */}
              <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {stationSubtitle}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  aria-expanded={detailsOpen}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.25rem 0.5rem',
                    color: '#0284c7',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {detailsOpen ? '▲' : '▼'} {WORDS.details[language]}
                </button>
              </div>

              {detailsOpen && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{WORDS.dominantPollutant[language]}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      {air.dominant_pollutant}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>PM2.5</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ea580c' }}>
                      {air.sub_indices?.pm25?.concentration !== undefined ? `${air.sub_indices.pm25.concentration} µg/m³` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{WORDS.recordedAt[language]}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                      {formatMeasurementTime(air.data_timestamp)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{WORDS.source[language]}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                      {air.station_count ? `${air.station_count} ${WORDS.stations[language]}` : 'CPCB CAAQMS'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Section C: What to do today */}
        {status === 'ok' && advisory && (
          <div id="what-to-do-today" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
              📋 {WORDS.whatToDoToday[language]}
            </h2>

            {/* SECTION_6_WRITTEN_SUMMARY_SLOT */}

            {isStaff ? (
              <>
                {/* For teacher / principal: PrincipalBoard first, then role advisory */}
                <Card padding="lg">
                  <PrincipalBoard advisory={advisory} language={language} />
                </Card>
                <Card padding="md">
                  <RoleAdvisoryCard advisory={advisory} role={role} language={language} />
                </Card>
              </>
            ) : (
              <>
                {/* For student / parent / other: role advisory first, then PrincipalBoard */}
                <Card padding="md">
                  <RoleAdvisoryCard advisory={advisory} role={role} language={language} />
                </Card>
                <Card padding="lg">
                  <PrincipalBoard advisory={advisory} language={language} />
                </Card>
              </>
            )}
          </div>
        )}

        {/* Section D: Next hours - 12-hour strip */}
        {/* SECTION_5_HOURLY_FORECAST_SLOT */}
        {status === 'ok' && (
          <ForecastStrip
            forecast={forecast}
            status={forecastStatus}
            language={language}
            onRetry={refetchForecast}
            isExample={USE_MOCKS}
          />
        )}
        </Stack>
        </TabPanel>

        <TabPanel id="around" current={tab} prefix="shala">
        {/* Section E: Around you - Collapsible Red-Zone Map (Closed by default, renders only when opened) */}
        {status === 'ok' && air && (
          <details
            open={aroundShown}
            onToggle={(e) => setAroundYouOpen(e.currentTarget.open)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <summary
              onClick={(e) => {
                if (tab === 'around') e.preventDefault();
              }}
              style={{
                padding: '0.875rem 1rem',
                cursor: 'pointer',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#0f172a',
                userSelect: 'none',
              }}
            >
              <span>🗺️ {WORDS.aroundYou[language]}</span>
              {firesSummary && (
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: firesStatus === 'error' ? '#b45309' : '#64748b',
                  }}
                >
                  {firesSummary}
                </span>
              )}
            </summary>
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
              {aroundShown && (
                firesStatus === 'error' ? (
                  <div
                    style={{
                      padding: '1.25rem 1rem',
                      textAlign: 'center',
                      backgroundColor: '#fffbeb',
                      borderRadius: '0.5rem',
                      border: '1px solid #fef3c7',
                    }}
                  >
                    <p style={{ margin: '0 0 0.75rem', color: '#92400e', fontSize: '0.875rem', fontWeight: 600 }}>
                      ⚠️ {WORDS.firesUnavailable[language]}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={refetchFires}
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      🔄 {WORDS.retry[language]}
                    </Button>
                  </div>
                ) : (
                  <RedZoneMap
                    school={{ lat: place.lat, lon: place.lon, name: place.label }}
                    wind={air.wind}
                    fires={fires}
                    stations={stations}
                    language={language}
                    demo={USE_MOCKS}
                    firesUnavailable={firesError}
                  />
                )
              )}
            </div>
          </details>
        )}
        </TabPanel>

        <TabPanel id="learn" current={tab} prefix="shala">
        {/* Section F: Learn - What's in the air (Closed by default, renders only when opened) */}
        {status === 'ok' && air && (
          <details
            open={learnShown}
            onToggle={(e) => setLearnOpen(e.currentTarget.open)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <summary
              onClick={(e) => {
                if (tab === 'learn') e.preventDefault();
              }}
              style={{
                padding: '0.875rem 1rem',
                cursor: 'pointer',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#0f172a',
                userSelect: 'none',
              }}
            >
              <span>💨 {WORDS.learnAir[language]}</span>
            </summary>
            <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {learnShown && (
                <>
                  <AirBuddy category={air.category} language={language} aqi={air.aqi} />

                  {/* Example-day fixture selector - ONLY visible in mock mode */}
                  {USE_MOCKS && (
                    <div
                      role="group"
                      aria-label={WORDS.exampleDay[language]}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        fontSize: '0.8125rem',
                        color: '#64748b',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '0.375rem',
                        border: '1px dashed #cbd5e1',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{WORDS.exampleDay[language]}:</span>
                      {CATEGORIES.map((day) => (
                        <Button
                          key={day}
                          size="sm"
                          variant={day === fixtureDay ? 'primary' : 'secondary'}
                          aria-pressed={day === fixtureDay}
                          onClick={() => setFixtureDay(day)}
                          style={{ minHeight: '44px', minWidth: '44px' }}
                        >
                          {CATEGORY_NAMES[day][language]}
                        </Button>
                      ))}
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>
                        ({WORDS.exampleData[language]})
                      </span>
                    </div>
                  )}

                  <GasCards aqi={air} language={language} />
                </>
              )}
            </div>
          </details>
        )}
        </TabPanel>

        <TabPanel id="play" current={tab} prefix="shala">
        {/* Section G: Play - Activities & Play (Interactive Quiz & Filter Frenzy Game) */}
        {status === 'ok' && air && (
          <details
            open={gameShown}
            onToggle={(e) => setGameOpen(e.currentTarget.open)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <summary
              onClick={(e) => {
                if (tab === 'play') e.preventDefault();
              }}
              style={{
                padding: '0.875rem 1rem',
                cursor: 'pointer',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#0f172a',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎯 {WORDS.activitiesAndPlay[language]}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  ({WORDS.studentQuiz[language]} • {WORDS.filterFrenzy[language]})
                </span>
              </div>
              <span style={{ fontSize: '0.8125rem', color: '#0284c7', fontWeight: 600 }}>
                {tab === 'play' ? null : gameShown ? '▲ Close' : '▶ Explore'}
              </span>
            </summary>
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
              {gameShown && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Segmented Tab Switcher */}
                  <div
                    role="tablist"
                    aria-label={WORDS.activitiesAndPlay[language]}
                    style={{
                      display: 'flex',
                      gap: '0.35rem',
                      backgroundColor: '#f1f5f9',
                      padding: '0.25rem',
                      borderRadius: '0.5rem',
                      width: 'fit-content',
                    }}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activityTab === 'quiz'}
                      onClick={() => setActivityTab('quiz')}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: activityTab === 'quiz' ? '#ffffff' : 'transparent',
                        color: activityTab === 'quiz' ? '#0284c7' : '#64748b',
                        boxShadow: activityTab === 'quiz' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s ease',
                        minHeight: '36px',
                      }}
                    >
                      📝 {WORDS.studentQuiz[language]}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activityTab === 'game'}
                      onClick={() => setActivityTab('game')}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: activityTab === 'game' ? '#ffffff' : 'transparent',
                        color: activityTab === 'game' ? '#0284c7' : '#64748b',
                        boxShadow: activityTab === 'game' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s ease',
                        minHeight: '36px',
                      }}
                    >
                      🎮 {WORDS.filterFrenzy[language]}
                    </button>
                  </div>

                  {activityTab === 'quiz' ? (
                    <StudentQuiz language={language} />
                  ) : (
                    <FilterFrenzy category={air.category} language={language} />
                  )}
                </div>
              )}
            </div>
          </details>
        )}
        </TabPanel>

        <TabPanel id="report" current={tab} prefix="shala">
        {/* Section H: Report - 4-step report sheet with status tracking */}
        <div id="report">
          <ReportSheet
            initialLocation={{
              lat: place.lat,
              lon: place.lon,
              label: place.label,
              accuracyM: place.kind === 'device' ? place.accuracyM : undefined,
            }}
            schoolLocation={
              schoolsConfig.schools[0]
                ? {
                    lat: schoolsConfig.schools[0].location.lat,
                    lon: schoolsConfig.schools[0].location.lon,
                    label: schoolsConfig.schools[0].name,
                  }
                : undefined
            }
            role={role}
            language={language}
            isInline={true}
          />
        </div>
        </TabPanel>
      </Stack>

      <BottomTabs tabs={shalaTabs} current={tab} onChange={go} prefix="shala" label={SHALA_TABS_NAME[language]} accent={SHALA_BLUE} space="shala" />
    </Container>
  );
}
