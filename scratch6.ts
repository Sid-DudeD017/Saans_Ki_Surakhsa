import { localDeps } from "./services/command-api/localStack.js";
import { createTicket, getTicket, applyTicketAction, getTicketHistory } from "./services/command-api/tickets.js";
import { RateLimiter } from "./services/command-api/rateLimit.js";

async function main() {
  const { db } = await localDeps();
  
  console.log("=== 1. Created Ticket ===");
  const body = { type: "farm_fire", district: "Sangrur", idempotency_key: "test-req-" + Date.now(), reporter_consent: true };
  const res = await createTicket(db, body);
  const ticketId = res.ticket.id;
  console.log(JSON.stringify(res.ticket, null, 2));

  console.log("\n=== 2. Officer resolves ticket ===");
  const resolved = await applyTicketAction(db, ticketId, { action: "resolve", summary: "Fire put out" }, "officer-1", true);
  console.log("Status:", resolved.status);

  console.log("\n=== 3. Citizen GET vs Officer GET ===");
  const citizenView = await getTicket(db, ticketId, false);
  const officerView = await getTicket(db, ticketId, true);
  console.log("Citizen sees internal notes?", 'internal_notes' in citizenView ? citizenView.internal_notes : "undefined");
  console.log("Officer sees internal notes?", officerView.internal_notes !== undefined ? JSON.stringify(officerView.internal_notes) : "undefined");

  console.log("\n=== 4. Resolve without summary ===");
  try {
    await applyTicketAction(db, ticketId, { action: "resolve" }, "officer-1", true);
  } catch (e) {
    console.log("Rejected:", e.message);
  }

  console.log("\n=== 5. Resolve by citizen rejected (403) ===");
  try {
    await applyTicketAction(db, ticketId, { action: "resolve", summary: "Fixed" }, "citizen-1", false);
  } catch (e) {
    console.log(`Rejected (${e.code}):`, e.message);
  }

  console.log("\n=== 6. Citizen confirm moving it to closed ===");
  const confirmed = await applyTicketAction(db, ticketId, { action: "citizen_confirm" }, "citizen-1", false);
  console.log("Status after confirm:", confirmed.status);

  console.log("\n=== 7. Citizen reopen ===");
  const reopened = await applyTicketAction(db, ticketId, { action: "citizen_reopen", reason: "Still burning" }, "citizen-1", false);
  console.log("Status after reopen:", reopened.status);

  console.log("\n=== 8. 429 after exceeding rate limit ===");
  const rl = new RateLimiter(2, 2, 60000); // Max 2 per IP
  console.log("Req 1 allowed?", rl.check("127.0.0.1").allowed);
  console.log("Req 2 allowed?", rl.check("127.0.0.1").allowed);
  const req3 = rl.check("127.0.0.1");
  console.log("Req 3 allowed?", req3.allowed, "- Retry after:", req3.retryAfter);

  console.log("\n=== 9. Status History ===");
  const history = await getTicketHistory(db, ticketId);
  history.forEach(h => {
    console.log(`[${new Date(h.created_at).toISOString()}] ${h.actor} performed ${h.action} -> state: ${h.after_state.status}`);
  });

  process.exit(0);
}

main().catch(console.error);
