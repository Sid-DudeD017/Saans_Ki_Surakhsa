import { describe, it, expect, beforeEach, vi } from "vitest";
import { authorizer, setVerifierForTest, setAvpClientForTest } from "./authorizer";
import { authorizeResource, setAvpClientForTest as setAvpClientForTest2 } from "./avp";

vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: { create: vi.fn() }
}));
vi.mock("@aws-sdk/client-verifiedpermissions", () => ({
  VerifiedPermissionsClient: class {},
  IsAuthorizedWithTokenCommand: class {
    constructor(public input: any) {}
  }
}));

describe("Production Authorizer Tests", () => {
  beforeEach(() => {
    process.env.COGNITO_USER_POOL_ID = "us-east-1_test";
    process.env.COGNITO_CLIENT_ID = "client_test";
    process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID = "store_test";
  });

  const mockVerify = (overrides: Record<string, unknown>, shouldThrow?: string) => {
    setVerifierForTest({
      verify: async (token: string) => {
        if (shouldThrow === "signature") throw new Error("signature invalid");
        if (shouldThrow === "expired") throw new Error("Token expired");
        return {
          sub: "123",
          "cognito:groups": ["officer", "district-sangrur"],
          ...overrides
        } as any;
      }
    } as any);
  };

  const mockAvp = (decision: string, shouldThrow = false, assertInput?: (input: any) => void) => {
    const mockClient = {
      send: async (command: any) => {
        if (assertInput) assertInput(command.input);
        if (shouldThrow) throw new Error("AVP Error");
        return { decision };
      }
    };
    setAvpClientForTest(mockClient);
    setAvpClientForTest2(mockClient);
  };

  const validEvent = (method = "GET", path = "/v1/officer/whoami") => ({
    headers: { authorization: "Bearer valid" },
    requestContext: { http: { method, path } }
  });

  it("missing configuration fails closed", async () => {
    delete process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID;
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("missing header", async () => {
    expect(await authorizer({ headers: {} })).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });
  
  it("malformed header", async () => {
    expect(await authorizer({ headers: { authorization: "token123" } })).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("verifier invalid signature", async () => {
    mockVerify({}, "signature");
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("verifier expired token", async () => {
    mockVerify({}, "expired");
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("missing officer group", async () => {
    mockVerify({ "cognito:groups": ["district-sangrur"] });
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("missing district group", async () => {
    mockVerify({ "cognito:groups": ["officer"] });
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("both district groups", async () => {
    mockVerify({ "cognito:groups": ["officer", "district-sangrur", "district-patiala"] });
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("unknown action", async () => {
    mockVerify({});
    expect(await authorizer(validEvent("GET", "/v1/unknown"))).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("AVP DENY", async () => {
    mockVerify({});
    mockAvp("DENY");
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("AVP error", async () => {
    mockVerify({});
    mockAvp("ALLOW", true);
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("AVP empty decision", async () => {
    mockVerify({});
    mockAvp("");
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  it("whoami allow", async () => {
    mockVerify({});
    mockAvp("ALLOW");
    expect(await authorizer(validEvent("GET", "/v1/officer/whoami"))).toEqual({ isAuthorized: true, context: { subject: "123", role: "officer", district: "sangrur" } });
  });

  it("Patiala whoami allow", async () => {
    mockVerify({ "cognito:groups": ["officer", "district-patiala"] });
    mockAvp("ALLOW");
    expect(await authorizer(validEvent())).toEqual({ isAuthorized: true, context: { subject: "123", role: "officer", district: "patiala" } });
  });

  it("safe/no-leak denial", async () => {
    mockVerify({});
    mockAvp("DENY");
    const res = await authorizer(validEvent());
    expect(res).toEqual({ isAuthorized: false, context: { error: "unauthorized" } });
  });

  // Resource level helper tests
  it("resource helper same-district allow", async () => {
    mockAvp("ALLOW", false, (input) => {
      expect(input.resource.entityId).toBe("real-case-123");
      expect(input.action.actionId).toBe("detail");
      expect(input.entities.entityList[0].attributes.district.string).toBe("sangrur");
    });
    const result = await authorizeResource("token", "detail", "real-case-123", "sangrur");
    expect(result).toBe(true);
  });

  it("resource helper Patiala allow", async () => {
    mockAvp("ALLOW", false, (input) => {
      expect(input.entities.entityList[0].attributes.district.string).toBe("patiala");
    });
    const result = await authorizeResource("token", "detail", "real-case-123", "patiala");
    expect(result).toBe(true);
  });

  it("resource helper cross-district deny (Sangrur requesting Patiala)", async () => {
    mockAvp("DENY");
    const result = await authorizeResource("token", "detail", "real-case-123", "patiala");
    expect(result).toBe(false);
  });

  it("resource helper cross-district deny (Patiala requesting Sangrur)", async () => {
    mockAvp("DENY");
    const result = await authorizeResource("token", "detail", "real-case-123", "sangrur");
    expect(result).toBe(false);
  });

  it("resource helper every allowed action", async () => {
    mockAvp("ALLOW");
    const actions = ["list", "counts", "map", "detail", "evidence", "assign", "mark_in_field", "record_action", "close"];
    for (const action of actions) {
      expect(await authorizeResource("token", action, "case1", "sangrur")).toBe(true);
    }
  });

  it("resource helper unknown action rejected before AWS call", async () => {
    let called = false;
    mockAvp("ALLOW", false, () => { called = true; });
    expect(await authorizeResource("token", "unknown_action", "case1", "sangrur")).toBe(false);
    expect(called).toBe(false);
  });

  it("resource helper AVP DENY", async () => {
    mockAvp("DENY");
    expect(await authorizeResource("token", "detail", "case1", "sangrur")).toBe(false);
  });

  it("resource helper SDK error", async () => {
    mockAvp("ALLOW", true);
    expect(await authorizeResource("token", "detail", "case1", "sangrur")).toBe(false);
  });

  it("resource helper missing policy store config", async () => {
    delete process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID;
    await expect(authorizeResource("token", "detail", "case1", "sangrur")).rejects.toThrow("Missing policy store config");
  });
});
