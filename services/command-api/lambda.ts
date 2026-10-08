// Lambda entry points for POST /v1/uploads and POST /v1/complaints behind API Gateway (HTTP API,
// payload 2.0), as infra/template.yaml wires them. They run the same handlers as the Next.js routes.
import { commandConfig } from "./config";
import { newId, pool, s3Client, type IntakeDeps } from "./deps";
import { handleComplaints, handleUploads } from "./http";

interface HttpApiEvent {
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string }; domainName?: string };
}

interface HttpApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

let deps: IntakeDeps | null = null;

function awsDeps(): IntakeDeps {
  if (deps) return deps;
  const config = commandConfig();
  deps = {
    db: pool(config),
    s3: s3Client(config),
    config,
    now: () => new Date(),
    newId,
    startWorkflow: async () => {
      // G7: StartExecution on SAANS_STATE_MACHINE_ARN with name = the complaint id (so a retry can't
      // start it twice), using @aws-sdk/client-sfn. Until then intake runs only on the local stack.
      throw new Error("starting the intake workflow on AWS lands in G7");
    },
  };
  return deps;
}

function toRequest(event: HttpApiEvent): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(event.headers ?? {})) if (v !== undefined) headers.set(k, v);
  const body = event.body === undefined ? undefined : event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  return new Request(`https://${event.requestContext.domainName ?? "api"}${event.rawPath}${query}`, {
    method: event.requestContext.http.method,
    headers,
    body,
  });
}

async function toResult(response: Response): Promise<HttpApiResult> {
  return { statusCode: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
}

export async function uploads(event: HttpApiEvent) {
  return toResult(await handleUploads(toRequest(event), awsDeps()));
}

export async function complaints(event: HttpApiEvent) {
  return toResult(await handleComplaints(toRequest(event), awsDeps()));
}
