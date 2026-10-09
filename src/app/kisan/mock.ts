// NEXT_PUBLIC_USE_MOCKS: Gurpreet's conversation from P1's contract examples, which contract.py records
// from real calls to the agent. The first message gets the read-back, the next one files it. The
// proposal is loaded only when mocks are on, so it stays out of the normal bundle.
import type { KisanStatus, Language, MessageResponse, PhotoResponse } from './kisanApi';

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
