// GET /v1/cases/{id} (P4): one case with its report and the farmer's help request, if Cedar lets the officer see it.
import { getCase } from '../../../../../services/command-api/cases';
import { asOfficer } from '../../../../../services/command-api/localStack';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return asOfficer(request, (deps, officer) => getCase(deps, id, officer));
}
