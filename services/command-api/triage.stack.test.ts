// Triage on the real local stack (npm run stack): the district lookup, merging duplicate reports (150 m,
// 6 h, exact and just-outside edges), the FIRMS check from deterministic fixtures, and deadline escalation.
// Skipped unless SAANS_DATABASE_URL is set; CI's command-intake job sets it.
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runIntake } from "../workflows/local";
import { commandConfig } from "./config";
import { ensureBucket, migrate, newId, pool, s3Client, type FireObservation, type IntakeDeps } from "./deps";
import { ESCALATION_OFFICER, escalateOverdue } from "./escalation";
import { firesNear } from "./firms";
import { handleComplaints } from "./http";

const stack = !!process.env.SAANS_DATABASE_URL;
type Point = { lat: number; lon: number };
const HOUR = 3600_000;

describe.skipIf(!stack)("triage on PostGIS", () => {
  const config = commandConfig();
  const db = pool(config);
  let clock = Date.now();
  let fires: FireObservation[] | null = [];
  const deps: IntakeDeps = {
    db,
    s3: s3Client(config),
    config,
    now: () => new Date(clock),
    newId,
    startWorkflow: async (id) => {
      await runIntake(deps, id, async () => {});
    },
    fires: async (at, radiusM, since, until) => (fires === null ? null : firesNear(fires, at, radiusM, since, until)),
  };

  beforeAll(async () => {
    await migrate(db);
    await ensureBucket(deps.s3, config.evidenceBucket);
  });
  afterAll(() => db.end());

  /**
   * A new spot each call, so earlier runs' cases are never this close: north of both demo districts, and
   * north of where cases.stack.test.ts files farmers' help requests, so no report here links to a farm.
   */
  const somewhere = (): Point => ({ lat: 32.8 + Math.random() * 0.8, lon: 73.5 + Math.random() * 2 });

  /** The point `metres` from `p` along `bearing` degrees, on PostGIS's own spheroid. */
  async function project(p: Point, metres: number, bearing = 0): Promise<Point> {
    const { rows } = await db.query<{ lat: number; lon: number }>(
      "SELECT ST_Y(g::geometry) AS lat, ST_X(g::geometry) AS lon FROM ST_Project(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3::float8, radians($4)) AS g",
      [p.lon, p.lat, metres, bearing],
    );
    return { lat: Number(rows[0].lat), lon: Number(rows[0].lon) };
  }

  /** Files a report at `at`, `hoursAgo` hours before `from` (now), and returns its complaint and case. */
  async function report(at: Point, type = "farm_fire", hoursAgo = 0, from = Date.now()) {
    clock = from - hoursAgo * HOUR;
    const res = await handleComplaints(
      new Request("http://saans.test/v1/complaints", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": randomUUID() },
        body: JSON.stringify({ type, location: at, description: "Triage test", evidence: [] }),
      }),
      deps,
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const { rows } = await db.query<{ status: string; case_id: string | null }>(
      `SELECT k.status, COALESCE(c.id, r.case_id) AS case_id
         FROM complaints k LEFT JOIN cases c ON c.complaint_id = k.id LEFT JOIN case_reports r ON r.complaint_id = k.id
        WHERE k.id = $1`,
      [id],
    );
    clock = Date.now();
    return { complaintId: id, status: rows[0].status, caseId: rows[0].case_id! };
  }

  const caseRow = async (id: string) =>
    (await db.query<{ district: string | null; verification_status: string; observation: { distanceFromReportMeters: number; source: string } | null; escalated_at: Date | null; escalated_to: string[] | null; version: number }>(
      "SELECT district, verification_status, observation, escalated_at, escalated_to, version FROM cases WHERE id = $1",
      [id],
    )).rows[0];

  describe("jurisdiction", () => {
    it("a report in Sangrur is Sangrur's, one in Patiala is Patiala's", async () => {
      const sangrur = await report({ lat: 30.1 + Math.random() * 0.2, lon: 75.75 + Math.random() * 0.3 }, "garbage");
      const patiala = await report({ lat: 30.15 + Math.random() * 0.3, lon: 76.35 + Math.random() * 0.3 }, "garbage");
      expect((await caseRow(sangrur.caseId)).district).toBe("Sangrur");
      expect((await caseRow(patiala.caseId)).district).toBe("Patiala");
    });

    it("a report outside both districts has none", async () => {
      expect((await caseRow((await report(somewhere(), "garbage")).caseId)).district).toBeNull();
    });
  });

  describe("duplicates: same type, 150 m, 6 hours", () => {
    it("a second report 149.9 m away an hour later joins the first case", async () => {
      const first = await report(somewhere(), "farm_fire", 1);
      const second = await report(await project(await spotOf(first.complaintId), 149.9, 45));
      expect(second).toMatchObject({ caseId: first.caseId, status: "duplicate" });
      const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM cases WHERE id = $1 OR complaint_id = $2", [first.caseId, second.complaintId]);
      expect(rows[0].n).toBe(1);
    });

    it("one 150.1 m away opens its own case", async () => {
      const first = await report(somewhere());
      const second = await report(await project(await spotOf(first.complaintId), 150.1, 200));
      expect(second.caseId).not.toBe(first.caseId);
      expect(second.status).toBe("assigned");
    });

    it("exactly 6 hours later still joins; 6 hours and a minute later doesn't", async () => {
      const now = Date.now();
      const spot = somewhere();
      const first = await report(spot, "farm_fire", 6, now);
      expect((await report(await project(spot, 50), "farm_fire", 0, now)).caseId).toBe(first.caseId);

      const other = somewhere();
      const old = await report(other, "farm_fire", 6 + 1 / 60, now);
      expect((await report(await project(other, 50), "farm_fire", 0, now)).caseId).not.toBe(old.caseId);
    });

    it("a different kind of report at the same spot is a different case", async () => {
      const spot = somewhere();
      const fire = await report(spot, "farm_fire");
      expect((await report(spot, "garbage")).caseId).not.toBe(fire.caseId);
    });

    it("a closed case takes no more reports", async () => {
      const spot = somewhere();
      const first = await report(spot);
      await db.query("UPDATE cases SET status = 'CLOSED' WHERE id = $1", [first.caseId]);
      expect((await report(spot)).caseId).not.toBe(first.caseId);
    });

    it("a retried workflow merges a duplicate once", async () => {
      const spot = somewhere();
      const first = await report(spot);
      const second = await report(await project(spot, 30));
      await runIntake(deps, second.complaintId, async () => {});
      const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM case_reports WHERE case_id = $1", [first.caseId]);
      expect(rows[0].n).toBe(1);
    });
  });

  describe("FIRMS check: a fire within 1 km, in the 12 hours before", () => {
    const fire = (at: Point, hoursAgo: number): FireObservation => ({
      ...at, acquisition_time: new Date(Date.now() - hoursAgo * HOUR).toISOString(), satellite: "N", confidence: "h", frp: 12.5,
    });

    it("a fire 900 m away corroborates the report", async () => {
      const spot = somewhere();
      fires = [fire(await project(spot, 900, 90), 2), fire(await project(spot, 5000), 1)];
      const c = await caseRow((await report(spot)).caseId);
      expect(c.verification_status).toBe("SATELLITE_CORROBORATED");
      expect(c.observation).toMatchObject({ source: "NASA_FIRMS", confidence: 90, frp: 12.5 });
      expect(Math.abs(c.observation!.distanceFromReportMeters - 900)).toBeLessThan(5);
    });

    it("a fire 1.1 km away, or 13 hours before, doesn't", async () => {
      const spot = somewhere();
      fires = [fire(await project(spot, 1100, 90), 2), fire(await project(spot, 300), 13)];
      const c = await caseRow((await report(spot)).caseId);
      expect(c.verification_status).toBe("NO_MATCH");
      expect(c.observation).toBeNull();
    });

    it("when FIRMS can't be asked, the case is still made, unverified", async () => {
      fires = null;
      expect((await caseRow((await report(somewhere())).caseId)).verification_status).toBe("UNVERIFIED");
      fires = [];
    });

    it("only farm fires are checked", async () => {
      const spot = somewhere();
      fires = [fire(spot, 1)];
      expect((await caseRow((await report(spot, "garbage")).caseId)).verification_status).toBe("UNVERIFIED");
      fires = [];
    });
  });

  describe("escalation", () => {
    it("a farm fire nobody acted on goes to the state command centre after 4 hours, once", async () => {
      const overdue = await report(somewhere(), "farm_fire", 4 + 1 / 120); // deadline 30 s ago
      const notYet = await report(somewhere(), "farm_fire", 4 - 1 / 60); // deadline in a minute
      const escalated = await escalateOverdue(deps);
      expect(escalated).toContain(overdue.caseId);
      expect(escalated).not.toContain(notYet.caseId);

      const c = await caseRow(overdue.caseId);
      expect(c.escalated_to).toEqual(["State Command Centre"]);
      expect(c.version).toBe(2);
      expect(await escalateOverdue(deps)).not.toContain(overdue.caseId);
      const { rows } = await db.query<{ officer_id: string; action: string }>("SELECT officer_id, action FROM case_decisions WHERE case_id = $1", [overdue.caseId]);
      expect(rows).toEqual([{ officer_id: ESCALATION_OFFICER, action: "ESCALATE" }]);
    });

    it("a Sangrur case goes to Sangrur's Deputy Commissioner", async () => {
      const c = await report({ lat: 30.1 + Math.random() * 0.2, lon: 75.75 + Math.random() * 0.3 }, "firecrackers", 3);
      await escalateOverdue(deps);
      expect((await caseRow(c.caseId)).escalated_to).toEqual(["Deputy Commissioner, Sangrur"]);
    });

    it("a case an officer has acted on, or closed, isn't escalated", async () => {
      const acted = await report(somewhere(), "farm_fire", 5);
      await db.query(
        "INSERT INTO case_decisions (id, case_id, officer_id, action, reason, previous_case_version) VALUES ($1, $2, 'officer-demo', 'MARK_IN_FIELD', 'On my way', 1)",
        [newId("decision"), acted.caseId],
      );
      const closed = await report(somewhere(), "farm_fire", 5);
      await db.query("UPDATE cases SET status = 'CLOSED' WHERE id = $1", [closed.caseId]);
      const escalated = await escalateOverdue(deps);
      expect(escalated).not.toContain(acted.caseId);
      expect(escalated).not.toContain(closed.caseId);
    });

    it("in demo configuration a one-minute deadline escalates at the next sweep, inside a minute", async () => {
      expect(config.escalationSweepSeconds).toBeLessThanOrEqual(30);
      const demo: IntakeDeps = { ...deps, config: { ...config, deadlineMinutes: 1 } };
      clock = Date.now() - 61_000;
      const res = await handleComplaints(
        new Request("http://saans.test/v1/complaints", {
          method: "POST",
          headers: { "content-type": "application/json", "Idempotency-Key": randomUUID() },
          body: JSON.stringify({ type: "vehicle", location: somewhere(), description: "Demo deadline", evidence: [] }),
        }),
        { ...demo, startWorkflow: async (id) => void (await runIntake(demo, id, async () => {})) },
      );
      clock = Date.now();
      const { id } = await res.json();
      const { rows } = await db.query<{ id: string; deadline: Date; received_at: Date }>(
        "SELECT c.id, c.deadline, k.received_at FROM cases c JOIN complaints k ON k.id = c.complaint_id WHERE k.id = $1",
        [id],
      );
      expect(rows[0].deadline.getTime() - rows[0].received_at.getTime()).toBe(60_000);
      expect(await escalateOverdue(deps)).toContain(rows[0].id);
    });
  });

  async function spotOf(complaintId: string): Promise<Point> {
    const { rows } = await db.query<{ lat: number; lon: number }>(
      "SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon FROM complaints WHERE id = $1",
      [complaintId],
    );
    return { lat: Number(rows[0].lat), lon: Number(rows[0].lon) };
  }
});
