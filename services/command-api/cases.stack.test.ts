// Help before penalty and the case console's API on the real local stack (npm run stack): a farmer files,
// a citizen reports a fire nearby, the case links to the farmer's open help request, and an officer acts.
// Skipped unless SAANS_DATABASE_URL is set; CI's command-intake job sets it.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runIntake } from "../workflows/local";
import { LOCAL_OFFICERS, localCedar } from "./authz";
import { actOnCase, getCase, listCases } from "./cases";
import { commandConfig } from "./config";
import { ensureBucket, migrate, newId, pool, s3Client, type IntakeDeps } from "./deps";
import { handleComplaints } from "./http";

const stack = !!process.env.SAANS_DATABASE_URL;
const as = (id: string) => LOCAL_OFFICERS.find((o) => o.id === id)!;
const sdm = as("officer-sangrur"); // Kisan's example farm is in Sangrur, so linked cases are too
const field = as("field-sangrur");
const patiala = as("officer-patiala");
const state = as("state-command");
const kisan = JSON.parse(readFileSync(join(__dirname, "../../packages/contracts/proposals/p1-kisan.openapi.json"), "utf8")).components.schemas
  .FarmerSupportComplaint.examples[0];

/** A point `east` and `north` metres from another. */
const offset = (p: { lat: number; lon: number }, east: number, north: number) => ({
  lat: p.lat + north / 111_195,
  lon: p.lon + east / (111_195 * Math.cos((p.lat * Math.PI) / 180)),
});

