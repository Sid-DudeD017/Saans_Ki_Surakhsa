// SMS on assignment and action: the district's number, fixed words (never the officer's reason), keys that
// stop repeats, and no failure ever reaching the case.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Db } from "./deps";
import { notifierFromEnv, smsNotifier } from "./notify";
import type { NotificationSender } from "./sms";

function recorder(fail = false) {
  const sent: string[][] = [];
  const sender: NotificationSender = {
    sendAssignment: async (phone, caseId, key) => {
      if (fail) throw new Error("throttled");
      sent.push(["assignment", phone, caseId, key]);
      return { success: true };
    },
    sendActionTaken: async (phone, caseId, text, key) => {
      sent.push(["action", phone, caseId, text, key]);
      return { success: true };
    },
  };
  return { sent, sender };
}

/** A Db that keeps notifications_sent in memory. */
function memoryDb(): Db {
  const keys = new Set<string>();
  return {
    query: async (text: string, values?: unknown[]) => {
      const key = String(values?.[0]);
      if (text.startsWith("SELECT")) return { rows: keys.has(key) ? [{}] : [], rowCount: keys.has(key) ? 1 : 0 } as never;
      keys.add(key);
      return { rows: [], rowCount: 1 } as never;
    },
  };
}

describe("smsNotifier", () => {
  const numbers = { Sangrur: "+910000000001", unassigned: "+910000000009" };

  it("texts the case's district, keyed by case and by decision", async () => {
    const { sent, sender } = recorder();
    const n = smsNotifier(sender, numbers);
    await n.caseAssigned({ caseId: "case-1", district: "Sangrur" });
    await n.actionTaken({ caseId: "case-1", district: "Sangrur", action: "APPROVE", decisionId: "decision-7" });
    expect(sent).toEqual([
      ["assignment", "+910000000001", "case-1", "assignment:case-1"],
      ["action", "+910000000001", "case-1", "machine sent", "action:decision-7"],
    ]);
  });

  it("falls back to the unassigned number, and texts nothing for actions that aren't help", async () => {
    const { sent, sender } = recorder();
    const n = smsNotifier(sender, numbers);
    await n.caseAssigned({ caseId: "case-2", district: "Patiala" });
    await n.actionTaken({ caseId: "case-2", district: "Patiala", action: "MARK_IN_FIELD", decisionId: "d" });
    await n.actionTaken({ caseId: "case-2", district: "Patiala", action: "CLOSE", decisionId: "d2" });
    expect(sent).toEqual([["assignment", "+910000000009", "case-2", "assignment:case-2"]]);
  });

  it("swallows a failed send", async () => {
    const { sender } = recorder(true);
    await expect(smsNotifier(sender, numbers).caseAssigned({ caseId: "case-3", district: "Sangrur" })).resolves.toBeUndefined();
  });
});

describe("notifierFromEnv", () => {
  it("is off without a recipient number", () => {
    expect(notifierFromEnv(memoryDb(), { SAANS_SMS_BACKEND: "outbox" })).toBeUndefined();
  });

  it("writes to the outbox once per key", async () => {
    const outbox = join(mkdtempSync(join(tmpdir(), "saans-sms-")), "sms.jsonl");
    process.env.SAANS_SMS_OUTBOX = outbox;
    const n = notifierFromEnv(memoryDb(), { SAANS_SMS_BACKEND: "outbox", SAANS_SMS_TO_SANGRUR: "+910000000001" })!;
    await n.caseAssigned({ caseId: "case-9", district: "Sangrur" });
    await n.caseAssigned({ caseId: "case-9", district: "Sangrur" }); // a retried Assign step
    const lines = readFileSync(outbox, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual([{ phone: "+910000000001", message: "You have been assigned case case-9" }]);
    delete process.env.SAANS_SMS_OUTBOX;
  });
});
