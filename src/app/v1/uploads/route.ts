// POST /v1/uploads (P4, Saans Command): a presigned S3 PUT for one photo or voice note.
import { handleUploads } from '../../../../services/command-api/http';
import { onLocalStack } from '../../../../services/command-api/localStack';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return onLocalStack((deps) => handleUploads(request, deps));
}
