'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { getAqi, AqiData } from '../lib/api';
import { Card, Button, Container, Stack, Badge, Alert } from '../components/ui';

export default function RootPage() {
  const { role, setRole } = useAuth();
  const { t } = useLanguage();
  const [aqiData, setAqiData] = useState<AqiData | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchCurrentAqi = (lat: number, lon: number) => {
      getAqi(lat, lon)
        .then((data) => {
          if (mounted) setAqiData(data);
        })
        .catch((err) => console.error('Failed to load AQI', err));
    };

    let activeLat = 28.73;
    let activeLon = 77.12;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          activeLat = pos.coords.latitude;
          activeLon = pos.coords.longitude;
          if (mounted) fetchCurrentAqi(activeLat, activeLon);
        },
        () => {
          if (mounted) fetchCurrentAqi(activeLat, activeLon);
        },
        { timeout: 3000 }
      );
    } else {
      fetchCurrentAqi(activeLat, activeLon);
    }

    const interval = setInterval(() => {
      if (mounted) fetchCurrentAqi(activeLat, activeLon);
    }, 120_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const modules = [
    {
      href: '/kisan',
      icon: '🌾',
      title: 'Kisan Saathi',
      owner: 'P1 Owned',
      badgeVariant: 'warning' as const,
      desc: 'Farmer speech agent, zero-burn straw management, and Custom Hiring Centre (CHC) equipment allocation.',
    },
    {
      href: '/shala',
      icon: '🏫',
      title: 'Saans Shala',
      owner: 'P2 Owned',
      badgeVariant: 'primary' as const,
      desc: 'School air quality monitoring, child-friendly Air Buddy advisories, and campus pollution incident reporting.',
    },
    {
      href: '/ghar',
      icon: '🏠',
      title: 'Ghar ki Hawa',
      owner: 'P3 Owned',
      badgeVariant: 'primary' as const,
      desc: 'Inverse-distance AQI modeling, indoor infiltration estimation, and clean walking/cycling commute routes.',
    },
    {
      href: '/command',
      icon: '🛡️',
      title: 'Command Console',
      owner: 'P4 Owned',
      badgeVariant: 'danger' as const,
      desc: 'City-scale case triage, automated satellite cluster correlation, and municipal squad intervention dispatch.',
    },
  ];

  return (
    <Container maxWidth="lg" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      {/* Hero Welcome */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>🌱</span>
        <h1 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '2rem', color: '#0f172a', fontWeight: 800 }}>
          {t.appName} — Clean Air Platform
        </h1>
        <p style={{ margin: '0 auto', maxWidth: '600px', fontSize: '1rem', color: '#475569', lineHeight: 1.5 }}>
          Unified civic and environmental health intelligence connecting:
          <br />
          <strong>Air data → Pollution event → People affected → Action/report → Command → Notification → Outcome</strong>
        </p>
      </div>

      {/* Live Baseline Banner */}
      <Card padding="md" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              📍 {aqiData?.station_name ? aqiData.station_name : 'Regional Monitoring Corridor'}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                {aqiData?.aqi ?? 159}
              </span>
              <div>
                <Badge variant={aqiData?.category === 'Good' || aqiData?.category === 'Satisfactory' ? 'success' : aqiData?.category === 'Moderate' ? 'warning' : 'danger'} size="md">
                  {aqiData?.category ?? 'Moderate'}
                </Badge>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Dominant: {aqiData?.dominant_pollutant ?? 'PM2.5'} ({aqiData?.pm25 ?? 159} µg/m³)
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Persona:</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0369a1', textTransform: 'capitalize' }}>
              {role}
            </div>
          </div>
        </div>
      </Card>

      {/* Four Modules Grid */}
      <div>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#0f172a' }}>
          Integrated System Modules (G1 Gate Standard)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {modules.map((m) => (
            <Card key={m.href} padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{m.icon}</span>
                <Badge variant={m.badgeVariant} size="sm">
                  {m.owner}
                </Badge>
              </div>
              <h3 style={{ margin: '0.25rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
                {m.title}
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, minHeight: '3.6em' }}>
                {m.desc}
              </p>
              <Link href={m.href} style={{ textDecoration: 'none' }}>
                <Button fullWidth size="sm" variant={m.href === '/shala' ? 'primary' : 'secondary'}>
                  Open {m.title} →
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}
