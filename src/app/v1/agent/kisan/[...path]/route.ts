// /v1/agent/kisan/* (P1): forwards to the Kisan Saathi agent at KISAN_AGENT_URL, so the app reaches the
// agent through the same site as everything else.
import { forwardToAgent, segments } from '../../../../../lib/kisanAgent';

export const runtime = 'nodejs';

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forwardToAgent(request, `/v1/agent/kisan/${segments(path)}`);
}

export const GET = forward;
export const POST = forward;
