// SMS when a case is assigned and when an officer acts (P4, G7), through #26's SmsSender (sms.ts): AWS End
// User Messaging with DLT templates, or the outbox file. Who gets them: one number per district, from the
// environment (SAANS_SMS_TO_SANGRUR, SAANS_SMS_TO_PATIALA, SAANS_SMS_TO_UNASSIGNED), never from git.
// Command has no farmer or reporter numbers; Kisan texts farmers itself. A message that fails is logged
// (and dead-lettered by SmsSender) but never fails the case.
import type { Db } from "./deps";
import { SmsSender, type IdempotencyStore, type NotificationSender, type SmsBackend } from "./sms";

export interface Notifier {
  caseAssigned(c: { caseId: string; district: string | null }): Promise<void>;
  actionTaken(c: { caseId: string; district: string | null; action: string; decisionId: string }): Promise<void>;
}

/** Durable "already sent" keys in PostGIS (notifications_sent), so a retried step never texts twice. */
export function pgIdempotencyStore(db: Db): IdempotencyStore {
  return {
    has: async (key) => (await db.query("SELECT 1 FROM notifications_sent WHERE key = $1", [key])).rows.length > 0,
    add: async (key) => {
      await db.query("INSERT INTO notifications_sent (key) VALUES ($1) ON CONFLICT (key) DO NOTHING", [key]);
    },
  };
}

// The words that fill the action-taken DLT template's variable: fixed, never the officer's free text.
const ACTION_WORDS: Record<string, string> = {
  APPROVE: "machine sent",
  CHANGE: "a different machine sent",
  RECORD_ACTION_TAKEN: "action recorded",
};

export function smsNotifier(sender: NotificationSender, recipients: Record<string, string>): Notifier {
  const to = (district: string | null) => recipients[district ?? "unassigned"] ?? recipients.unassigned;
  const attempt = async (what: string, send: () => Promise<{ success: boolean }>) => {
    try {
      const { success } = await send();
      if (!success) console.warn(`SMS for ${what} was not sent`);
    } catch (e) {
      console.warn(`SMS for ${what} failed: ${(e as Error).name}`);
    }
  };
  return {
    async caseAssigned({ caseId, district }) {
      const phone = to(district);
      if (phone) await attempt(`case ${caseId}`, () => sender.sendAssignment(phone, caseId, `assignment:${caseId}`));
    },
    async actionTaken({ caseId, district, action, decisionId }) {
      const phone = to(district);
      const words = ACTION_WORDS[action];
      if (phone && words) await attempt(`decision ${decisionId}`, () => sender.sendActionTaken(phone, caseId, words, `action:${decisionId}`));
    },
  };
}

/** The notifier the environment asks for, or undefined when no recipient number is set. */
export function notifierFromEnv(db: Db, env: Record<string, string | undefined> = process.env): Notifier | undefined {
  const recipients = Object.fromEntries(
    [
      ["Sangrur", env.SAANS_SMS_TO_SANGRUR],
      ["Patiala", env.SAANS_SMS_TO_PATIALA],
      ["unassigned", env.SAANS_SMS_TO_UNASSIGNED],
    ].filter(([, phone]) => phone),
  ) as Record<string, string>;
  if (!Object.keys(recipients).length) return undefined;
  const sender = new SmsSender(
    {
      backend: (env.SAANS_SMS_BACKEND === "aws" ? "aws" : "outbox") as SmsBackend,
      region: env.SAANS_SMS_REGION,
      originationIdentity: env.SAANS_SMS_SENDER_ID,
      entityId: env.SAANS_SMS_ENTITY_ID,
      templateIdAssignment: env.SAANS_SMS_TEMPLATE_ASSIGNMENT,
      templateIdActionTaken: env.SAANS_SMS_TEMPLATE_ACTION_TAKEN,
      dlqUrl: env.SAANS_SMS_DLQ_URL || env.SAANS_DLQ_URL,
    },
    pgIdempotencyStore(db),
  );
  return smsNotifier(sender, recipients);
}
