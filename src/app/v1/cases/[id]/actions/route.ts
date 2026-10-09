// POST /v1/cases/{id}/actions (P4): an officer's decision. Sign-in comes at G7; until then the officer is
// named by X-Officer-Id, or recorded as officer-demo.
import { actOnCase } from '../../../../../../services/command-api/cases';
import { onLocalStack } from '../../../../../../services/command-api/http';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  const officer = request.headers.get('x-officer-id')?.trim() || undefined;
  return onLocalStack((deps) => actOnCase(deps, id, body, officer));
}
