import { describe, expect, it, beforeAll } from "vitest";
import { createTicket, getTicket, listTickets, applyTicketAction, getTicketHistory } from "./tickets";
import { pool, newId, migrate } from "./deps";
import { commandConfig } from "./config";

describe("tickets API", () => {
  const db = pool(commandConfig());

  beforeAll(async () => {
    await migrate(db);
  });

  it("creates a ticket with SAANS- prefix and retrieves it", async () => {
    const res = await createTicket(db, {
      type: "garbage",
      district: "Sangrur",
      reporter_identity: "citizen-1",
      reporter_consent: true,
      idempotency_key: newId("test"),
    });

    expect(res.status).toBe(201);
    expect(res.ticket.id).toMatch(/^SAANS-\d{8}-[0-9A-Z]{6}$/);
    expect(res.ticket.status).toBe("submitted");

    // Get as officer (sees internal)
    const officerView = await getTicket(db, res.ticket.id, true);
    expect((officerView as any).internal_notes).toBeDefined();

    // Get as citizen (no internal)
    const citizenView = await getTicket(db, res.ticket.id, false);
    expect((citizenView as any).internal_notes).toBeUndefined();
  });

  it("applies actions and maps statuses correctly", async () => {
    const res = await createTicket(db, {
      type: "garbage",
      district: "Patiala",
      idempotency_key: newId("test"),
    });

    const id = res.ticket.id;

    // Officer accepts
    const accepted = await applyTicketAction(db, id, { action: "accept" }, "officer-1", true);
    expect(accepted.status).toBe("in_progress");

    // Officer requests info
    const reqInfo = await applyTicketAction(db, id, { action: "request_info", reason: "Need photo" }, "officer-1", true);
    expect(reqInfo.status).toBe("awaiting_information");

    // Citizen provides info via citizen_reopen
    const reopened = await applyTicketAction(db, id, { action: "citizen_reopen", reason: "Here is info" }, "citizen-1", false);
    expect(reopened.status).toBe("submitted");

    // Officer resolves
    const resolved = await applyTicketAction(db, id, { action: "resolve", summary: "Cleaned up" }, "officer-1", true);
    expect(resolved.status).toBe("resolved");

    // History
    const history = await getTicketHistory(db, id);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].action).toBe("accept");
  });

  it("fails to resolve without summary", async () => {
    const res = await createTicket(db, {
      type: "garbage",
      district: "Patiala",
      idempotency_key: newId("test"),
    });

    await expect(
      applyTicketAction(db, res.ticket.id, { action: "resolve" }, "officer-1", true)
    ).rejects.toThrow("Resolution summary is required");
  });

  it("handles idempotency", async () => {
    const key = newId("test");
    const res1 = await createTicket(db, { type: "garbage", district: "Sangrur", idempotency_key: key });
    const res2 = await createTicket(db, { type: "garbage", district: "Sangrur", idempotency_key: key });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(200);
    expect(res1.ticket.id).toBe(res2.ticket.id);
  });
});
