// The HTTP side of intake: Request in, Response out, so the same code serves the Next.js routes
// (src/app/v1/uploads, src/app/v1/complaints) and, from G7, the Lambda handlers in template.yaml.
import { officerFrom, type Officer } from "./authz";
import { commandConfig } from "./config";
import { submitComplaint } from "./complaints";
import { ensureBucket, migrate, newId, pool, s3Client, type IntakeDeps } from "./deps";
import { errorResponse, invalid, zodDetails } from "./errors";
import { escalateOverdue } from "./escalation";
import { liveFires } from "./firms";
import { UploadInput } from "./inputs";
import { createUpload } from "./uploads";
import { runIntake } from "../workflows/local";

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

// ---- the local stack (npm run stack) ----

let local: Promise<IntakeDeps> | null = null;

/** Deps for the local stack, made once: tables migrated, bucket created, workflow run in-process. */
export function localDeps(): Promise<IntakeDeps> {
  local ??= (async () => {
    const config = commandConfig();
    const deps: IntakeDeps = {
      db: pool(config),
      s3: s3Client(config),
      config,
      now: () => new Date(),
      newId,
      startWorkflow: async (complaintId) => {
        // Step Functions runs asynchronously too: the complaint is answered before its case exists.
        void runIntake(deps, complaintId).catch((e) => console.error(`intake for ${complaintId} crashed`, e));
      },
      fires: liveFires(),
    };
    await migrate(deps.db);
    await ensureBucket(deps.s3, config.evidenceBucket);
    // The local stand-in for template.yaml's one-minute EscalationFunction schedule.
    setInterval(() => {
      escalateOverdue(deps).catch((e) => console.error("escalation sweep failed", e));
    }, config.escalationSweepSeconds * 1000).unref();
    return deps;
  })().catch((e) => {
    local = null;
    throw e;
  });
  return local;
}

/** Runs a handler on the local stack, or answers 503 if PostGIS or LocalStack isn't up. */
export async function onLocalStack(handler: (deps: IntakeDeps) => Promise<Response>): Promise<Response> {
  let deps: IntakeDeps;
  try {
    deps = await localDeps();
  } catch (e) {
    console.error("Saans Command's local stack isn't reachable", e);
    return errorResponse(503, "unavailable", "complaint intake is unavailable: start the local stack with `npm run stack`");
  }
  return handler(deps);
}

/** Runs an officer's handler on the local stack, or answers 401 when nobody is signed in. */
export async function asOfficer(request: Request, handler: (deps: IntakeDeps, officer: Officer) => Promise<Response>): Promise<Response> {
  const officer = officerFrom(request);
  if (!officer) return errorResponse(401, "unauthorized", "sign in as an officer to see cases");
  return onLocalStack((deps) => handler(deps, officer));
}
