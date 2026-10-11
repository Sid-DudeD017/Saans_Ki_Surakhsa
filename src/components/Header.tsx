'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../lib/i18n';
import { getAqi, AqiData } from '../lib/api';
import { LanguageSwitcher, RolePicker } from './ui';
import { NotificationCenter } from './NotificationCenter';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [aqiData, setAqiData] = useState<AqiData | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(2);

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

  const navLinks = [
    { href: '/', label: t.nav.home, icon: '🌐' },
    { href: '/kisan', label: t.nav.kisan, icon: '🌾' },
    { href: '/shala', label: t.nav.shala, icon: '🏫' },
    { href: '/ghar', label: t.nav.ghar, icon: '🏠' },
    { href: '/command', label: t.nav.command, icon: '🛡️' },
  ];

  return (
    <>
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0.625rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Brand */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: '1.65rem', lineHeight: 1 }}>🌱</span>
            <div>
              <div
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#0369a1',
                  lineHeight: 1.1,
                }}
              >
                {t.appName}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
                {t.tagline}
              </div>
            </div>
          </Link>

          {/* Right Shell Controls: AQI badge, Role Picker, Lang Switcher, Notif Bell */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Live AQI indicator */}
            {aqiData && (
              <span
                title={`Dominant Pollutant: ${aqiData.dominant_pollutant}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: '#fff7ed',
                  color: '#9a3412',
                  border: '1px solid #fed7aa',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#ea580c',
                  }}
                />
                <span>AQI {aqiData.aqi}</span>
                <span style={{ opacity: 0.85 }}>• {aqiData.category}</span>
              </span>
            )}

            {/* Role dropdown */}
            <RolePicker size="sm" />

            {/* Language Switcher */}
            <LanguageSwitcher
              currentLang={language}
              onLanguageChange={setLanguage}
              size="sm"
            />

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              title="Open Notifications"
              aria-label="Open Notifications"
              style={{
                position: 'relative',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.3rem 0.5rem',
                fontSize: '0.95rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    padding: '0.1rem 0.35rem',
                    lineHeight: 1,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Module Navigation Bar */}
        <nav
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 1rem 0.5rem 1rem',
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            fontSize: '0.8125rem',
          }}
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '0.375rem',
                  textDecoration: 'none',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? '#e0f2fe' : 'transparent',
                  color: isActive ? '#0369a1' : '#475569',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <span style={{ marginRight: '0.25rem' }}>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <NotificationCenter
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onCountChange={setUnreadCount}
      />
    </>
  );
};

export default Header;
