// The bell's notifications (lib/notifications.ts): real events only, kept on the phone, read state that
// survives a reload; the watcher announces a report's change of stage, never its first look.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, string>;

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => true });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('notifications', () => {
  it('adds each event once, newest first, and keeps read state in storage', async () => {
    const { notifications } = await import('../lib/notifications');
    expect(notifications.notify({ id: 'a', title: 'First', message: 'one', severity: 'info' })).toBe(true);
    expect(notifications.notify({ id: 'b', title: 'Second', message: 'two', severity: 'urgent' })).toBe(true);
    expect(notifications.notify({ id: 'a', title: 'First again', message: 'dup', severity: 'info' })).toBe(false);
    expect(notifications.list().map((n) => n.id)).toEqual(['b', 'a']);

    notifications.markRead('a');
    expect(notifications.list().filter((n) => !n.read).map((n) => n.id)).toEqual(['b']);
    notifications.markAllRead();
    expect(notifications.list().every((n) => n.read)).toBe(true);

    // A reload reads the same list back.
    vi.resetModules();
    const again = await import('../lib/notifications');
    expect(again.notifications.list().map((n) => [n.id, n.read])).toEqual([
      ['b', true],
      ['a', true],
    ]);
  });

  it('says how long ago in the reader’s language', async () => {
    const { ago } = await import('../lib/notifications');
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(ago('2026-10-11T11:59:30Z', 'en', now)).toBe('Just now');
    expect(ago('2026-10-11T11:55:00Z', 'en', now)).toBe('5 min ago');
    expect(ago('2026-10-11T09:00:00Z', 'hi', now)).toBe('3 घंटे पहले');
    expect(ago('2026-10-09T12:00:00Z', 'pa', now)).toBe('2 ਦਿਨ ਪਹਿਲਾਂ');
  });

  it('a report sent tells the bell it was received', async () => {
    const { submitComplaint } = await import('../lib/api');
    const { notifications } = await import('../lib/notifications');
    const res = await submitComplaint({ category: 'Smoke', description: 'Burning behind the school', lat: 30.245, lon: 75.842 });
    const n = notifications.list()[0];
    expect(n.id).toBe(`report-${res.id}-received`);
    expect(typeof n.title === 'object' && n.title.en).toBe('Report received');
    expect(n.href).toBe('/shala?tab=report');
  });

  it("the watcher announces a report's next stage and escalation, not its first look", async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    store['saans_my_reports'] = JSON.stringify([{ id: 'complaint-abc', typeName: 'Farm fire', isMock: false }]);
    const answers = [
      { id: 'complaint-abc', status: 'received', stage_label: 'Report received', explanation: 'Queued.' },
      { id: 'complaint-abc', status: 'case_opened', stage_label: 'Case opened', explanation: 'Authorities were notified.' },
      { id: 'complaint-abc', status: 'case_opened', stage_label: 'Case opened', explanation: 'Authorities were notified.', escalated: true },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => answers.shift() })));
    const { checkReports } = await import('../components/NotificationWatcher');
    const { notifications } = await import('../lib/notifications');

    await checkReports(); // first look: remembered, not announced
    expect(notifications.list()).toHaveLength(0);
    await checkReports(); // received -> case opened
    expect(notifications.list().map((n) => n.id)).toEqual(['report-complaint-abc-case_opened']);
    await checkReports(); // escalated, same stage: one escalation notice, no second "case opened"
    expect(notifications.list().map((n) => n.id)).toEqual(['report-complaint-abc-escalated', 'report-complaint-abc-case_opened']);
    expect(notifications.list()[0].severity).toBe('urgent');
  });
});
