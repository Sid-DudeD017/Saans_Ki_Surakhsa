'use client';

import React, { useEffect, useState } from 'react';
import { getNotifications, markNotificationRead } from '../lib/api';
import { MockNotification } from '../lib/mockData';
import { Badge, Button } from './ui';

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const [notifications, setNotifications] = useState<MockNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    Promise.resolve().then(() => {
      if (!isCancelled) setLoading(true);
    });

    getNotifications()
      .then((data) => {
        if (!isCancelled) {
          setNotifications(data);
          const unread = data.filter((n) => !n.read).length;
          if (onCountChange) onCountChange(unread);
        }
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, onCountChange]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    const unread = notifications.filter((n) => n.id !== id && !n.read).length;
    if (onCountChange) onCountChange(unread);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              🔔 Notifications & Alerts
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Shared cross-module incident feed
            </span>
          </div>
          <button
            onClick={onClose}
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

        {/* List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              No notifications at this time.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                style={{
                  padding: '0.875rem',
                  borderRadius: '0.625rem',
                  border: `1px solid ${
                    n.read
                      ? '#e2e8f0'
                      : n.severity === 'urgent'
                      ? '#fecaca'
                      : '#fed7aa'
                  }`,
                  backgroundColor: n.read
                    ? '#ffffff'
                    : n.severity === 'urgent'
                    ? '#fef2f2'
                    : '#fffbeb',
                  cursor: n.read ? 'default' : 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.375rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Badge
                      variant={
                        n.severity === 'urgent'
                          ? 'danger'
                          : n.severity === 'warning'
                          ? 'warning'
                          : 'primary'
                      }
                      size="sm"
                    >
                      {n.severity.toUpperCase()}
                    </Badge>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      via {n.sourceModule}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {n.timestamp}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#334155', marginTop: '0.25rem', lineHeight: 1.4 }}>
                  {n.message}
                </div>
                {!n.read && (
                  <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 600 }}>
                      Mark read ✓
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <Button fullWidth variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
