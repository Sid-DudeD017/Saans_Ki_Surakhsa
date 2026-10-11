import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const sessionStorage = new MemoryStorage();
const assign = vi.fn();

function installBrowser() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
      location: { search: "", assign, replace: vi.fn() },
    },
  });
}

describe("Cognito Authorization Code flow with PKCE", () => {
  beforeEach(() => {
    sessionStorage.clear();
    assign.mockReset();
    vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "client-id");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "saans-login");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_REGION", "ap-south-1");
    vi.stubEnv(
      "NEXT_PUBLIC_COGNITO_REDIRECT_URI",
      "https://app.example/callback",
    );
    vi.stubEnv("NEXT_PUBLIC_COGNITO_LOGOUT_URI", "https://app.example/");
    installBrowser();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("generates a cryptographically random verifier and its SHA-256 challenge", async () => {
    const { createCodeChallenge, generateRandomValue } =
      await import("../lib/cognitoAuth");
    const first = generateRandomValue(64);
    const second = generateRandomValue(64);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(
      await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("starts a code-flow login with state and an S256 challenge", async () => {
    const { beginCognitoLogin } = await import("../lib/cognitoAuth");
    await beginCognitoLogin();

    const destination = new URL(assign.mock.calls[0][0]);
    expect(destination.origin).toBe(
      "https://saans-login.auth.ap-south-1.amazoncognito.com",
    );
    expect(destination.pathname).toBe("/oauth2/authorize");
    expect(destination.searchParams.get("response_type")).toBe("code");
    expect(destination.searchParams.get("scope")).toBe("openid email profile");
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    expect(destination.searchParams.get("state")).toBeTruthy();
  });

  it("rejects a callback whose OAuth state does not match", async () => {
    const { beginCognitoLogin, handleCognitoCallback } =
      await import("../lib/cognitoAuth");
    await beginCognitoLogin();

    await expect(
      handleCognitoCallback("?code=abc&state=tampered"),
    ).rejects.toThrow("could not be verified");
    expect(sessionStorage.getItem("saans_cognito_pkce_verifier")).toBeNull();
  });

  it("exchanges a successful callback and rejects the token after expiration", async () => {
    const { beginCognitoLogin, getCognitoAccessToken, handleCognitoCallback } =
      await import("../lib/cognitoAuth");
    await beginCognitoLogin();
    const state = new URL(assign.mock.calls[0][0]).searchParams.get("state");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            id_token: "id-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await handleCognitoCallback(`?code=valid-code&state=${state}`);
    expect(getCognitoAccessToken()).toBe("access-token");
    expect(getCognitoAccessToken(Date.now() + 3_700_000)).toBeNull();
  });

  it("surfaces an OAuth callback error without attempting token exchange", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { handleCognitoCallback } = await import("../lib/cognitoAuth");

    await expect(
      handleCognitoCallback(
        "?error=access_denied&error_description=Officer+cancelled",
      ),
    ).rejects.toThrow("Officer cancelled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
