// GET /v1/schools/{id}/advisory (P2, Saans Shala): today's go/no-go and advice for each role.
import { answerAdvisory } from '../../../../../app/shala/advisoryHttp';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return answerAdvisory(id, new URL(request.url));
}
