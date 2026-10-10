// NEXT_PUBLIC_USE_MOCKS: Gurpreet's conversation from P1's contract examples, which contract.py records
// from real calls to the agent. The first message gets the read-back, the next one files it. The
// proposal is loaded only when mocks are on, so it stays out of the normal bundle.
import { coverageResponse, type CoverageRequest, type CoverageResponse } from './coverage';
import type { ChcsResponse, ComplaintResponse, KisanStatus, Language, MessageResponse, PhotoResponse, PlanResponse, TicketSmsResponse, TicketStatus } from './kisanApi';

type Proposal = { paths: Record<string, Record<string, { responses: Record<string, { content: Record<string, { example: unknown }> }> }>> };

async function example<T>(path: string, method = 'post'): Promise<T> {
  const proposal = (await import('../../../packages/contracts/proposals/p1-kisan.openapi.json')).default as unknown as Proposal;
  return structuredClone(proposal.paths[path][method].responses['200'].content['application/json'].example) as T;
}

// What the agent says once the request is filed (agent_kisan/contract.py's scripted turn 2).
const FILED: Record<Language, string> = {
  pa: 'ਤੁਹਾਡੀ ਮਦਦ ਦੀ ਬੇਨਤੀ ਖੇਤੀਬਾੜੀ ਵਿਭਾਗ ਕੋਲ ਭੇਜ ਦਿੱਤੀ ਹੈ। ਹਾਲੇ ਬਾਕੀ ਡੇਢ ਕਿੱਲੇ।',
  hi: 'आपकी मदद की बिनती कृषि विभाग को भेज दी गई है। अभी डेढ़ किल्ला बाकी है।',
  en: 'Your request for help has gone to the agriculture department. 1.5 acres are still short.',
};

const readBack = new Set<string>();
const pause = () => new Promise((r) => setTimeout(r, 600));

export async function mockMessage(_text: string, language: Language, sessionId: string | null): Promise<MessageResponse> {
  await pause();
  if (sessionId && readBack.has(sessionId)) {
    return { session_id: sessionId, reply: FILED[language], missing: [], quick_replies: [], filed: true, transcript: null, readback: null };
  }
  const reply = await example<MessageResponse>('/v1/agent/kisan/messages');
  readBack.add(reply.session_id);
  return reply;
}

export async function mockVoice(language: Language, sessionId: string | null): Promise<MessageResponse> {
  if (sessionId && readBack.has(sessionId)) return mockMessage('', language, sessionId);
  await pause();
  const reply = await example<MessageResponse>('/v1/agent/kisan/voice');
  readBack.add(reply.session_id);
  return reply;
}

export async function mockStatus(sessionId: string): Promise<KisanStatus> {
  await pause();
  const status = await example<KisanStatus>('/v1/agent/kisan/sessions/{session_id}/status', 'get');
  return { ...status, helpRequestId: `kisan-${sessionId}` };
}

/** The contract's photo example: a Super Seeder, 86% sure. */
export async function mockPhoto(): Promise<PhotoResponse> {
  await pause();
  return example<PhotoResponse>('/v1/agent/kisan/photo');
}

/** The coverage engine's copy (coverage.ts), so the verdict follows the farmer's own numbers. */
export async function mockCoverage(req: CoverageRequest): Promise<CoverageResponse> {
  await pause();
  return coverageResponse(req);
}

/** Gurpreet's plan from the contract: a CHC Super Seeder on 2 Nov, 92%, 1.5 acres short. */
export async function mockPlan(): Promise<PlanResponse> {
  await pause();
  return example<PlanResponse>('/v1/farm/plan');
}

/** The contract's two demo CHCs, keeping those that have the machine. */
export async function mockChcs(machine: string): Promise<ChcsResponse> {
  await pause();
  const all = await example<ChcsResponse>('/v1/chcs', 'get');
  return { ...all, chcs: all.chcs.filter((c) => c.machines.some((m) => m.machine === machine)) };
}

// Demo tickets: the same key gives the same ticket (like Command's Idempotency-Key), and an officer
// "opens" each one a few seconds after it's sent.
const demoTickets = new Map<string, { id: string; at: number }>();

// The demo officer opens a ticket after 5 s; with nobody acting, its deadline passes after 15 s.
export const DEMO_OPENED_MS = 5000;
export const DEMO_ESCALATED_MS = 15000;

export async function mockGrievance(key: string): Promise<ComplaintResponse> {
  await pause();
  const seen = demoTickets.get(key) ?? { id: `complaint-demo-${key.slice(-8)}`, at: Date.now() };
  demoTickets.set(key, seen);
  return { id: seen.id, status: 'received' };
}

export async function mockTicketStatus(id: string): Promise<TicketStatus> {
  await pause();
  const sent = [...demoTickets.values()].find((t) => t.id === id);
  const age = sent ? Date.now() - sent.at : Infinity;
  const opened = age > DEMO_OPENED_MS;
  const now = new Date().toISOString();
  return {
    id,
    status: opened ? 'case_opened' : 'received',
    stage_label: opened ? 'Case opened' : 'Report received',
    explanation: '',
    type: 'kisan_grievance',
    received_at: new Date(sent?.at ?? Date.now()).toISOString(),
    updated_at: now,
    // The demo's 48-hour deadline passes in seconds; a ticket from before a reload isn't escalated.
    escalated: !!sent && age > DEMO_ESCALATED_MS,
  };
}

/** No SMS in demo mode: the answer the agent gives when it writes to the outbox. */
export async function mockTicketSms(ticketId: string, phone: string): Promise<TicketSmsResponse> {
  await pause();
  return { ticket_id: ticketId, to: `${phone.slice(0, 3)}${'*'.repeat(phone.length - 7)}${phone.slice(-4)}`, via: 'outbox' };
}
