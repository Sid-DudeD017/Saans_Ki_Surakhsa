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
    const res = await listTickets(db, true, { district: "Mohali" });
    const list = res.tickets;
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].district).toBe("Mohali");
  });

  it("list with citizenId filter", async () => {
    const cId = "cit-" + Date.now();
    await createTicket(db, { type: "garbage", district: "Mohali", reporter_identity: cId, idempotency_key: newId("test") });
    const res = await listTickets(db, false, { citizenId: cId });
    expect(res.tickets.length).toBe(1);
    expect(res.tickets[0].reporter_identity).toBe(cId);
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
    expect(history[0].status).toBe("submitted");
    expect(history[1].status).toBe("under_review");
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

  it("400 validation: note requires reason", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await expect(applyTicketAction(db, res.ticket.id, { action: "note" }, "officer-1", true)).rejects.toThrow("Note text is required");
  });

  it("400 validation: override requires level and reason", async () => {
    const res = await createTicket(db, { type: "garbage", district: "Patiala", idempotency_key: newId("test") });
    await expect(applyTicketAction(db, res.ticket.id, { action: "override_threat", overrideThreatLevel: "critical" }, "officer-1", true)).rejects.toThrow("Override requires level and reason");
    await expect(applyTicketAction(db, res.ticket.id, { action: "override_threat", reason: "because" }, "officer-1", true)).rejects.toThrow("Override requires level and reason");
  });

  it("pagination and threat ordering", async () => {
    const dist = "Pag-" + Date.now();
    // Insert 3 tickets with different threat levels
    const t1 = await createTicket(db, { type: "garbage", district: dist, idempotency_key: newId("test") });
    const t2 = await createTicket(db, { type: "garbage", district: dist, idempotency_key: newId("test") });
    const t3 = await createTicket(db, { type: "garbage", district: dist, idempotency_key: newId("test") });

    await db.query("UPDATE cases SET threat_level = 'low' WHERE id = $1", [t1.ticket.id]);
    await db.query("UPDATE cases SET threat_level = 'critical' WHERE id = $1", [t2.ticket.id]);
    await db.query("UPDATE cases SET threat_level = 'medium' WHERE id = $1", [t3.ticket.id]);

    // Order should be: critical (t2), medium (t3), low (t1)
    // Page 1: limit 2
    const page1 = await listTickets(db, true, { district: dist, limit: 2 });
    expect(page1.tickets.length).toBe(2);
    expect(page1.tickets[0].id).toBe(t2.ticket.id);
    expect(page1.tickets[1].id).toBe(t3.ticket.id);
    expect(page1.next_cursor).not.toBeNull();

    // Page 2: the rest
    const page2 = await listTickets(db, true, { district: dist, limit: 2, cursor: page1.next_cursor! });
    expect(page2.tickets.length).toBe(1);
    expect(page2.tickets[0].id).toBe(t1.ticket.id);
    expect(page2.next_cursor).toBeNull();
  });
});
