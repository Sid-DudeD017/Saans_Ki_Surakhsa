// Where Saans Command's intake finds its database and evidence bucket. Locally: `npm run stack`
// (infra/compose.yaml) and the defaults below. On AWS (G7) the same variables come from template.yaml.
import routing from "../../infra/config/routing.json";

export const LOCAL_DATABASE_URL = "postgres://saans:saans@127.0.0.1:5433/saans"; // local fixture, see compose.yaml

export interface CommandConfig {
  databaseUrl: string;
  evidenceBucket: string;
  region: string;
  /** LocalStack's endpoint; unset on AWS. */
  s3Endpoint?: string;
  uploadTtlSeconds: number;
}

export function commandConfig(env: Record<string, string | undefined> = process.env): CommandConfig {
  return {
    databaseUrl: env.SAANS_DATABASE_URL || LOCAL_DATABASE_URL,
    evidenceBucket: env.SAANS_EVIDENCE_BUCKET || "saans-evidence",
    region: env.AWS_REGION || "ap-south-1",
    s3Endpoint: env.SAANS_S3_ENDPOINT ?? (env.LOCALSTACK_URL || "http://127.0.0.1:4566"),
    uploadTtlSeconds: 15 * 60,
  };
}

export type ComplaintType = keyof typeof routing & string;

export interface Route {
  authorities: string[];
  deadlineHours: number;
  penalty: boolean;
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
