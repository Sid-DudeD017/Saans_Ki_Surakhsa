import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { LanguageProvider } from '../lib/i18n';
import { AppShell } from '../components/AppShell';

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
              <AppShell>{children}</AppShell>
            </div>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
