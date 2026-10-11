'use client';

// Turns changes in the reports and complaints sent from this phone into bell notifications: every 2 minutes
// (and when the tab comes back into view) it asks GET /v1/complaints/{id} for each one and notifies when its
// stage moves on or it is escalated. The first answer for a report is only remembered, so opening the app
// doesn't flood the bell with things that happened before.
import { useEffect } from 'react';

import { getComplaintStatus, isMockMode, type ComplaintStatusData } from '../lib/api';
import { notifications, type Severity } from '../lib/notifications';

const SEEN_KEY = 'saans_notif_seen_status';
const POLL_MS = 120_000;

interface Tracked {
  id: string;
  label: string;
  href: string;
}

type Words = { en: string; hi: string; pa: string };

const STAGE: Partial<Record<ComplaintStatusData['status'], { title: Words; severity: Severity }>> = {
  sent_to_officer: { title: { en: 'Your report reached an officer', hi: 'आपकी शिकायत अधिकारी तक पहुँची', pa: 'ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਅਧਿਕਾਰੀ ਤੱਕ ਪਹੁੰਚੀ' }, severity: 'info' },
  case_opened: { title: { en: 'A case was opened on your report', hi: 'आपकी शिकायत पर मामला खुला', pa: 'ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਉੱਤੇ ਮਾਮਲਾ ਖੁੱਲ੍ਹਿਆ' }, severity: 'info' },
  merged: { title: { en: 'Your report joined an earlier one', hi: 'आपकी शिकायत पहले वाली से जुड़ी', pa: 'ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਪਹਿਲੀ ਨਾਲ ਜੁੜੀ' }, severity: 'info' },
  acted_on: { title: { en: 'Action was taken on your report', hi: 'आपकी शिकायत पर कार्रवाई हुई', pa: 'ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਉੱਤੇ ਕਾਰਵਾਈ ਹੋਈ' }, severity: 'warning' },
  closed: { title: { en: 'Your report was closed', hi: 'आपकी शिकायत बंद हुई', pa: 'ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਬੰਦ ਹੋਈ' }, severity: 'info' },
};

const ESCALATED: Words = { en: 'Your report went up to the Deputy Commissioner', hi: 'आपकी शिकायत उपायुक्त तक भेजी गई', pa: 'ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਡਿਪਟੀ ਕਮਿਸ਼ਨਰ ਤੱਕ ਭੇਜੀ ਗਈ' };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Reports sent from Saans Shala's report sheet, and farmers' complaints from Kisan Saathi. */
function tracked(): Tracked[] {
  const shala = readJson<{ id: string; typeName?: string; isMock?: boolean }[]>('saans_my_reports', []);
  const kisan = readJson<{ tickets?: { id: string }[] }>('saans_kisan_tickets', {}).tickets ?? [];
  return [
    ...shala.filter((r) => r?.id && !r.isMock).map((r) => ({ id: r.id, label: r.typeName ?? 'Report', href: '/shala?tab=report' })),
    ...kisan.filter((t) => t?.id).map((t) => ({ id: t.id, label: "Farmer's complaint", href: '/kisan?tab=help' })),
  ];
}

export async function checkReports() {
  const list = tracked();
  if (!list.length) return;
  const seen = readJson<Record<string, string>>(SEEN_KEY, {});
  let changed = false;
  for (const r of list) {
    const data = (await getComplaintStatus(r.id).catch(() => null)) as (ComplaintStatusData & { escalated?: boolean }) | null;
    if (!data) continue;
    const now = `${data.status}${data.escalated ? '+escalated' : ''}`;
    const before = seen[r.id];
    if (before === now) continue;
    seen[r.id] = now;
    changed = true;
    if (before === undefined) continue; // first look: remember it, don't announce it
    if (data.escalated && !before.endsWith('+escalated')) {
      notifications.notify({
        id: `report-${r.id}-escalated`,
        title: ESCALATED,
        message: `${r.label}: no officer acted in time, so it was escalated.`,
        severity: 'urgent',
        href: r.href,
      });
    }
    const stage = STAGE[data.status];
    if (stage && !before.startsWith(data.status)) {
      notifications.notify({
        id: `report-${r.id}-${data.status}`,
        title: stage.title,
        message: `${r.label}: ${data.explanation || data.stage_label}`,
        severity: stage.severity,
        href: r.href,
      });
    }
  }
  if (changed) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      // storage blocked: we'll look again next time
    }
  }
}

export function NotificationWatcher() {
  useEffect(() => {
    if (isMockMode()) return; // example mode has no real reports to follow
    let busy = false;
    const run = () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      void checkReports().finally(() => {
        busy = false;
      });
    };
    run();
    const timer = setInterval(run, POLL_MS);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, []);
  return null;
}
