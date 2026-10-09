// GET /v1/cases/{id} (P4): one case with its report and the farmer's help request.
import { getCase } from '../../../../../services/command-api/cases';
import { onLocalStack } from '../../../../../services/command-api/http';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return onLocalStack((deps) => getCase(deps, id));
}
