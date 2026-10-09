'use client';
import { useState, useEffect, useCallback } from 'react';

// Format: YYYY-MM-DD string
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ChecksStorage {
  date: string;
  checks: Record<string, boolean>;
}

export function usePlanChecks() {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const today = getTodayStr();
      const raw = localStorage.getItem('saans_ghar_checks');
      if (raw) {
        const parsed = JSON.parse(raw) as ChecksStorage;
        if (parsed.date === today && parsed.checks) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setChecks(parsed.checks);
        } else {
          // It's a new day or invalid format
          setChecks({});
        }
      }
    } catch (e) {
      // Missing, malformed, or outdated
      setChecks({});
    }
    setReady(true);
  }, []);

  const toggleCheck = useCallback((uid: string) => {
    setChecks(prev => {
      const next = { ...prev, [uid]: !prev[uid] };
      try {
        localStorage.setItem('saans_ghar_checks', JSON.stringify({
          date: getTodayStr(),
          checks: next
        }));
      } catch (e) {
        // Safe fail
      }
      return next;
    });
  }, []);

  return { checks, toggleCheck, ready };
}
