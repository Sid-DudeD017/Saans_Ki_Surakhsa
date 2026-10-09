// Where Saans Command's intake finds its database and evidence bucket. Locally: `npm run stack`
// (infra/compose.yaml) and the defaults below. On AWS (G7) the same variables come from template.yaml.
import districts from "../../infra/config/districts.json";
import routing from "../../infra/config/routing.json";

export const LOCAL_DATABASE_URL = "postgres://saans:saans@127.0.0.1:5433/saans"; // local fixture, see compose.yaml

export interface CommandConfig {
  databaseUrl: string;
  evidenceBucket: string;
  region: string;
  /** LocalStack's endpoint; unset on AWS. */
  s3Endpoint?: string;
  uploadTtlSeconds: number;
  /** Help before penalty: a fire report links to the nearest open help request this close. */
  helpRequestMaxDistanceM: number;
  /** Two open help requests this close to the same distance make the link ambiguous; the officer checks. */
  helpRequestTieToleranceM: number;
  /** Reports of the same type this close to an open case, and this soon after it, merge into it. */
  dedupeDistanceM: number;
  dedupeHours: number;
  /** A FIRMS fire this close to a farm-fire report, seen in the hours before it, corroborates it. */
  firmsDistanceM: number;
  firmsHours: number;
  /** Demo only: every deadline is this many minutes instead of routing.json's hours. */
  deadlineMinutes?: number;
  /** How often the local stack looks for missed deadlines (on AWS, a one-minute schedule). */
  escalationSweepSeconds: number;
}

export function commandConfig(env: Record<string, string | undefined> = process.env): CommandConfig {
  return {
    databaseUrl: env.SAANS_DATABASE_URL || LOCAL_DATABASE_URL,
    evidenceBucket: env.SAANS_EVIDENCE_BUCKET || "saans-evidence",
    region: env.AWS_REGION || "ap-south-1",
    s3Endpoint: env.SAANS_S3_ENDPOINT ?? (env.LOCALSTACK_URL || "http://127.0.0.1:4566"),
    uploadTtlSeconds: 15 * 60,
    helpRequestMaxDistanceM: Number(env.HELP_REQUEST_MAX_DISTANCE_METERS) || 5000,
    helpRequestTieToleranceM: Number(env.HELP_REQUEST_TIE_TOLERANCE_METERS) || 100,
    dedupeDistanceM: Number(env.DEDUPE_DISTANCE_METERS) || 150,
    dedupeHours: Number(env.DEDUPE_HOURS) || 6,
    firmsDistanceM: Number(env.FIRMS_MATCH_METERS) || 1000,
    firmsHours: Number(env.FIRMS_MATCH_HOURS) || 12,
    ...(Number(env.SAANS_DEMO_DEADLINE_MINUTES) > 0 ? { deadlineMinutes: Number(env.SAANS_DEMO_DEADLINE_MINUTES) } : {}),
    escalationSweepSeconds: Number(env.ESCALATION_SWEEP_SECONDS) || 20,
  };
}

export type ComplaintType = keyof typeof routing & string;

export interface Route {
  authorities: string[];
  deadlineHours: number;
  penalty: boolean;
}

export interface District {
  name: string;
  escalateTo: string[];
  /** Closed ring of [lon, lat]. */
  boundary: number[][];
}

export const DISTRICTS: District[] = districts.districts;

/** Who a case outside both districts escalates to. */
export const UNASSIGNED_ESCALATION = ["State Command Centre"];

export function escalationFor(district: string | null): string[] {
  return DISTRICTS.find((d) => d.name === district)?.escalateTo ?? UNASSIGNED_ESCALATION;
}

const ROUTES: Record<string, Route> = Object.fromEntries(
  Object.entries(routing).filter(([key]) => !key.startsWith("$")),
) as Record<string, Route>;

export function routeFor(type: string): Route {
  const route = ROUTES[type];
  if (!route) throw new Error(`no route for complaint type ${type} in infra/config/routing.json`);
  return route;
}

export const ROUTED_TYPES = Object.keys(ROUTES);
