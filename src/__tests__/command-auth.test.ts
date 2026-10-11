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

// #64: the Command console always uses the demo PIN/citizen sign-ins and the same-origin Next.js routes,
// deployed or local, even where Cognito settings exist. These check that, and that errors still read clearly.
describe("Command console authorization (demo sign-ins)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "false");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_REGION", "ap-south-1");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "saans-test");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "test-client");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_REDIRECT_URI", "https://app.example/command");
    vi.stubEnv("NEXT_PUBLIC_COGNITO_LOGOUT_URI", "https://app.example/");
    vi.stubEnv("NEXT_PUBLIC_COMMAND_API_BASE_URL", "https://command.example/dev");
    storage.clear();
    const local = new MemoryStorage();
    local.setItem("saans_citizen_auth", "citizen-abc123");
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("localStorage", local);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { sessionStorage: storage, localStorage: local, location: {} },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const ok = (body: unknown) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));

  it("asks the same-origin route with the officer's demo token, even with Cognito set up and signed in", async () => {
    authenticate();
    const fetchMock = ok({ tickets: [], next_cursor: null, total: 0 });
    vi.stubGlobal("fetch", fetchMock);
    const { listTickets } = await import("../app/command/commandApi");

    await expect(listTickets({ limit: 5 })).resolves.toMatchObject({ tickets: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/tickets?limit=5",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer local-state-command" }) }),
    );
  });

  it("sends the citizen's own identity, so they see only their reports", async () => {
    const fetchMock = ok({ tickets: [], next_cursor: null, total: 0 });
    vi.stubGlobal("fetch", fetchMock);
    const { listTickets } = await import("../app/command/commandApi");

    await listTickets({}, "local-citizen-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/tickets?",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer local-citizen-1", "x-user-id": "citizen-abc123" }) }),
    );
  });

  it.each([
    [401, "Your officer session has expired. Sign in again."],
    [403, "This account is not authorized for the Command console."],
  ])("returns a clear message for HTTP %s", async (status, expectedMessage) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    const { listTickets } = await import("../app/command/commandApi");

    await expect(listTickets()).rejects.toMatchObject({ status, message: expectedMessage });
  });
});
