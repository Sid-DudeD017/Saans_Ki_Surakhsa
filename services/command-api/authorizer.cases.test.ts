// The authorizer on the case API (G7): it only signs officers in there; the case Lambda asks Verified
// Permissions about each case. And routes are matched by routeKey, so a named stage (/dev) still matches.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizer, routeOf, setAvpClientForTest, setVerifierForTest } from "./authorizer";

vi.mock("aws-jwt-verify", () => ({ CognitoJwtVerifier: { create: vi.fn() } }));
vi.mock("@aws-sdk/client-verifiedpermissions", () => ({
  VerifiedPermissionsClient: class {},
  IsAuthorizedWithTokenCommand: class {
    constructor(public input: unknown) {}
  },
}));

const event = (routeKey: string, path = "/dev/v1/cases") => ({
  routeKey,
  headers: { authorization: "Bearer valid" },
  requestContext: { http: { method: routeKey.split(" ")[0], path } },
});

describe("authorizer on the case API", () => {
  let avpCalls = 0;
  const groups = (g: string[]) => setVerifierForTest({ verify: async () => ({ sub: "officer-sub", "cognito:groups": g }) } as never);

  beforeEach(() => {
    process.env.COGNITO_USER_POOL_ID = "ap-south-1_test";
    process.env.COGNITO_CLIENT_ID = "client_test";
    process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID = "store_test";
    avpCalls = 0;
    setAvpClientForTest({ send: async () => (avpCalls++, { decision: "ALLOW" }) });
  });

  it("signs a Sangrur officer into every case route without asking about a case", async () => {
    groups(["officer", "district-sangrur"]);
    for (const route of ["GET /v1/cases", "GET /v1/cases/{id}", "POST /v1/cases/{id}/actions"]) {
      expect(await authorizer(event(route))).toEqual({ isAuthorized: true, context: { subject: "officer-sub", role: "officer", district: "sangrur" } });
    }
    expect(avpCalls).toBe(0);
  });

  it("refuses someone who isn't an officer, or whose district is missing or doubled", async () => {
    for (const g of [["district-sangrur"], ["officer"], ["officer", "district-sangrur", "district-patiala"]]) {
      groups(g);
      expect((await authorizer(event("GET /v1/cases"))).isAuthorized, g.join()).toBe(false);
    }
  });

  it("refuses a request without a token", async () => {
    groups(["officer", "district-patiala"]);
    expect((await authorizer({ ...event("GET /v1/cases"), headers: {} })).isAuthorized).toBe(false);
  });

  it("matches whoami on a named stage, which the raw path alone didn't", async () => {
    groups(["officer", "district-patiala"]);
    expect(await authorizer(event("GET /v1/officer/whoami", "/dev/v1/officer/whoami"))).toMatchObject({ isAuthorized: true, context: { district: "patiala" } });
    expect(avpCalls).toBe(1);
  });

  it("folds stage prefixes and case ids when there's no routeKey", () => {
    const at = (method: string, path: string) => routeOf({ requestContext: { http: { method, path } } });
    expect(at("GET", "/dev/v1/officer/whoami")).toBe("GET /v1/officer/whoami");
    expect(at("GET", "/v1/cases")).toBe("GET /v1/cases");
    expect(at("GET", "/demo/v1/cases/case-1")).toBe("GET /v1/cases/{id}");
    expect(at("POST", "/v1/cases/case-1/actions")).toBe("POST /v1/cases/{id}/actions");
    expect(at("GET", "/health")).toBe("GET /health");
  });
});
