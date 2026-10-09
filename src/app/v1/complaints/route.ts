// POST /v1/complaints (P4, Saans Command): a citizen's report or Kisan's farmer_support request.
import { handleComplaints } from '../../../../services/command-api/http';
import { onLocalStack } from '../../../../services/command-api/localStack';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return onLocalStack((deps) => handleComplaints(request, deps));
}
