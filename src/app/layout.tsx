import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { LanguageProvider } from '../lib/i18n';
import { Header } from '../components/Header';
import { AQIHeader } from '../components/AQIHeader';
import { ReportButton } from '../components/ReportButton';

export const metadata: Metadata = {
  title: 'Saans — Clean Air Intelligence Platform',
  description:
    'Integrated environmental platform connecting Kisan Saathi, Saans Shala, Ghar ki Hawa, and Command.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <LanguageProvider>
            <div
              style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f8fafc',
              }}
            >
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
            </div>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
