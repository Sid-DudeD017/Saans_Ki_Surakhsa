// A farmer's complaint from Kisan Saathi (kisan_grievance, K18/K19) on the real local stack (npm run stack):
// it becomes its own case for the District Agriculture Officer, never a penalty and never merged; the
// officer sees what it's about; and the farmer's status page follows it. Skipped unless SAANS_DATABASE_URL is set.
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runIntake } from "../workflows/local";
import { LOCAL_OFFICERS, localCedar } from "./authz";
import { getCase } from "./cases";
import { getComplaintStatus } from "./complaints";
import { commandConfig } from "./config";
import { ensureBucket, migrate, newId, pool, s3Client, type IntakeDeps } from "./deps";
import { escalateOverdue } from "./escalation";
import { handleComplaints } from "./http";

const stack = !!process.env.SAANS_DATABASE_URL;
const sangrur = LOCAL_OFFICERS.find((o) => o.id === "officer-sangrur")!;
const patiala = LOCAL_OFFICERS.find((o) => o.id === "officer-patiala")!;
const BHAWANIGARH = { lat: 30.266, lon: 76.04 }; // Kisan's example farm, inside Sangrur's outline

describe.skipIf(!stack)("a farmer's complaint, on PostGIS", () => {
  const config = commandConfig();
  const db = pool(config);
  const deps: IntakeDeps = {
    db,
    s3: s3Client(config),
    config,
    now: () => new Date(),
    newId,
    startWorkflow: async (id) => {
      await runIntake(deps, id, async () => {});
    },
    authz: localCedar,
  };

  beforeAll(async () => {
    await migrate(db);
    await ensureBucket(deps.s3, config.evidenceBucket);
  });
  afterAll(() => db.end());

  async function file(body: unknown) {
    const res = await handleComplaints(
      new Request("http://saans.test/v1/complaints", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(body) }),
      deps,
    );
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const { rows } = await db.query<{ id: string }>(
      "SELECT id FROM cases WHERE complaint_id = $1 UNION ALL SELECT case_id FROM case_reports WHERE complaint_id = $1",
      [id],
    );
    return { complaintId: id, caseId: rows[0].id };
  }

  const grievance = (extra: object = {}) => ({
    type: "kisan_grievance",
    location: BHAWANIGARH,
    subtype: "chc_no_show",
    chc_name: "Demo CHC A (Bhawanigarh)",
    description: "The Super Seeder was booked for 2 November and never came.",
    ...extra,
  });

  it("becomes its own case for Sangrur's agriculture officer, with no penalty", async () => {
    const { caseId } = await file(grievance());
    const res = await getCase(deps, caseId, sangrur);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d).toMatchObject({
      type: "kisan_grievance",
      penalty: false,
      authorities: ["District Agriculture Officer"],
      grievance: { subtype: "chc_no_show", chcName: "Demo CHC A (Bhawanigarh)" },
      report: { district: "Sangrur", reporterId: "kisan_saathi", description: expect.stringContaining("never came") },
    });
    // Patiala's officer can't open a Sangrur case.
    expect((await getCase(deps, caseId, patiala)).status).toBe(403);
  });

  it("never merges: two complaints from the same farm are two cases", async () => {
    const a = await file(grievance());
    const b = await file(grievance({ subtype: "chc_overcharge" }));
    expect(a.caseId).not.toBe(b.caseId);
  });

  it("the farmer's status page follows it", async () => {
    const { complaintId } = await file(grievance());
    const status = await (await getComplaintStatus(deps, complaintId)).json();
    expect(status).toMatchObject({ id: complaintId, type: "kisan_grievance", status: "case_opened", escalated: false });
  });

  it("tells the farmer when nobody acted before the deadline (K24)", async () => {
    const { complaintId, caseId } = await file(grievance());
    await db.query("UPDATE cases SET deadline = now() - interval '1 minute' WHERE id = $1", [caseId]);
    expect(await escalateOverdue(deps)).toContain(caseId);
    const status = await (await getComplaintStatus(deps, complaintId)).json();
    expect(status).toMatchObject({ status: "case_opened", escalated: true });
    expect(JSON.stringify(status)).not.toContain("Deputy Commissioner"); // who it went to stays inside Command
  });

  it("shows a citizen's repeated report as merged (it joins the first report's case)", async () => {
    // Somewhere new each run, far from both demo districts, so earlier runs' open cases can't interfere.
    const at = { lat: 12 + Math.random() * 8, lon: 72 + Math.random() * 6 };
    const first = await file({ type: "garbage", location: at, evidence: [] });
    const again = await file({ type: "garbage", location: { lat: at.lat + 0.0005, lon: at.lon }, evidence: [] });
    expect(again.caseId).toBe(first.caseId);
    expect(await (await getComplaintStatus(deps, again.complaintId)).json()).toMatchObject({ status: "merged" });
    expect(await (await getComplaintStatus(deps, first.complaintId)).json()).toMatchObject({ status: "case_opened" });
  });
});
