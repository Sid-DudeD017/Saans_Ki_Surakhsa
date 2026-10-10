import { describe, expect, it, beforeAll } from "vitest";
import { createTicket, getTicket, listTickets, applyTicketAction, getTicketHistory } from "./tickets";
import { pool, newId, migrate } from "./deps";
import { commandConfig } from "./config";

describe("tickets API", () => {
  const db = pool(commandConfig());

  beforeAll(async () => {
    await migrate(db);
  });

  it("create ticket with consent", async () => {
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
  });

  it("get ticket (citizen view vs officer view)", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Sangrur", idempotency_key: newId("test") });
    // Get as officer (sees internal)
    const officerView = await getTicket(db, res.ticket.id, true);
    expect((officerView as any).internal_notes).toBeDefined();

    // Get as citizen (no internal)
    const citizenView = await getTicket(db, res.ticket.id, false);
    expect((citizenView as any).internal_notes).toBeUndefined();
  });

  it("list with filters", async () => {
    await createTicket(db, { type: "garbage", district: "Mohali", idempotency_key: newId("test") });
    const list = await listTickets(db, true, { district: "Mohali" });
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].district).toBe("Mohali");
  });

  it("accept", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const accepted = await applyTicketAction(db, res.ticket.id, { action: "accept" }, "officer-1", true);
    expect(accepted.status).toBe("in_progress");
  });

  it("note", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const noted = await applyTicketAction(db, res.ticket.id, { action: "note", reason: "Taking a look" }, "officer-1", true);
    expect(noted.status).toBe("submitted"); // status shouldn't change
  });

  it("request info", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const reqInfo = await applyTicketAction(db, res.ticket.id, { action: "request_info", reason: "Need photo" }, "officer-1", true);
    expect(reqInfo.status).toBe("awaiting_information");
  });

  it("upload evidence", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const up = await applyTicketAction(db, res.ticket.id, { action: "upload_evidence", evidence: "photo.jpg" }, "citizen-1", false);
    expect(up.status).toBe("submitted");
  });

  it("reassign", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const reassigned = await applyTicketAction(db, res.ticket.id, { action: "reassign", assignee: "officer-2" }, "officer-1", true);
    expect(reassigned.status).toBe("submitted");
  });

  it("update status", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const updated = await applyTicketAction(db, res.ticket.id, { action: "update_status", status: "resolved" }, "officer-1", true);
    expect(updated.status).toBe("resolved");
  });

  it("resolve", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await applyTicketAction(db, res.ticket.id, { action: "update_status", status: "in_progress" }, "officer-1", true);
    const resolved = await applyTicketAction(db, res.ticket.id, { action: "resolve", summary: "Cleaned up" }, "officer-1", true);
    expect(resolved.status).toBe("resolved");
  });

  it("citizen confirm", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await applyTicketAction(db, res.ticket.id, { action: "update_status", status: "in_progress" }, "officer-1", true);
    await applyTicketAction(db, res.ticket.id, { action: "resolve", summary: "done" }, "officer-1", true);
    const confirmed = await applyTicketAction(db, res.ticket.id, { action: "citizen_confirm" }, "citizen-1", false);
    expect(confirmed.status).toBe("closed");
  });

  it("full lifecycle with history", async () => {
    // create -> accept -> request_info -> update_status(in_progress) -> resolve -> citizen_confirm
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    const id = res.ticket.id;
    await applyTicketAction(db, id, { action: "update_status", status: "under_review" }, "officer-1", true);
    await applyTicketAction(db, id, { action: "accept" }, "officer-1", true);
    await applyTicketAction(db, id, { action: "request_info", reason: "need more" }, "officer-1", true);
    await applyTicketAction(db, id, { action: "update_status", status: "in_progress" }, "officer-1", true);
    await applyTicketAction(db, id, { action: "resolve", summary: "done" }, "officer-1", true);
    
    // citizen reopen
    const reopened = await applyTicketAction(db, id, { action: "citizen_reopen", reason: "not done" }, "citizen-1", false);
    expect(reopened.status).toBe("reopened");

    // officer reviews
    const reviewed = await applyTicketAction(db, id, { action: "update_status", status: "under_review" }, "officer-1", true);
    expect(reviewed.status).toBe("under_review");

    await applyTicketAction(db, id, { action: "resolve", summary: "done for real" }, "officer-1", true);
    const closed = await applyTicketAction(db, id, { action: "citizen_confirm" }, "citizen-1", false);
    expect(closed.status).toBe("closed");

    const history = await getTicketHistory(db, res.ticket.id);
    expect(history.length).toBeGreaterThan(5);
    // wire formats in history
    const afterState = typeof history[0].after_state === "string" ? JSON.parse(history[0].after_state) : history[0].after_state;
    expect(afterState.status).toBe("under_review");
  });

  it("400 validation", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await expect(applyTicketAction(db, res.ticket.id, { action: "resolve" }, "officer-1", true)).rejects.toThrow("Resolution summary is required");
  });

  it("403 resolve by a citizen rejected", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await expect(applyTicketAction(db, res.ticket.id, { action: "resolve", summary: "done" }, "citizen-1", false)).rejects.toThrow("Action resolve is restricted to officers");
  });
  
  it("403 citizen confirm by officer rejected", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await applyTicketAction(db, res.ticket.id, { action: "update_status", status: "in_progress" }, "officer-1", true);
    await applyTicketAction(db, res.ticket.id, { action: "resolve", summary: "done" }, "officer-1", true);
    await expect(applyTicketAction(db, res.ticket.id, { action: "citizen_confirm" }, "officer-1", true)).rejects.toThrow("Action citizen_confirm is restricted to citizens");
  });

  it("404 ticket not found", async () => {
    await expect(applyTicketAction(db, "fake-id", { action: "accept" }, "officer-1", true)).rejects.toThrow("Ticket not found");
  });

  it("409 bad transition", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await expect(applyTicketAction(db, res.ticket.id, { action: "citizen_confirm" }, "citizen-1", false)).rejects.toThrow("Cannot confirm a ticket that is not resolved");
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
