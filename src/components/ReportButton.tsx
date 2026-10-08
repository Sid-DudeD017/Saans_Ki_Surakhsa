'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../lib/i18n';

export const ReportButton: React.FC = () => {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 40,
      }}
    >
      <Link
        href="/shala#report"
        aria-label="Report pollution hazard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.15rem',
          backgroundColor: '#ea580c', // High-visibility hazard orange
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.875rem',
          border: 'none',
          borderRadius: '9999px',
          boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
        }}
      >
        <span style={{ fontSize: '1.15rem' }}>📷</span>
        <span>{t.report.buttonLabel}</span>
      </Link>
    </div>
  );
};

export default ReportButton;
