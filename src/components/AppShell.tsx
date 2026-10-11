'use client';

// What goes around each page. The welcome screens stand alone, full screen. Kisan Saathi, Saans Shala
// and Ghar ki Hawa are the app: the Blinkit-style header on top, their own tab bar and the Switch
// button below. Everything else (Command) keeps the full platform header and footer.
import React from 'react';
import { usePathname } from 'next/navigation';

import { spaceOf } from '../lib/space';
import { AppHeader } from './AppHeader';
import { AQIHeader } from './AQIHeader';
import { Header } from './Header';
import { ReportButton } from './ReportButton';

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? '/';
  if (path === '/' || path === '/welcome') return <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>;

  const space = spaceOf(path);
  if (space) {
    return (
      <>
        <AppHeader space={space} />
        <main style={{ flex: 1 }}>{children}</main>
        <ReportButton />
      </>
    );
  }

  return (
    <>
      {/* Shared App Shell Header */}
      <Header />

      {/* Shared Regional AQI Status Header */}
      <AQIHeader />

      {/* Main Module Content */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* Global Floating Report Trigger */}
      <ReportButton />

      {/* Root Civic Footer */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          padding: '1.25rem 1rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#64748b',
        }}
      >
        <div>
          <strong>Saans Platform</strong> • Clean Air Intelligence & Incident Response
        </div>
        <div style={{ marginTop: '0.25rem', color: '#94a3b8' }}>
          Four Integrated Modules: /kisan • /shala • /ghar • /command
        </div>
      </footer>
    </>
  );
}
