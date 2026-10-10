// GET /v1/complaints/{id} (P4, Saans Command): read-only complaint status tracking.
import { handleGetComplaintStatus } from '../../../../../services/command-api/http';
import { onLocalStack } from '../../../../../services/command-api/localStack';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return onLocalStack((deps) => handleGetComplaintStatus(request, deps, params.id));
}
