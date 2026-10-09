// Kisan Saathi's screens (P1): the strings, the mock conversation and the /v1/agent/kisan/* forwarder.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockMessage, mockStatus, mockVoice } from '../app/kisan/mock';
import { STATUS_ORDER, cardLabel, indiaClock, say, statusLabel } from '../app/kisan/strings';
import { GET, POST } from '../app/v1/agent/kisan/[...path]/route';

describe('screen text', () => {
  it('dates are India time with the month in the farmer language', () => {
    expect(indiaClock('2026-10-20T18:02:00+05:30', 'pa')).toBe('20 ਅਕਤੂਬਰ, 18:02');
    expect(indiaClock('2026-10-09T03:35:23.983Z', 'hi')).toBe('9 अक्टूबर, 09:05');
    expect(indiaClock('2026-11-02T00:00:00+05:30', 'en')).toBe('2 Nov, 00:00');
    expect(indiaClock('not a date', 'en')).toBe('not a date');
  });

  it('every status and every read-back line has a label in all three languages', () => {
    for (const status of STATUS_ORDER) for (const l of ['pa', 'hi', 'en'] as const) expect(statusLabel(status, l)).not.toBe(status);
    for (const kind of ['paddy', 'harvest', 'wheat_by', 'tractors', 'machine', 'decomposer', 'coverage', 'booking', 'coverage_after', 'short']) {
      for (const l of ['pa', 'hi', 'en'] as const) expect(cardLabel(kind, l)).not.toBe(kind);
    }
  });

  it('the yes button says yes, the no button says no', () => {
    expect(say('yesSays', 'pa')).toBe('ਹਾਂ ਜੀ');
    expect(say('noSays', 'hi')).toContain('नहीं');
  });
});

describe('mock conversation (contract examples)', () => {
  it('reads back, then files on the next message', async () => {
    const first = await mockMessage('ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'pa', null);
    expect(first.filed).toBe(false);
    expect((first.readback as { card: { items: { kind: string }[] } }).card.items.map((i) => i.kind)).toContain('short');
    const second = await mockMessage('ਹਾਂ ਜੀ', 'pa', first.session_id);
    expect(second).toMatchObject({ filed: true, session_id: first.session_id, readback: null });
  });

  it('a voice note shows what was heard', async () => {
    const r = await mockVoice('pa', null);
    expect((r.transcript as { text: string }).text).toContain('ਅਠਾਰਾਂ ਕਿੱਲੇ');
  });

  it('status follows the session', async () => {
    const s = await mockStatus('abc123');
    expect(s.helpRequestId).toBe('kisan-abc123');
    expect(s.history.map((h) => h.status)).toEqual(['filed', 'machine_assigned']);
  });
});

describe('/v1/agent/kisan/* forwards to the agent', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

  it('passes the method, path, query, type and body through, and the answer back', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response('{"session_id":"s1"}', { status: 200, headers: { 'content-type': 'application/json', 'x-internal': 'no' } });
    }));
    const res = await POST(
      new Request('http://app.test/v1/agent/kisan/messages?debug=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: 'secret=1' },
        body: '{"text":"ਹਾਂ"}',
      }),
      ctx(['messages']),
    );
    expect(seen[0].url).toBe('http://127.0.0.1:8001/v1/agent/kisan/messages?debug=1');
    expect(seen[0].init.method).toBe('POST');
    expect(new TextDecoder().decode(seen[0].init.body as ArrayBuffer)).toBe('{"text":"ਹਾਂ"}');
    const sent = seen[0].init.headers as Headers;
    expect(sent.get('content-type')).toBe('application/json');
    expect(sent.get('cookie')).toBeNull();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session_id: 's1' });
    expect(res.headers.get('x-internal')).toBeNull();
  });

  it('keeps the read-back audio as audio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })));
    const res = await GET(new Request('http://app.test/v1/agent/kisan/sessions/s1/readback.wav'), ctx(['sessions', 's1', 'readback.wav']));
    expect(res.headers.get('content-type')).toBe('audio/wav');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));
  });

  it('answers 503 in the shared error shape when the agent is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const res = await GET(new Request('http://app.test/v1/agent/kisan/sessions/s1/status'), ctx(['sessions', 's1', 'status']));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('unavailable');
  });
});
