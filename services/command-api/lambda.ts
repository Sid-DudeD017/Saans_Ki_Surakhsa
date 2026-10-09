// Lambda entry points behind API Gateway (HTTP API, payload 2.0), as infra/template.yaml wires them:
// uploads and complaints, and the officer's case API behind the Cognito authorizer. They run the same
// handlers as the Next.js routes; on AWS the case rules are Verified Permissions (avpAuthz.ts).
import { avpCaseAuthz } from "./avpAuthz";
import { actOnCase, getCase, listCases } from "./cases";
import type { Officer } from "./caseAuthz";
import { commandConfig } from "./config";
import { newId, pool, s3Client, type IntakeDeps } from "./deps";
import { errorResponse } from "./errors";
import { liveFires } from "./firms";
import { handleComplaints, handleUploads } from "./http";
import { notifierFromEnv } from "./notify";

interface HttpApiEvent {
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  pathParameters?: Record<string, string | undefined>;
  requestContext: {
    http: { method: string };
    domainName?: string;
    /** What authorizer.ts returned for a signed-in officer. */
    authorizer?: { lambda?: { subject?: string; role?: string; district?: string } };
  };
}

interface HttpApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

let deps: IntakeDeps | null = null;
let sfn: SFNClient | null = null;

export function awsDeps(): IntakeDeps {
  if (deps) return deps;
  const config = commandConfig();
  if (!sfn) sfn = new SFNClient({ region: config.region });

  deps = {
    db: pool(config),
    s3: s3Client(config),
    config,
    now: () => new Date(),
    newId,
    fires: liveFires(),
    authz: avpCaseAuthz(),
    startWorkflow: async (complaintId: string) => {
      const arn = process.env.SAANS_STATE_MACHINE_ARN;
      if (!arn) throw new Error("SAANS_STATE_MACHINE_ARN is missing");
      try {
        await sfn!.send(
          new StartExecutionCommand({
            stateMachineArn: arn,
            name: complaintId,
            input: JSON.stringify({ complaintId }),
          })
        );
      } catch (err: any) {
        if (err.name === "ExecutionAlreadyExists") return;
        throw err;
      }
    },
  };
  deps.notify = notifierFromEnv(deps.db);
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

// #26's Cognito groups name districts in lowercase; the case data uses the names in districts.json.
const DISTRICT_NAMES: Record<string, string> = { sangrur: "Sangrur", patiala: "Patiala" };

/** The officer the authorizer signed in, with their token for Verified Permissions; null without one. */
export function officerOf(event: HttpApiEvent): Officer | null {
  const claims = event.requestContext.authorizer?.lambda;
  const auth = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1];
  const district = claims?.district && DISTRICT_NAMES[claims.district];
  if (!claims?.subject || !district || !token) return null;
  return { id: claims.subject, name: claims.subject, role: "district_officer", district, token };
}

async function asOfficer(event: HttpApiEvent, handler: (deps: IntakeDeps, officer: Officer) => Promise<Response>) {
  const officer = officerOf(event);
  if (!officer) return toResult(errorResponse(401, "unauthorized", "sign in as an officer to see cases"));
  return toResult(await handler(awsDeps(), officer));
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

export async function casesList(event: HttpApiEvent) {
  return asOfficer(event, (d, officer) => listCases(d, new URL(toRequest(event).url), officer));
}

export async function caseDetail(event: HttpApiEvent) {
  return asOfficer(event, (d, officer) => getCase(d, event.pathParameters?.id ?? "", officer));
}

export async function caseAction(event: HttpApiEvent) {
  return asOfficer(event, async (d, officer) => {
    const body = await toRequest(event).json().catch(() => undefined);
    return actOnCase(d, event.pathParameters?.id ?? "", body, officer);
  });
}
