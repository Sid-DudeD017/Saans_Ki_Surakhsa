// POST /v1/cases/{id}/actions (P4): an officer's decision, recorded under the signed-in officer's id.
import { actOnCase } from '../../../../../../services/command-api/cases';
import { asOfficer } from '../../../../../../services/command-api/http';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => undefined);
  return asOfficer(request, (deps, officer) => actOnCase(deps, id, body, officer));
}
