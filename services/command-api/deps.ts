// What the intake handlers and workflow steps need, built once per process. Tests pass their own.
import { randomUUID } from "node:crypto";

import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";

import { commandConfig, type CommandConfig } from "./config";
import { SCHEMA } from "./schema";
import type { NotificationSender } from "./sms";

export interface Db {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
}

export interface IntakeDeps {
  db: Db;
  s3: S3Client;
  config: CommandConfig;
  now: () => Date;
  newId: (prefix: string) => string;
  /** Starts the intake workflow for a stored complaint. Safe to call twice for one complaint. */
  startWorkflow: (complaintId: string) => Promise<void>;
  /** Optional in local tests; AWS injects the production sender. */
  notifications?: NotificationSender;
}

export function newId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export function s3Client(config: CommandConfig) {
  return new S3Client({
    region: config.region,
    ...(config.s3Endpoint
      ? { endpoint: config.s3Endpoint, forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } }
      : {}),
    // Without this the SDK signs a CRC32 of an empty body into presigned URLs, and every upload fails.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function pool(config: CommandConfig) {
  return new Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 5000 });
}

/** Creates the tables (every statement is repeatable). */
export async function migrate(db: Db) {
  await db.query(SCHEMA);
}

/** Creates the evidence bucket on LocalStack, with CORS so the browser can PUT to it. On AWS, template.yaml owns it. */
export async function ensureBucket(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    // missing: create it below
  }
  await s3.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: "ap-south-1" } }));
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [{ AllowedMethods: ["PUT"], AllowedOrigins: ["*"], AllowedHeaders: ["*"], MaxAgeSeconds: 600 }],
      },
    }),
  );
}
