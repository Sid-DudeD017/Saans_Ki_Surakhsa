// The HTTP side of intake: Request in, Response out, so the same code serves the Next.js routes
// (src/app/v1/uploads, src/app/v1/complaints) and the Lambda handlers in template.yaml. The local stack's
// wiring is in localStack.ts, kept apart so Lambda bundles don't carry it (or Cedar's wasm).
import { submitComplaint } from "./complaints";
import type { IntakeDeps } from "./deps";
import { invalid, zodDetails } from "./errors";
import { UploadInput } from "./inputs";
import { createUpload } from "./uploads";

const MAX_BODY_BYTES = 256 * 1024;

async function jsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, response: invalid([{ field: "body", problem: `must be under ${MAX_BODY_BYTES / 1024} KB` }]) };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: invalid([{ field: "body", problem: "must be JSON" }]) };
  }
}

export async function handleUploads(request: Request, deps: IntakeDeps): Promise<Response> {
  const read = await jsonBody(request);
  if (!read.ok) return read.response;
  const parsed = UploadInput.safeParse(read.body);
  if (!parsed.success) return invalid(zodDetails(parsed.error));
  return Response.json(await createUpload(deps, parsed.data), { status: 201 });
}

export async function handleComplaints(request: Request, deps: IntakeDeps): Promise<Response> {
  const read = await jsonBody(request);
  if (!read.ok) return read.response;
  return submitComplaint(deps, request.headers.get("idempotency-key"), read.body);
}
