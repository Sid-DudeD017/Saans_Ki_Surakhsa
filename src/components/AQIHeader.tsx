'use client';

import React, { useEffect, useState } from 'react';
import { getAqi, AqiData } from '../lib/api';

export interface AQIHeaderProps {
  lat?: number;
  lon?: number;
}

export const AQIHeader: React.FC<AQIHeaderProps> = ({
  lat = 28.73,
  lon = 77.12,
}) => {
  const [aqiData, setAqiData] = useState<AqiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchCurrentAqi = (targetLat: number, targetLon: number) => {
      getAqi(targetLat, targetLon)
        .then((data) => {
          if (active) {
            setAqiData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error('Failed to load AQI for header', err);
          if (active) setLoading(false);
        });
    };

    let activeLat = lat;
    let activeLon = lon;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          activeLat = pos.coords.latitude;
          activeLon = pos.coords.longitude;
          if (active) fetchCurrentAqi(activeLat, activeLon);
        },
        () => {
          if (active) fetchCurrentAqi(activeLat, activeLon);
        },
        { timeout: 3000 }
      );
    } else {
      fetchCurrentAqi(activeLat, activeLon);
    }

    // Continuously record/refresh every 2 minutes
    const interval = setInterval(() => {
      if (active) fetchCurrentAqi(activeLat, activeLon);
    }, 120_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [lat, lon]);

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.4rem 1rem',
          fontSize: '0.75rem',
          color: '#64748b',
          textAlign: 'center',
        }}
      >
        Loading air quality intelligence...
      </div>
    );
  }

  if (!aqiData) return null;

  // CPCB color bands
  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'good':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
      case 'satisfactory':
        return { bg: '#ecfccb', text: '#3f6212', border: '#bef264' };
      case 'moderate':
        return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
      case 'poor':
        return { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' };
      case 'very poor':
      case 'very_poor':
        return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'severe':
        return { bg: '#fdf2f8', text: '#831843', border: '#fbcfe8' };
      default:
        return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
    }
  };

  const colors = getCategoryColor(aqiData.category);

  return (
    <aside
      aria-label="Regional Air Quality Indicator"
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.4rem 1rem',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.75rem',
        }}
      >
        {/* Left: Location & Station */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#0369a1', fontWeight: 700 }}>📍 Regional Air</span>
          <span style={{ color: '#475569' }}>
            {aqiData.station_name || 'Anand Vihar / Sangrur Corridor'}
          </span>
          {aqiData.distance_km && (
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
              ({aqiData.distance_km} km away)
            </span>
          )}
        </div>

        {/* Right: AQI Metrics & Category Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#475569' }}>
            Dominant: <strong style={{ color: '#0f172a' }}>{aqiData.dominant_pollutant}</strong>
            {aqiData.pm25 ? ` (${aqiData.pm25} µg/m³)` : ''}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.15rem 0.55rem',
              borderRadius: '9999px',
              backgroundColor: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: colors.text,
              }}
            />
            AQI {aqiData.aqi} • {aqiData.category}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default AQIHeader;
