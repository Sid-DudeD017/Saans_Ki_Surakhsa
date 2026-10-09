// G5 on the real local stack: PostGIS and LocalStack S3 (npm run stack). Skipped unless
// SAANS_DATABASE_URL is set; CI's command-intake job sets it. `npm run smoke:intake` runs the same
// path over HTTP.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runIntake } from "../workflows/local";
import { commandConfig } from "./config";
import { ensureBucket, migrate, newId, pool, s3Client, type IntakeDeps } from "./deps";
import { handleComplaints, handleUploads } from "./http";

const stack = !!process.env.SAANS_DATABASE_URL;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const PHOTO = Buffer.from(`not really a jpeg ${randomUUID()}`);
const noSleep = async () => {};

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://saans.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe.skipIf(!stack)("complaint intake on PostGIS + LocalStack", () => {
  const config = commandConfig();
  const db = pool(config);
  const started: string[] = [];
  let clock = () => new Date();
  const deps: IntakeDeps = {
    db,
    s3: s3Client(config),
    config,
    now: () => clock(),
    newId,
    // Run the workflow to the end before answering, so each test can look at the case it made.
    startWorkflow: async (id) => {
      started.push(id);
      await runIntake(deps, id, noSleep);
    },
  };

  beforeAll(async () => {
    await migrate(db);
    await ensureBucket(deps.s3, config.evidenceBucket);
  });
  afterAll(() => db.end());

  async function upload(bytes: Buffer, mediaType = "image/jpeg") {
    const res = await handleUploads(post("/v1/uploads", { media_type: mediaType, byte_size: bytes.length, sha256: sha(bytes) }), deps);
    expect(res.status).toBe(201);
    return res.json() as Promise<{ object_key: string; upload_url: string; headers: Record<string, string>; expires_at: string }>;
  }

  function put(target: { upload_url: string; headers: Record<string, string> }, bytes: Buffer) {
    return fetch(target.upload_url, { method: "PUT", headers: target.headers, body: new Uint8Array(bytes) });
  }

  // Each report somewhere new in Sangrur: reports within 150 m and 6 hours of an open case merge into it.
  const spot = () => ({ lat: Math.round((30.1 + Math.random() * 0.2) * 1e5) / 1e5, lon: Math.round((75.75 + Math.random() * 0.3) * 1e5) / 1e5 });
  function report(evidence: unknown[] = [], extra: Record<string, unknown> = {}) {
    return { type: "farm_fire", location: spot(), description: "Smoke over the field by the canal", evidence, ...extra };
  }

  function evidenceFor(target: { object_key: string }, bytes: Buffer) {
    return { object_key: target.object_key, media_type: "image/jpeg", hash: sha(bytes), captured_timestamp: "2026-10-23T13:58:00+05:30", location: { lat: 30.2662, lon: 76.0401 } };
  }

  async function caseFor(complaintId: string) {
    const { rows } = await db.query<Record<string, unknown>>("SELECT * FROM cases WHERE complaint_id = $1", [complaintId]);
    return rows;
  }

  it("a reported fire with a photo becomes exactly one case in PostGIS", async () => {
    const target = await upload(PHOTO);
    expect(target.upload_url).toContain(config.evidenceBucket);
    expect(target.expires_at).toMatch(/\+05:30$/);
    expect((await put(target, PHOTO)).status).toBe(200);

    const fire = report([evidenceFor(target, PHOTO)]);
    const res = await handleComplaints(post("/v1/complaints", fire, { "Idempotency-Key": randomUUID() }), deps);
    expect(res.status).toBe(201);
    const { id, status } = await res.json();
    expect(status).toBe("received");

    const cases = await caseFor(id);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      type: "farm_fire",
      status: "OPEN",
      verification_status: "UNVERIFIED",
      authorities: ["SDM", "District Agriculture Officer"],
      penalty: true,
      version: 1,
      evidence_summary: "1 file: 1 matches its upload hash",
    });
    const { rows: [complaint] } = await db.query<{ status: string; received_at: Date }>("SELECT status, received_at FROM complaints WHERE id = $1", [id]);
    expect(complaint.status).toBe("assigned");
    expect((cases[0].deadline as Date).getTime() - complaint.received_at.getTime()).toBe(4 * 3600_000);
    const { rows: [where] } = await db.query<{ lat: number; lon: number }>(
      "SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon FROM cases WHERE complaint_id = $1", [id]);
    expect(where).toEqual(fire.location);

    const { rows: events } = await db.query<{ state: string; event: string }>(
      "SELECT state, event FROM workflow_events WHERE complaint_id = $1 ORDER BY id", [id]);
    expect(events.filter((e) => e.event === "succeeded").map((e) => e.state)).toEqual(["Validate", "HashEvidence", "Triage", "Assign"]);
  });

  it("refuses a complaint without an Idempotency-Key", async () => {
    const res = await handleComplaints(post("/v1/complaints", report()), deps);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: "invalid_request", details: [{ field: "header.Idempotency-Key", problem: "required" }] });
  });

  it("a retry with the same key and body returns the first answer and adds no row", async () => {
    const key = randomUUID();
    const fire = report();
    const first = await (await handleComplaints(post("/v1/complaints", fire, { "Idempotency-Key": key }), deps)).json();
    // Same JSON, fields in another order.
    const body = JSON.stringify({ evidence: [], description: "Smoke over the field by the canal", location: { lon: fire.location.lon, lat: fire.location.lat }, type: "farm_fire" });
    const again = await handleComplaints(post("/v1/complaints", body, { "Idempotency-Key": key }), deps);
    expect(again.status).toBe(201);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect((await again.json()).id).toBe(first.id);
    const { rows } = await db.query("SELECT 1 FROM complaints WHERE idempotency_key = $1", [key]);
    expect(rows).toHaveLength(1);
    expect(await caseFor(first.id)).toHaveLength(1);
  });

  it("ten retries at once still make one complaint and one case", async () => {
    const key = randomUUID();
    const fire = report();
    const answers = await Promise.all(Array.from({ length: 10 }, () =>
      handleComplaints(post("/v1/complaints", fire, { "Idempotency-Key": key }), deps).then((r) => r.json())));
    expect(new Set(answers.map((a) => a.id)).size).toBe(1);
    expect(await caseFor(answers[0].id)).toHaveLength(1);
  });

  it("the same key with a different body is a 409", async () => {
    const key = randomUUID();
    await handleComplaints(post("/v1/complaints", report(), { "Idempotency-Key": key }), deps);
    const res = await handleComplaints(post("/v1/complaints", report([], { type: "garbage" }), { "Idempotency-Key": key }), deps);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("idempotency_conflict");
  });

  it("evidence must be a file POST /v1/uploads handed out, with its hash", async () => {
    const target = await upload(PHOTO);
    const forged = { ...evidenceFor(target, PHOTO), object_key: "evidence/2026/10/23/someone-elses.jpg" };
    const wrongHash = { ...evidenceFor(target, PHOTO), hash: sha(Buffer.from("other")) };
    for (const [e, field] of [[forged, "body.evidence.0.object_key"], [wrongHash, "body.evidence.0.hash"]] as const) {
      const res = await handleComplaints(post("/v1/complaints", report([e]), { "Idempotency-Key": randomUUID() }), deps);
      expect(res.status).toBe(400);
      expect((await res.json()).error.details[0].field).toBe(field);
    }
  });

  it("S3 refuses bytes other than the ones declared", async () => {
    const target = await upload(PHOTO);
    const res = await put(target, Buffer.from("something else entirely"));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("S3 refuses an upload after its URL expired", async () => {
    clock = () => new Date(Date.now() - 16 * 60 * 1000); // signed 16 minutes ago, valid for 15
    const target = await upload(PHOTO).finally(() => { clock = () => new Date(); });
    const res = await put(target, PHOTO);
    expect(res.status).toBe(403);
  });

  it("a cited photo that never arrived still makes a case, marked for review", async () => {
    const target = await upload(PHOTO);
    const res = await handleComplaints(post("/v1/complaints", report([evidenceFor(target, PHOTO)]), { "Idempotency-Key": randomUUID() }), deps);
    const [c] = await caseFor((await res.json()).id);
    expect(c).toMatchObject({ verification_status: "NEEDS_REVIEW", evidence_summary: "1 file: 1 never uploaded" });
  });

  it("the same photo hashes the same every time", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const target = await upload(PHOTO);
      await put(target, PHOTO);
      const res = await handleComplaints(post("/v1/complaints", report([evidenceFor(target, PHOTO)]), { "Idempotency-Key": randomUUID() }), deps);
      ids.push((await res.json()).id);
    }
    const { rows } = await db.query<{ actual_hash: string; check_result: string }>(
      "SELECT actual_hash, check_result FROM evidence WHERE complaint_id = ANY($1)", [ids]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.actual_hash)).toEqual([sha(PHOTO), sha(PHOTO)]);
    expect(rows.every((r) => r.check_result === "match")).toBe(true);
  });

  it("Kisan's farmer_support request becomes a help case, never a penalty", async () => {
    const spec = JSON.parse(readFileSync(join(__dirname, "../../packages/contracts/proposals/p1-kisan.openapi.json"), "utf8"));
    const kisan = spec.components.schemas.FarmerSupportComplaint.examples[0];
    const key = `${kisan.support_request.idempotency_key}-${randomUUID()}`;
    const body = { ...kisan, help_request: { ...kisan.help_request, id: `kisan-${randomUUID()}` } };
    const res = await handleComplaints(post("/v1/complaints", body, { "Idempotency-Key": key }), deps);
    expect(res.status).toBe(201);
    const [c] = await caseFor((await res.json()).id);
    expect(c).toMatchObject({
      type: "farmer_support",
      penalty: false,
      authorities: ["Agriculture department", "CHC"],
      district: kisan.help_request.district,
      help_request_id: body.help_request.id,
      evidence_summary: "No files attached",
    });
    const { rows } = await db.query("SELECT status FROM help_requests WHERE id = $1", [body.help_request.id]);
    expect(rows).toEqual([{ status: "OPEN" }]);
  });

  it("a complaint that can't be processed fails visibly, with no case", async () => {
    const id = newId("complaint");
    await db.query(
      `INSERT INTO complaints (id, idempotency_key, request_hash, type, location, body)
       VALUES ($1, $2, 'x', 'farm_fire', ST_SetSRID(ST_MakePoint(76.04, 30.266), 4326)::geography, '{"type": "farm_fire"}')`,
      [id, randomUUID()],
    );
    const result = await runIntake(deps, id, noSleep);
    expect(result.status).toBe("FAILED");
    expect(await caseFor(id)).toHaveLength(0);
    const { rows: [c] } = await db.query<{ status: string; failure: { Error: string } }>("SELECT status, failure FROM complaints WHERE id = $1", [id]);
    expect(c.status).toBe("failed");
    expect(c.failure.Error).toBe("ComplaintInvalid");
    const { rows: events } = await db.query<{ state: string; event: string }>("SELECT state, event FROM workflow_events WHERE complaint_id = $1 ORDER BY id", [id]);
    expect(events).toContainEqual({ state: "Validate", event: "caught" });
    expect(events.at(-1)).toEqual({ state: "Failed", event: "failed" });
  });

  it("running the workflow twice for one complaint still leaves one case", async () => {
    const res = await handleComplaints(post("/v1/complaints", report(), { "Idempotency-Key": randomUUID() }), deps);
    const { id } = await res.json();
    expect((await runIntake(deps, id, noSleep)).status).toBe("SUCCEEDED");
    expect(await caseFor(id)).toHaveLength(1);
  });
});
