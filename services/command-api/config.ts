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
    databaseUrl: databaseUrlFrom(env.SAANS_DATABASE_URL) ?? LOCAL_DATABASE_URL,
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

/**
 * SAANS_DATABASE_URL as Postgres can read it. Pasted values often carry stray spaces or quotes, and a password
 * typed into the URL as-is breaks it when it has a `#`, `?`, `/` or `%` (the URL parser, and so pg, answers just
 * "Invalid URL"). This trims, unwraps quotes and percent-encodes the user and password when the URL doesn't
 * parse; if it still doesn't, it says which variable is wrong without printing the password.
 */
export function databaseUrlFrom(raw: string | undefined): string | undefined {
  let url = raw?.trim();
  if (!url) return undefined;
  if (url.length > 1 && /^(["'`])[\s\S]*\1$/.test(url)) url = url.slice(1, -1).trim();
  if (parses(url)) return url;
  // postgres://user:password@host… with the password as typed: the last "@" ends it, since a host has none.
  const m = /^(postgres(?:ql)?:\/\/)([^:@]*)(?::([\s\S]*))?@([^@]+)$/.exec(url);
  if (m) {
    const [, scheme, user, password, rest] = m;
    const fixed = `${scheme}${encodePart(user)}${password === undefined ? "" : `:${encodePart(password)}`}@${rest}`;
    if (parses(fixed)) return fixed;
  }
  throw new Error(
    "SAANS_DATABASE_URL isn't a valid postgres:// URL. Check it has postgres://user:password@host:5432/database " +
      "with nothing after it, and percent-encode any # ? / % @ in the password.",
  );
}

function parses(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "postgres:" || u.protocol === "postgresql:") && u.hostname !== "";
  } catch {
    return false;
  }
}

/** Percent-encodes what isn't already encoded, so "p%23w" stays as typed and "p#w" becomes "p%23w". */
function encodePart(part: string): string {
  return part.replace(/%(?![0-9a-f]{2})|[^A-Za-z0-9\-._~!$&'()*+,;=%]/gi, (c) => encodeURIComponent(c));
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
export const SUPERVISOR_QUEUE_ESCALATION = ["State Command Centre"];

export function escalationFor(district: string | null): string[] {
  return DISTRICTS.find((d) => d.name === district)?.escalateTo ?? SUPERVISOR_QUEUE_ESCALATION;
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
