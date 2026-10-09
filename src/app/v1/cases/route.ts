// GET /v1/cases (P4, Saans Command): the officer's queue, nearest deadline first.
import { listCases } from '../../../../services/command-api/cases';
import { onLocalStack } from '../../../../services/command-api/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return onLocalStack((deps) => listCases(deps, new URL(request.url)));
}
