// Kisan Saathi's client for the farmer agent (P1). Every call goes to the API base URL, like the rest of
// the app: locally that's this Next.js app, whose /v1/agent/kisan/* route forwards to the agent
// (KISAN_AGENT_URL); deployed, the API gateway routes the same paths. With NEXT_PUBLIC_USE_MOCKS on
// (the default), the contract's own examples answer instead: Gurpreet's conversation, read back, filed.
import type { components } from '../../../packages/contracts/types';
import { mockMessage, mockStatus, mockVoice } from './mock';

export type MessageResponse = components['schemas']['MessageResponse'];
export type QuickReply = components['schemas']['QuickReply'];
export type KisanStatus = components['schemas']['KisanStatusResponse'];
export type StatusEntry = components['schemas']['StatusEntry'];
export type Language = 'pa' | 'hi' | 'en';

/** One line of the read-back card (agent_kisan/readback.py). */
export interface CardItem {
  kind: 'paddy' | 'harvest' | 'wheat_by' | 'tractors' | 'machine' | 'coverage' | 'booking' | 'coverage_after' | 'short' | string;
  icon?: string;
  value: string;
  unit?: string;
  label?: string;
  chc?: string;
  acres?: number;
  cost_inr?: number;
}

export interface Readback {
  card: { language: Language; items: CardItem[]; spoken?: boolean };
  text: string;
  audio_url: string | null;
}

export interface Transcript {
  text: string;
  unsure_numbers?: string[];
  seconds?: number;
}

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';

/** An error the screen can show: the server's error.message (ErrorEnvelope), or why it couldn't be reached. */
export class KisanError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new KisanError('network', 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new KisanError(body?.error?.message ?? res.statusText, res.status, body?.error?.code);
  }
  return res.json() as Promise<T>;
}

export function readbackOf(r: MessageResponse): Readback | null {
  return (r.readback as Readback | null | undefined) ?? null;
}

export function transcriptOf(r: MessageResponse): Transcript | null {
  return (r.transcript as Transcript | null | undefined) ?? null;
}

export function sendMessage(text: string, language: Language, sessionId: string | null): Promise<MessageResponse> {
  if (USE_MOCKS) return mockMessage(text, language, sessionId);
  return call('/v1/agent/kisan/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, ...(sessionId ? { session_id: sessionId } : {}) }),
  });
}

export function sendVoice(audio: Blob, filename: string, language: Language, sessionId: string | null): Promise<MessageResponse> {
  if (USE_MOCKS) return mockVoice(language, sessionId);
  const form = new FormData();
  form.append('audio', audio, filename);
  form.append('language', language);
  if (sessionId) form.append('session_id', sessionId);
  return call('/v1/agent/kisan/voice', { method: 'POST', body: form });
}

export function getStatus(sessionId: string): Promise<KisanStatus> {
  if (USE_MOCKS) return mockStatus(sessionId);
  return call(`/v1/agent/kisan/sessions/${encodeURIComponent(sessionId)}/status`);
}

/** Where to play the read-back from; null when it isn't spoken (English) or in mock mode. */
export function audioUrl(readback: Readback): string | null {
  if (!readback.audio_url || USE_MOCKS) return null;
  return `${BASE}${readback.audio_url}`;
}
