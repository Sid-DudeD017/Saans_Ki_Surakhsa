// /v1/farm/* (P1): the coverage check, the zero-burn plan and fires near a farm, from the Kisan agent.
import { forwardToAgent, segments } from '../../../../lib/kisanAgent';

export const runtime = 'nodejs';

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forwardToAgent(request, `/v1/farm/${segments(path)}`);
}

export const GET = forward;
export const POST = forward;