describe.skipIf(!stack)("help before penalty, and the case console's API, on PostGIS", () => {
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
  // Somewhere new each run, anywhere in a box over most of India but at least 1° from both demo districts
  // (infra/config/districts.json; HERE's spots reach 40 km out): every run leaves open help requests behind,
  // and "nothing within 5 km" must stay true on a local database that keeps them all.
  const nearDistricts = (p: { lat: number; lon: number }) => p.lat > 28.9 && p.lat < 31.7 && p.lon > 74.6 && p.lon < 77.8;
  let HERE = { lat: 0, lon: 0 };
  do HERE = { lat: 9 + Math.random() * 23, lon: 69 + Math.random() * 26 };
  while (nearDistricts(HERE));

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
    const { id } = await res.json();
    const { rows } = await db.query<{ id: string }>("SELECT id FROM cases WHERE complaint_id = $1", [id]);
    return rows[0].id;
  }

  /** Kisan's example request, moved to `at`; status MATCHED when the farmer's own plan covered everything. */
  async function farmerFiles(at: { lat: number; lon: number }, status: "OPEN" | "MATCHED" = "OPEN") {
    const id = `kisan-${randomUUID()}`;
    const help = { ...kisan.help_request, id, farmLocation: at, status, uncoveredAcres: status === "OPEN" ? 1.5 : 0 };
    const farm = kisan.support_request.farm && { ...kisan.support_request.farm, lat: at.lat, lon: at.lon };
    await file({ ...kisan, location: at, help_request: help, support_request: { ...kisan.support_request, idempotency_key: randomUUID(), ...(farm ? { farm } : {}) } });
    return id;
  }

  const citizenReports = (at: { lat: number; lon: number }) => file({ type: "farm_fire", location: at, description: "Smoke over the paddy by the canal", evidence: [] });
  // The state command centre sees every district; the tests that act sign in as the district's officers.
  const detail = async (caseId: string) => (await getCase(deps, caseId, state)).json();

  it("links a fire report to the nearest open help request, and the case shows it before any penalty", async () => {
    const near = await farmerFiles(HERE);
    await farmerFiles(offset(HERE, 2000, 0));
    const caseId = await citizenReports(offset(HERE, 300, 0));

    const d = await detail(caseId);
    expect(d.case).toMatchObject({ helpRequestId: near, status: "OPEN", version: 1 });
    expect(d.helpLink.distanceMeters).toBeGreaterThan(280);
    expect(d.helpLink.distanceMeters).toBeLessThan(320);
    expect(d.helpLink.ambiguous).toBe(false);
    expect(d.helpRequest).toMatchObject({ id: near, uncoveredAcres: 1.5, status: "OPEN" });
    expect(d.report).toMatchObject({ id: expect.stringMatching(/^complaint-/), district: kisan.help_request.district, status: "OPEN", reporterId: "anonymous" });
    expect(d.penalty).toBe(true);
    expect(d.case.recommendationReason).toMatch(/^Open help request (290|300|310) m from the report\. 1\.5 acres still need a Happy Seeder\./);
    expect(d.decisions).toEqual([]);
    // The demo seed's only Happy Seeders free from 20 October are CHC C's.
    expect(d.recommendedMachine).toMatchObject({ id: "demo-chc-c:happy_seeder", machineType: "Happy Seeder", status: "AVAILABLE" });
    expect(d.case.recommendedMachineId).toBe(d.recommendedMachine.id);
    expect(d.case.recommendationReason).toContain("send it before any penalty");
  });

  it("flags a link as ambiguous when two open requests are within 100 m of the same distance", async () => {
    const spot = offset(HERE, 0, 20_000);
    await farmerFiles(spot);
    await farmerFiles(offset(spot, 50, 0));
    const d = await detail(await citizenReports(offset(spot, 0, 1000)));
    expect(d.helpLink.ambiguous).toBe(true);
    expect(d.helpLink.otherHelpRequestId).toMatch(/^kisan-/);
    expect(d.case.recommendationReason).toContain("Another open request is about as close");
  });

  it("doesn't link a request that is too far away, or one the farmer's own plan already covers", async () => {
    const spot = offset(HERE, 0, -20_000);
    await farmerFiles(spot);
    const far = await detail(await citizenReports(offset(spot, 6000, 0)));
    expect(far.case.helpRequestId).toBeUndefined();
    expect(far.report.district).toBe("unassigned");

    const covered = offset(HERE, 20_000, 0);
    await farmerFiles(covered, "MATCHED");
    expect((await detail(await citizenReports(offset(covered, 100, 0)))).case.helpRequestId).toBeUndefined();
  });

  it("an officer approves, records the action and closes; a stale version gets 409", async () => {
    const spot = offset(HERE, -20_000, 0);
    const help = await farmerFiles(spot);
    const caseId = await citizenReports(offset(spot, 100, 100));
    const act = async (body: unknown, officer = sdm) => {
      const res = await actOnCase(deps, caseId, body, officer);
      return { status: res.status, body: await res.json() };
    };
    const approveBody = { action: "APPROVE", selectedMachineId: "demo-chc-a:happy_seeder", reason: "Send the Happy Seeder first", previousCaseVersion: 1 };

    // Cedar: another district's officer, the state centre and a field officer can't send the machine.
    for (const who of [patiala, state, field]) expect((await act(approveBody, who)).status).toBe(403);
    expect((await getCase(deps, caseId, patiala)).status).toBe(403);

    const approve = await act(approveBody);
    expect(approve).toMatchObject({ status: 200, body: { status: "ACTION_APPROVED", version: 2 } });
    const { rows } = await db.query<{ status: string; body: { status: string } }>("SELECT status, body FROM help_requests WHERE id = $1", [help]);
    expect([rows[0].status, rows[0].body.status]).toEqual(["MATCHED", "MATCHED"]);

    const stale = await act({ action: "REJECT", reason: "No", previousCaseVersion: 1 });
    expect(stale).toMatchObject({ status: 409, body: { error: { code: "version_conflict" } } });

    expect((await act({ action: "RECORD_ACTION_TAKEN", reason: "Machine on the field at 16:00", previousCaseVersion: 2 }, field)).body).toMatchObject({ status: "ACTION_APPROVED", version: 3 });
    expect((await act({ action: "CLOSE", reason: "Field sown, no burning", previousCaseVersion: 3 })).body).toMatchObject({ status: "CLOSED", version: 4 });
    expect((await act({ action: "CLOSE", reason: "again", previousCaseVersion: 4 })).body.error.code).toBe("conflict");

    const d = await detail(caseId);
    expect(d.decisions.map((x: { action: string; officerId: string; previousCaseVersion: number }) => [x.action, x.officerId, x.previousCaseVersion])).toEqual([
      ["APPROVE", "officer-sangrur", 1],
      ["RECORD_ACTION_TAKEN", "field-sangrur", 2],
      ["CLOSE", "officer-sangrur", 3],
    ]);
    expect(d.report.status).toBe("CLOSED");
  });

  it("refuses a bad action and an unknown case", async () => {
    const caseId = await citizenReports(offset(HERE, 0, 40_000));
    const bad = await actOnCase(deps, caseId, { action: "FINE", reason: "", previousCaseVersion: 0 }, state);
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.details.map((d: { field: string }) => d.field)).toEqual(["body.action", "body.reason", "body.previousCaseVersion"]);
    expect((await getCase(deps, "case-nope", state)).status).toBe(404);
  });

  it("lists the queue nearest deadline first, a page at a time, filtered by district and status", async () => {
    const all: { case: { id: string }; deadline: string }[] = [];
    let cursor: string | null = null;
    do {
      const res = await listCases(deps, new URL(`http://saans.test/v1/cases?limit=50${cursor ? `&cursor=${cursor}` : ""}`), state);
      expect(res.status).toBe(200);
      const page: { cases: { case: { id: string }; deadline: string }[]; next_cursor: string | null } = await res.json();
      all.push(...page.cases);
      cursor = page.next_cursor;
    } while (cursor && all.length < 2000);
    expect(new Set(all.map((c) => c.case.id)).size).toBe(all.length);
    expect(all.every((c, i) => i === 0 || Date.parse(c.deadline) >= Date.parse(all[i - 1].deadline))).toBe(true);

    const sangrur = await (await listCases(deps, new URL(`http://saans.test/v1/cases?district=${kisan.help_request.district}&status=OPEN&limit=100`), state)).json();
    expect(sangrur.cases.every((c: { district: string; case: { status: string } }) => c.district === kisan.help_request.district && c.case.status === "OPEN")).toBe(true);
    expect((await listCases(deps, new URL("http://saans.test/v1/cases?status=DONE"), state)).status).toBe(400);
    expect((await listCases(deps, new URL("http://saans.test/v1/cases?cursor=garbage"), state)).status).toBe(400);
  });

  it("shows an officer only their own district's queue, and refuses another district's", async () => {
    const own = await (await listCases(deps, new URL("http://saans.test/v1/cases?limit=100"), sdm)).json();
    expect(own.cases.length).toBeGreaterThan(0);
    expect(own.cases.every((c: { district: string }) => c.district === "Sangrur")).toBe(true);
    expect((await listCases(deps, new URL("http://saans.test/v1/cases?district=Sangrur"), patiala)).status).toBe(403);
    const theirs = await (await listCases(deps, new URL("http://saans.test/v1/cases?limit=100"), patiala)).json();
    expect(theirs.cases.some((c: { district: string }) => c.district !== "Patiala")).toBe(false);
  });
});
