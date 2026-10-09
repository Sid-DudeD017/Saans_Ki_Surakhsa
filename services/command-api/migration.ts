// CloudFormation custom-resource handler that initializes the AWS database during deployment.
// The schema is idempotent, so updates can safely run it again.
import { commandConfig } from "./config";
import { migrate, pool } from "./deps";

interface CustomResourceEvent {
  RequestType: "Create" | "Update" | "Delete";
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
}

async function respond(event: CustomResourceEvent, status: "SUCCESS" | "FAILED", reason?: string) {
  const body = JSON.stringify({
    Status: status,
    Reason: reason ?? `See CloudWatch log stream ${process.env.AWS_LAMBDA_LOG_STREAM_NAME ?? "unknown"}`,
    PhysicalResourceId: event.PhysicalResourceId ?? "saans-database-schema",
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: false,
    Data: { Migrated: status === "SUCCESS" && event.RequestType !== "Delete" },
  });

  const response = await fetch(event.ResponseURL, {
    method: "PUT",
    headers: { "content-type": "", "content-length": String(Buffer.byteLength(body)) },
    body,
  });
  if (!response.ok) throw new Error(`CloudFormation response failed with HTTP ${response.status}`);
}

export async function handler(event: CustomResourceEvent) {
  if (event.RequestType === "Delete") {
    await respond(event, "SUCCESS");
    return;
  }

  const db = pool(commandConfig());
  try {
    await migrate(db);
    await respond(event, "SUCCESS");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "database migration failed";
    console.error("Database migration failed", error);
    await respond(event, "FAILED", reason);
  } finally {
    await db.end();
  }
}
