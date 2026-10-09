'use client';

import React, { useState } from 'react';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { submitComplaint, mapCategoryToCitizenType } from '../lib/api';
import { Button } from './ui';

export const ReportButton: React.FC = () => {
  const { t } = useLanguage();
  const { role } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('Smoke');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await submitComplaint({
        category,
        description: description.trim(),
        latitude: 30.245,
        longitude: 75.842,
        lat: 30.245,
        lon: 75.842,
        reported_by_role: role,
        school_id: 'school_demo_001',
      });
      setSubmittedTicket(res.ticket_id || res.id || 'SUBMITTED');
    } catch (err) {
      console.error('Failed to submit report', err);
      setError(err instanceof Error ? err.message : 'Failed to submit incident report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSubmittedTicket(null);
    setError(null);
    setDescription('');
  };

  return (
    <>
      {/* Floating Action Button */}
      <div
        style={{
          position: 'fixed',
          // A screen with its own bottom bar (Kisan's tabs) sets --saans-bottom-bar to lift this above it.
          bottom: 'calc(1.25rem + var(--saans-bottom-bar, 0px))',
          right: '1.25rem',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t.report.buttonLabel}
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
            transition: 'transform 0.15s ease, background-color 0.15s ease',
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
          }}
          onClick={handleClose}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3
                  id="report-modal-title"
                  style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}
                >
                  📢 {t.report.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Dispatches to school response desk & local monitoring
                </span>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close modal"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem' }}>
              {submittedTicket ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#166534', fontSize: '1.1rem' }}>
                    Incident Logged Successfully
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#475569' }}>
                    Reference Ticket ID: <strong style={{ color: '#0f172a' }}>#{submittedTicket}</strong>
                  </p>
                  <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.75rem', color: '#64748b' }}>
                    Report registered for active role <strong>{role}</strong> in demo corridor.
                  </p>
                  <Button variant="primary" size="md" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div
                      style={{
                        marginBottom: '1rem',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: '0.8125rem',
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠️ {error}
                    </div>
                  )}
                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.375rem',
                      }}
                    >
                      Pollution Hazard Category
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.375rem',
                      }}
                    >
                      {['Smoke', 'Burning waste', 'Dust', 'Vehicle idling', 'Industrial', 'Other'].map(
                        (cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            style={{
                              padding: '0.4rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: `1.5px solid ${category === cat ? '#ea580c' : '#cbd5e1'}`,
                              backgroundColor: category === cat ? '#fff7ed' : '#ffffff',
                              color: category === cat ? '#c2410c' : '#334155',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            {cat}
                          </button>
                        )
                      )}
                    </div>
                    {!mapCategoryToCitizenType(category) && (
                      <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#b45309' }}>
                        ℹ️ Note: Live intake routes Smoke, Burning waste, Vehicle idling, and Firecrackers. &apos;{category}&apos; is recorded locally for campus monitoring.
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      htmlFor="report-description"
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.375rem',
                      }}
                    >
                      Incident Details & Observation
                    </label>
                    <textarea
                      id="report-description"
                      rows={3}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Open biomass burning observed upwind near school boundary..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        borderRadius: '0.375rem',
                        border: '1px solid #cbd5e1',
                        padding: '0.5rem',
                        fontSize: '0.8125rem',
                        color: '#0f172a',
                        resize: 'none',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                    }}
                  >
                    <Button variant="secondary" size="sm" type="button" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      disabled={submitting || !description.trim()}
                    >
                      {submitting ? 'Submitting...' : 'Submit Incident Report'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportButton;
