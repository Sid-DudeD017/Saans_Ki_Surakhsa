// The local stack (npm run stack) for the Next.js routes: deps made once (tables migrated, bucket created,
// workflow run in-process, Cedar from infra/policies, the escalation timer), and demo-officer sign-in.
// Lambda never imports this file; lambda.ts builds its own deps.
import { localCedar, officerFrom, type Officer } from "./authz";
import { commandConfig } from "./config";
import { ensureBucket, migrate, newId, pool, s3Client, type IntakeDeps } from "./deps";
import { errorResponse } from "./errors";
import { escalateOverdue } from "./escalation";
import { liveFires } from "./firms";
import { notifierFromEnv } from "./notify";
import { runIntake } from "../workflows/local";

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
      authz: localCedar,
    };
    deps.notify = notifierFromEnv(deps.db);
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
