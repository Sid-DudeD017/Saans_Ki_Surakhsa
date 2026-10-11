// Intake pieces that need no database: inputs against the contract, routing, idempotency hashing and
// the presigned upload. intake.stack.test.ts covers the rest on PostGIS and LocalStack.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { ROUTED_TYPES, commandConfig, routeFor } from "./config";
import { canonicalJson, requestHash, submitComplaint } from "./complaints";
import { s3Client, type IntakeDeps } from "./deps";
import { CITIZEN_TYPES, GRIEVANCE_SUBTYPES, MAX_UPLOAD_BYTES, MEDIA_TYPES, parseComplaint } from "./inputs";
import { indiaTime } from "./time";
import { createUpload } from "./uploads";

const root = join(__dirname, "../..");
const p4 = YAML.parse(readFileSync(join(root, "packages/contracts/proposals/p4-command.openapi.yaml"), "utf8"));
const p1 = JSON.parse(readFileSync(join(root, "packages/contracts/proposals/p1-kisan.openapi.json"), "utf8"));
const schemas = p4.components.schemas;

describe("inputs match the contract", () => {
  it("upload media types and size limit", () => {
    expect([...MEDIA_TYPES]).toEqual(schemas.UploadInput.properties.media_type.enum);
    expect(MAX_UPLOAD_BYTES).toBe(schemas.UploadInput.properties.byte_size.maximum);
  });

  it("citizen complaint types", () => {
    expect([...CITIZEN_TYPES]).toEqual(schemas.ComplaintInput.properties.type.enum);
  });

  it("P4's example report and P1's farmer_support example are accepted", () => {
    const report = p4.paths["/v1/complaints"].post.requestBody.content["application/json"].example;
    expect(parseComplaint(report).success).toBe(true);
    const kisan = p1.components.schemas.FarmerSupportComplaint.examples[0];
    expect(parseComplaint(kisan).success).toBe(true);
    const { type: _type, ...untyped } = kisan; // type defaults to farmer_support
    expect(parseComplaint(untyped)).toMatchObject({ success: true, data: { type: "farmer_support" } });
  });

  it("a farmer's complaint (kisan_grievance) matches the contract", () => {
    expect([...GRIEVANCE_SUBTYPES]).toEqual(schemas.KisanGrievance.properties.subtype.enum);
    const ok = parseComplaint({ type: "kisan_grievance", location: { lat: 30.27, lon: 76.04 }, subtype: "chc_no_show", chc_name: "Demo CHC A" });
    expect(ok).toMatchObject({ success: true, data: { type: "kisan_grievance", evidence: [] } });
    const bad = parseComplaint({ type: "kisan_grievance", location: { lat: 30.27, lon: 76.04 }, subtype: "fire" });
    expect(bad.error?.issues[0].path).toEqual(["subtype"]);
  });

  it("a report outside the map is refused field by field", () => {
    const result = parseComplaint({ type: "farm_fire", location: { lat: 95, lon: 76 }, evidence: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["location", "lat"]);
  });
});

describe("routing (infra/config/routing.json)", () => {
  it("routes every complaint type, the farmer's two included", () => {
    expect(ROUTED_TYPES.sort()).toEqual([...CITIZEN_TYPES, "farmer_support", "kisan_grievance"].sort());
  });

  it("a farmer's complaint goes to the District Agriculture Officer and is never a penalty", () => {
    expect(routeFor("kisan_grievance")).toEqual({ authorities: ["District Agriculture Officer"], deadlineHours: 48, penalty: false });
  });

  it("a farmer's request for help is never a penalty", () => {
    expect(routeFor("farmer_support")).toEqual({ authorities: ["Agriculture department", "CHC"], deadlineHours: 72, penalty: false });
    for (const type of CITIZEN_TYPES) expect(routeFor(type).penalty).toBe(true);
  });

  it("deadlines are the demo configuration's", () => {
    expect(Object.fromEntries(ROUTED_TYPES.map((t) => [t, routeFor(t).deadlineHours]))).toEqual({
      farm_fire: 4, garbage: 12, vehicle: 24, firecrackers: 2, farmer_support: 72, dust: 24, industrial: 24, kisan_grievance: 48,
    });
  });
});

describe("idempotency", () => {
  it("the same JSON in another order hashes the same", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"e":0,"f":1}]},"b":1}');
    expect(requestHash({ a: 1, b: 2 })).toBe(requestHash({ b: 2, a: 1 }));
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
  });

  it("a missing or short key is refused before anything is read", async () => {
    const deps = { db: { query: () => { throw new Error("no database in this test"); } } } as unknown as IntakeDeps;
    for (const key of [null, "abc"]) {
      const res = await submitComplaint(deps, key, {});
      expect(res.status).toBe(400);
      expect((await res.json()).error.details[0].field).toBe("header.Idempotency-Key");
    }
  });
});

describe("POST /v1/uploads", () => {
  it("signs a PUT bound to the file's type and sha256 for 15 minutes", async () => {
    const config = commandConfig({});
    const inserted: unknown[][] = [];
    const deps = {
      config,
      s3: s3Client(config),
      now: () => new Date("2026-10-23T08:30:00Z"),
      db: { query: async (_sql: string, values: unknown[]) => { inserted.push(values); return { rows: [], rowCount: 1 }; } },
    } as unknown as IntakeDeps;
    const sha256 = "9f2c4e7b1d0a5c3e8f6b2a4d7c9e1f3b5a7d9c2e4f6a8b0c1d3e5f7a9b2c4d6e";
    const target = await createUpload(deps, { media_type: "image/jpeg", byte_size: 1843200, sha256 });

    expect(target.object_key).toMatch(/^evidence\/2026\/10\/23\/[0-9a-f-]{36}\.jpg$/);
    expect(target.method).toBe("PUT");
    expect(target.expires_at).toBe("2026-10-23T14:15:00+05:30");
    expect(target.headers).toEqual({ "Content-Type": "image/jpeg", "x-amz-checksum-sha256": Buffer.from(sha256, "hex").toString("base64") });
    const url = new URL(target.upload_url);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(expect.arrayContaining(["content-type", "host", "x-amz-checksum-sha256"]));
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(inserted[0]).toEqual([target.object_key, "image/jpeg", 1843200, sha256, new Date("2026-10-23T08:45:00Z"), deps.now()]);
  });
});

it("times are India time with +05:30", () => {
  expect(indiaTime(new Date("2026-10-23T08:32:00.123Z"))).toBe("2026-10-23T14:02:00+05:30");
});
