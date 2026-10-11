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

const storage = new MemoryStorage();

function authenticate(token = "real-cognito-access-token") {
  storage.setItem("saans_cognito_access_token", token);
  storage.setItem("saans_cognito_expires_at", String(Date.now() + 3_600_000));
}

describe("live Command authorization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "false");
    // The deployment this models has Cognito set up; without it Command uses the local console.
    vi.stubEnv("NEXT_PUBLIC_COGNITO_REGION", "ap-south-1");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "saans-test");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "test-client");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_REDIRECT_URI", "https://app.example/command");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_LOGOUT_URI", "https://app.example/");
    vi.stubEnv(
      "NEXT_PUBLIC_COMMAND_API_BASE_URL",
      "https://command.example/dev",
    );
    storage.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage,
        localStorage: new MemoryStorage(),
        location: {},
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not call the Command API while unauthenticated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { listCases } = await import("../app/command/commandApi");

    await expect(listCases()).rejects.toMatchObject({
      status: 401,
      code: "authentication_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the Cognito access token and the Command-specific API URL", async () => {
    authenticate();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ cases: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { listCases } = await import("../app/command/commandApi");

    await expect(listCases()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://command.example/dev/v1/cases?limit=100",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer real-cognito-access-token",
        }),
      }),
    );
  });

  it.each([
    [401, "Your officer session has expired. Sign in again."],
    [403, "This account is not authorized for the Command console."],
  ])("returns a clear message for HTTP %s", async (status, expectedMessage) => {
    authenticate();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );
    const { listCases } = await import("../app/command/commandApi");

    await expect(listCases()).rejects.toMatchObject({
      status,
      message: expectedMessage,
    });
  });
});
