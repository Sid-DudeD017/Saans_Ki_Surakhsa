// GET /v1/chcs (P1): CHCs near a farm, from the Kisan agent.
import { forwardToAgent } from '../../../lib/kisanAgent';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return forwardToAgent(request, '/v1/chcs');
}
