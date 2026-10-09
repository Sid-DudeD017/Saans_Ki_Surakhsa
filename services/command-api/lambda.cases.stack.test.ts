// The case API's Lambda handlers (G7) on the real local stack, with Verified Permissions faked the way it
// decides: the officer's token names their district, and the case's district comes from the database.
// Skipped unless SAANS_DATABASE_URL is set; CI's command-intake job sets it.
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runIntake } from "../workflows/local";
import { setAvpClientForTest } from "./avp";
import { commandConfig } from "./config";
import { ensureBucket, migrate, newId, pool, s3Client, type IntakeDeps } from "./deps";
import { handleComplaints } from "./http";
import { caseAction, caseDetail, casesList } from "./lambda";

const stack = !!process.env.SAANS_DATABASE_URL;

describe.skipIf(!stack)("case API Lambdas behind Cognito and Verified Permissions", () => {
  const config = commandConfig();
  const db = pool(config);
  const asked: { token: string; action: string; district: string }[] = [];

  beforeAll(async () => {
    await migrate(db);
    process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID = "store-test";
    setAvpClientForTest({
      send: async ({ input }: { input: { accessToken: string; action: { actionId: string }; entities: { entityList: { attributes: { district: { string: string } } }[] } } }) => {
        const district = input.entities.entityList[0].attributes.district.string;
        asked.push({ token: input.accessToken, action: input.action.actionId, district });
        return { decision: input.accessToken === `token-${district}` ? "ALLOW" : "DENY" };
      },
    });
  });
  afterAll(() => db.end());

  /** A farm-fire report somewhere new in Sangrur, made into a case by the local workflow. */
  async function sangrurCase() {
    const deps: IntakeDeps = { db, s3: s3Client(config), config, now: () => new Date(), newId, startWorkflow: async (id) => void (await runIntake(deps, id, async () => {})) };
    await ensureBucket(deps.s3, config.evidenceBucket);
    const location = { lat: 30.1 + Math.random() * 0.2, lon: 75.75 + Math.random() * 0.3 };
    const res = await handleComplaints(
      new Request("http://saans.test/v1/complaints", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify({ type: "garbage", location, description: "Lambda test", evidence: [] }) }),
      deps,
    );
    const { id } = await res.json();
    return (await db.query<{ id: string }>("SELECT id FROM cases WHERE complaint_id = $1", [id])).rows[0].id;
  }

  const event = (district: string | null, extra: Record<string, unknown> = {}, method = "GET") => ({
    rawPath: "/dev/v1/cases",
    rawQueryString: "limit=100",
    headers: { authorization: `Bearer token-${district}` },
    requestContext: { http: { method }, domainName: "api.test", authorizer: { lambda: district ? { subject: `sub-${district}`, role: "officer", district } : {} } },
    ...extra,
  });
  const run = async (p: Promise<{ statusCode: number; body: string }>) => {
    const r = await p;
    return { status: r.statusCode, body: JSON.parse(r.body) };
  };

  it("lists only the officer's district, and refuses an unsigned request", async () => {
    await sangrurCase();
    const sangrur = await run(casesList(event("sangrur")));
    expect(sangrur.status).toBe(200);
    expect(sangrur.body.cases.length).toBeGreaterThan(0);
    expect(sangrur.body.cases.every((c: { district: string }) => c.district === "Sangrur")).toBe(true);
    const patiala = await run(casesList(event("patiala")));
    expect(patiala.body.cases.every((c: { district: string }) => c.district === "Patiala")).toBe(true);
    expect((await run(casesList(event(null)))).status).toBe(401);
  });

  it("opens and acts on a Sangrur case for Sangrur, and answers 403 to Patiala", async () => {
    const id = await sangrurCase();
    const mine = await run(caseDetail(event("sangrur", { pathParameters: { id } })));
    expect(mine.status).toBe(200);
    expect(mine.body.report.reporterId).toBe("anonymous"); // no one sees who reported on AWS
    expect((await run(caseDetail(event("patiala", { pathParameters: { id } })))).status).toBe(403);

    const body = JSON.stringify({ action: "MARK_IN_FIELD", reason: "On the way", previousCaseVersion: mine.body.case.version });
    expect((await run(caseAction(event("patiala", { pathParameters: { id }, body }, "POST")))).status).toBe(403);
    const acted = await run(caseAction(event("sangrur", { pathParameters: { id }, body }, "POST")));
    expect(acted).toMatchObject({ status: 200, body: { version: mine.body.case.version + 1 } });
    const { rows } = await db.query<{ officer_id: string }>("SELECT officer_id FROM case_decisions WHERE case_id = $1", [id]);
    expect(rows).toEqual([{ officer_id: "sub-sangrur" }]);
    expect(asked).toContainEqual({ token: "token-sangrur", action: "mark_in_field", district: "sangrur" });
  });
});
