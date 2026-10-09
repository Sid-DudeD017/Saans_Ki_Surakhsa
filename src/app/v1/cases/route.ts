// GET /v1/cases (P4, Saans Command): the officer's queue, nearest deadline first, their districts only.
import { listCases } from '../../../../services/command-api/cases';
import { asOfficer } from '../../../../services/command-api/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return asOfficer(request, (deps, officer) => listCases(deps, new URL(request.url), officer));
}
