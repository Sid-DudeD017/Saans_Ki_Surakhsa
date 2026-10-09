'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import {
  getAqi,
  getSchoolAdvisory,
  submitComplaint,
  mapCategoryToCitizenType,
  AqiData,
  SchoolAdvisoryData,
} from '../../lib/api';
import { Card, Button, Container, Stack, Badge, Alert } from '../../components/ui';
import { AirBuddy } from './AirBuddy';
import { CATEGORIES, CATEGORY_NAMES, WORDS, type Category } from './airQuality';
import { AQI_FIXTURES } from './aqiFixtures';
import { SCHOOLS, buildAdvisory, type SchoolAdvisory } from './advisory';
import { FilterFrenzy } from './FilterFrenzy';
import { GasCards } from './GasCards';
import { PrincipalBoard } from './PrincipalBoard';
import { RedZoneMap } from './RedZoneMap';
import { DEMO_FIRES, DEMO_STATIONS } from './redZoneFixtures';
import { USE_MOCKS, getAdvisory, getAir, getFires, type FirePoint } from './shalaApi';
import type { AqiResponse } from './airQuality';

const SCHOOL = SCHOOLS[0];
const FIRE_RADIUS_KM = 25;

export default function ShalaPage() {
  const { role, user } = useAuth();
  const { t, language } = useLanguage();
  const [fixtureDay, setFixtureDay] = useState<Category>('poor');
  // Mock mode: the example day drives everything. Live: P3's AQI and fires, and Shala's own advisory API.
  const [live, setLive] = useState<{ air?: AqiResponse; advisory?: SchoolAdvisory; fires?: FirePoint[]; error?: string; firesError?: string }>({});
  useEffect(() => {
    if (USE_MOCKS) return;
    let on = true;
    const { lat, lon } = SCHOOL.location;
    // The fires are extra: without them the map says so, and the rest of the page still works.
    Promise.allSettled([getAir(lat, lon, 'poor'), getAdvisory(SCHOOL.id, 'poor'), getFires(lat, lon, FIRE_RADIUS_KM)]).then(([air, advisory, fires]) => {
      if (!on) return;
      const why = (r: PromiseSettledResult<unknown>) => (r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : undefined);
      setLive({
        air: air.status === 'fulfilled' ? air.value : undefined,
        advisory: advisory.status === 'fulfilled' ? advisory.value : undefined,
        fires: fires.status === 'fulfilled' ? fires.value : [],
        error: why(air) ?? why(advisory),
        firesError: why(fires),
      });
    });
    return () => {
      on = false;
    };
  }, []);
  const airDay = USE_MOCKS ? AQI_FIXTURES[fixtureDay] : live.air;
  const schoolAdvisory = USE_MOCKS && airDay ? buildAdvisory(SCHOOL, airDay, new Date(airDay.data_timestamp)) : live.advisory;
  const fires = USE_MOCKS ? DEMO_FIRES : (live.fires ?? []);
  const stations = USE_MOCKS && airDay
    ? DEMO_STATIONS.map((s) => ({ ...s, aqi: Math.max(0, Math.min(500, airDay.aqi + s.aqiOffset)) }))
    : null;

  const [aqiData, setAqiData] = useState<AqiData | null>(null);
  const [advisory, setAdvisory] = useState<SchoolAdvisoryData | null>(null);
  const [loading, setLoading] = useState(true);

  // 3-step reporting flow state
  const [reportCategory, setReportCategory] = useState('Smoke');
  const [reportDescription, setReportDescription] = useState(
    'Dense smoke observed near playground boundary wall.'
  );
  const [reportSubmitted, setReportSubmitted] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getAqi(28.6472, 77.3058),
      getSchoolAdvisory('school_demo_001', role),
    ])
      .then(([aqiRes, advRes]) => {
        if (mounted) {
          setAqiData(aqiRes);
          setAdvisory(advRes);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [role]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setReportError(null);
    try {
      const res = await submitComplaint({
        category: reportCategory,
        description: reportDescription,
        latitude: SCHOOL.location.lat,
        longitude: SCHOOL.location.lon,
        lat: SCHOOL.location.lat,
        lon: SCHOOL.location.lon,
        photo: 'mock/photo/smoke_demo.jpg',
        school_id: SCHOOL.id,
        reported_by_role: role,
      });
      setReportSubmitted(res.ticket_id || res.id || 'SUBMITTED');
    } catch (err) {
      console.error('Failed to submit report', err);
      setReportError(err instanceof Error ? err.message : 'Failed to submit incident report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      {/* Module Title Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Badge variant="primary" size="md">
            P2 MODULE
          </Badge>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            School Air Quality & Child Health Intelligence
          </span>
        </div>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>
          🏫 Saans Shala
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          Real-time CPCB air quality tracking, child-friendly advisories, and school incident reporting.
        </p>
      </div>

      <Stack gap="lg">
        {/* Campus Overview Card */}
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                📍 Demo Campus Specification
              </span>
              <h2 style={{ margin: '0.25rem 0', fontSize: '1.35rem', color: '#0f172a' }}>
                {advisory?.school_name || 'Government Model School — Demo Campus'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                East Delhi • Anand Vihar Environmental Monitoring Corridor
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                {aqiData?.aqi ?? 287}
              </div>
              <Badge variant="warning" size="sm" style={{ marginTop: '0.25rem' }}>
                {aqiData?.category ?? 'Poor'} (GRAP {advisory?.grap_stage ?? 'Stage II'})
              </Badge>
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
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Dominant Pollutant</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                {aqiData?.dominant_pollutant ?? 'PM2.5'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>PM2.5 Level</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ea580c' }}>
                {aqiData?.pm25 ?? 168} µg/m³
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Role</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0369a1', textTransform: 'capitalize' }}>
                {role}
              </div>
            </div>
          </div>
        </Card>

        {/* Air Buddy, the gas cards, the principal's board, the red-zone map and Filter Frenzy (P2) */}
        {live.error && <Alert variant="danger">{live.error}</Alert>}
        {airDay && (
          <>
            <AirBuddy category={airDay.category} language={language} aqi={airDay.aqi} />
            {USE_MOCKS && (
              <div role="group" aria-label={WORDS.exampleDay[language]} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: '#64748b' }}>
                <span>{WORDS.exampleDay[language]}:</span>
                {CATEGORIES.map((day) => (
                  <Button key={day} size="sm" variant={day === fixtureDay ? 'primary' : 'secondary'} aria-pressed={day === fixtureDay} onClick={() => setFixtureDay(day)}>
                    {CATEGORY_NAMES[day][language]}
                  </Button>
                ))}
              </div>
            )}
            {schoolAdvisory && (
              <Card padding="lg">
                <PrincipalBoard advisory={schoolAdvisory} language={language} />
              </Card>
            )}
            <Card padding="lg">
              <GasCards aqi={airDay} language={language} />
            </Card>
            <Card padding="lg">
              <RedZoneMap
                school={{ ...SCHOOL.location, name: SCHOOL.name }}
                wind={airDay.wind}
                fires={fires}
                stations={stations}
                language={language}
                demo={USE_MOCKS}
                firesUnavailable={live.firesError}
              />
            </Card>
            <Card padding="lg">
              <FilterFrenzy category={airDay.category} language={language} />
            </Card>
          </>
        )}

        {/* Today's Advisory Card */}
        <Card padding="md">
          <h3 style={{ margin: '0 0 0.375rem 0', fontSize: '1rem', color: '#0f172a' }}>
            📋 Today&apos;s Advisory for {role.charAt(0).toUpperCase() + role.slice(1)}:
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
            {advisory?.summary ||
              'GRAP Stage II active. Outdoor physical training is suspended. Keep classroom windows closed during high-traffic hours.'}
          </p>
        </Card>

        {/* Rapid 3-Step Reporting Section */}
        <div id="report">
          <Card padding="lg">
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
              📢 Report Smoke or Dust Incident
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: '#64748b' }}>
              Reports are dispatched to the school response desk and local monitoring team.
            </p>

            {reportSubmitted ? (
              <div style={{ backgroundColor: '#f0fdf4', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <h4 style={{ margin: '0.25rem 0', color: '#166534' }}>Report Logged Successfully!</h4>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#14532d' }}>
                  Reference Ticket ID: <strong>#{reportSubmitted}</strong>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setReportSubmitted(null);
                    setReportError(null);
                  }}
                >
                  Report Another Incident
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit}>
                <Stack gap="md">
                  {reportError && (
                    <Alert variant="danger">
                      {reportError}
                    </Alert>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>
                      1. Pollution Source Category
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                      {['Smoke', 'Burning waste', 'Dust', 'Vehicle idling', 'Industrial', 'Other'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setReportCategory(cat)}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            border: `1.5px solid ${reportCategory === cat ? '#0369a1' : '#cbd5e1'}`,
                            backgroundColor: reportCategory === cat ? '#e0f2fe' : '#ffffff',
                            color: reportCategory === cat ? '#0369a1' : '#334155',
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {!mapCategoryToCitizenType(reportCategory) && (
                      <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#b45309' }}>
                        ℹ️ Note: Live intake routes Smoke, Burning waste, Vehicle idling, and Firecrackers. &apos;{reportCategory}&apos; is recorded locally for campus monitoring.
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      2. Location
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${SCHOOL.name} (${SCHOOL.location.lat}°N, ${SCHOOL.location.lon}°E)`}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                        fontSize: '0.8125rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      3. Description & Details
                    </label>
                    <textarea
                      rows={2}
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8125rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting Report...' : 'Submit Incident (POST /v1/complaints)'}
                  </Button>
                </Stack>
              </form>
            )}
          </Card>
        </div>
      </Stack>
    </Container>
  );
}
