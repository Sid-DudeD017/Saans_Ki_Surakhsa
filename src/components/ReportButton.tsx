'use client';

import React, { useState } from 'react';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { ReportSheet } from '../app/shala/ReportSheet';

export const ReportButton: React.FC = () => {
  const { t, language } = useLanguage();
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t.report.buttonLabel}
          className="saans-fab-button"
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
            boxShadow: '0 4px 14px rgba(234, 88, 12, 0.45)',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>📷</span>
          <span>{t.report.buttonLabel}</span>
        </button>
      </div>

      {/* Global Incident Report Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          className="saans-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            overflowY: 'auto',
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="saans-modal-sheet"
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ReportSheet
              initialLocation={{
                lat: 30.245,
                lon: 75.842,
                label: 'Near you',
              }}
              role={role}
              language={language as 'pa' | 'hi' | 'en'}
              onClose={() => setIsOpen(false)}
              isInline={false}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ReportButton;
