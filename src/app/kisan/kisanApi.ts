// Kisan Saathi's client for the farmer agent (P1). Every call goes to the API base URL, like the rest of
// the app: locally that's this Next.js app, whose /v1/agent/kisan/* route forwards to the agent
// (KISAN_AGENT_URL); deployed, the API gateway routes the same paths. With NEXT_PUBLIC_USE_MOCKS on
// (the default), the contract's own examples answer instead: Gurpreet's conversation, read back, filed.
import type { components } from '../../../packages/contracts/types';
import type { CoverageRequest, CoverageResponse } from './coverage';
import { mockChcs, mockCoverage, mockGrievance, mockMessage, mockPhoto, mockPlan, mockStatus, mockTicketStatus, mockVoice } from './mock';

export type { CoverageRequest, CoverageResponse };

export type MessageResponse = components['schemas']['MessageResponse'];
export type QuickReply = components['schemas']['QuickReply'];
export type KisanStatus = components['schemas']['KisanStatusResponse'];
export type StatusEntry = components['schemas']['StatusEntry'];
export type PhotoResponse = components['schemas']['PhotoResponse'];
export type MachineGuess = components['schemas']['MachineGuess'];
export type FarmHint = components['schemas']['FarmHint'];
export type PlanRequest = components['schemas']['PlanRequest'];
export type PlanResponse = components['schemas']['PlanResponse'];
export type ChcsResponse = components['schemas']['ChcsResponse'];
export type KisanGrievance = components['schemas']['KisanGrievance'];
export type ComplaintResponse = components['schemas']['ComplaintResponse'];
export type TicketStatus = components['schemas']['ComplaintStatus'];
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

const BASE = ''; // this site: the agent forwarder (/v1/agent/kisan/*, /v1/farm/*, /v1/chcs)
// Saans Command's API on AWS, for complaints and their status (src/lib/api.ts does the same for uploads).
const COMMAND_BASE = (process.env.NEXT_PUBLIC_COMMAND_API_BASE_URL || '').replace(/\/$/, '');
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';

/** An error the screen can show: the server's error.message (ErrorEnvelope), or why it couldn't be reached. */
export class KisanError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit, base = BASE): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, init);
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

/** farm: what the farm card and machine photos already say, sent with a new conversation only. */
export function sendMessage(text: string, language: Language, sessionId: string | null, farm?: FarmHint): Promise<MessageResponse> {
  if (USE_MOCKS) return mockMessage(text, language, sessionId);
  return call('/v1/agent/kisan/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, ...(sessionId ? { session_id: sessionId } : farm ? { farm } : {}) }),
  });
}

export function sendVoice(audio: Blob, filename: string, language: Language, sessionId: string | null, farm?: FarmHint): Promise<MessageResponse> {
  if (USE_MOCKS) return mockVoice(language, sessionId);
  const form = new FormData();
  form.append('audio', audio, filename);
  form.append('language', language);
  if (sessionId) form.append('session_id', sessionId);
  else if (farm) form.append('farm', JSON.stringify(farm));
  return call('/v1/agent/kisan/voice', { method: 'POST', body: form });
}

/** How much of the paddy the farmer's own machines clear before the wheat deadline (K10). */
export function getCoverage(req: CoverageRequest): Promise<CoverageResponse> {
  if (USE_MOCKS) return mockCoverage(req);
  return call('/v1/farm/coverage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
}

/** CHCs near the farm that have this machine, nearest first (K14's "Rent from a CHC"). */
export function getChcs(where: { lat: number; lon: number } | { village: string }, machine: string, maxKm = 25): Promise<ChcsResponse> {
  if (USE_MOCKS) return mockChcs(machine);
  const q = new URLSearchParams({ machine, max_km: String(maxKm) });
  for (const [k, v] of Object.entries(where)) q.set(k, String(v));
  return call(`/v1/chcs?${q}`);
}

/**
 * A farmer's complaint to Saans Command (K20). The idempotency key is the draft's: a retry after a
 * dropped connection sends the same key, so the farmer gets one ticket, not two.
 */
export function submitGrievance(body: KisanGrievance, idempotencyKey: string): Promise<ComplaintResponse> {
  if (USE_MOCKS) return mockGrievance(idempotencyKey);
  return call('/v1/complaints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  }, COMMAND_BASE);
}

/** Where a ticket has got to (K21): GET /v1/complaints/{id}. */
export function getTicketStatus(id: string): Promise<TicketStatus> {
  if (USE_MOCKS) return mockTicketStatus(id);
  return call(`/v1/complaints/${encodeURIComponent(id)}`, undefined, COMMAND_BASE);
}

/** The zero-burn plan: CHC machines for the gap on dry days, and what's still short (K11). */
export function getPlan(req: PlanRequest): Promise<PlanResponse> {
  if (USE_MOCKS) return mockPlan();
  return call('/v1/farm/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
}

/**
 * A machine photo (K7). The agent cleans it (faces blurred, metadata removed), keeps only that copy, and
 * guesses the machine. With a session, the photo's GPS can become the farm's location there.
 */
export function sendPhoto(photo: Blob, filename: string, sessionId: string | null): Promise<PhotoResponse> {
  if (USE_MOCKS) return mockPhoto();
  const form = new FormData();
  form.append('photo', photo, filename);
  if (sessionId) form.append('session_id', sessionId);
  return call('/v1/agent/kisan/photo', { method: 'POST', body: form });
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
