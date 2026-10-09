import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from "@aws-sdk/client-pinpoint-sms-voice-v2";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import * as fs from "fs";
import * as path from "path";

export interface IdempotencyStore {
    has(key: string): Promise<boolean>;
    add(key: string): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
    private store = new Set<string>();
    async has(key: string) { return this.store.has(key); }
    async add(key: string) { this.store.add(key); }
    clear() { this.store.clear(); }
}

// Contract for production use. Implementation must be backed by durable storage (e.g., DynamoDB).
// Do not claim exactly-once production behavior until backed by durable storage.
export interface DurableIdempotencyStore extends IdempotencyStore {}

export interface NotificationSender {
    sendAssignment(phone: string, caseId: string, idempotencyKey: string): Promise<{ success: boolean; dlqFailed?: boolean }>;
    sendActionTaken(phone: string, caseId: string, actionText: string, idempotencyKey: string): Promise<{ success: boolean; dlqFailed?: boolean }>;
}

export type SmsBackend = "aws" | "outbox";

export interface SmsConfig {
    backend: SmsBackend;
    region?: string;
    originationIdentity?: string;
    entityId?: string;
    templateIdAssignment?: string;
    templateIdActionTaken?: string;
    dlqUrl?: string;
}

let testAwsClient: any;
let testSqsClient: any;

export const setTestSmsClient = (c: any) => { testAwsClient = c; };
export const setTestSqsClient = (c: any) => { testSqsClient = c; };

/** Fixed template text. Must exactly match registered DLT templates. */
export const getAssignmentTemplateText = (caseId: string) => `You have been assigned case ${caseId}`;
/** Fixed template text. Must exactly match registered DLT templates. */
export const getActionTakenTemplateText = (caseId: string, actionText: string) => `Action taken on case ${caseId}: ${actionText}`;

export class SmsSender implements NotificationSender {
    private client?: PinpointSMSVoiceV2Client;
    private sqsClient?: SQSClient;
    private config: SmsConfig;
    private idempotencyStore: IdempotencyStore;

    constructor(config: SmsConfig, store: IdempotencyStore) {
        this.config = config;
        this.idempotencyStore = store;
        if (config.backend === "aws") {
            this.client = testAwsClient || new PinpointSMSVoiceV2Client({ region: config.region });
            this.sqsClient = testSqsClient || new SQSClient({ region: config.region });
        }
    }

    private async send(phone: string, message: string, templateId: string | undefined, notificationType: string, caseId: string, idempotencyKey: string): Promise<{ success: boolean; dlqFailed?: boolean }> {
        if (!idempotencyKey) return { success: false };
        if (await this.idempotencyStore.has(idempotencyKey)) return { success: true };

        if (this.config.backend === "outbox") {
            const outboxPath = process.env.SAANS_SMS_OUTBOX || ".outbox/sms.jsonl";
            fs.mkdirSync(path.dirname(outboxPath), { recursive: true });
            
            // The outbox fallback must retain enough destination information to be actionable.
            // Do not log it. Document that the outbox file contains sensitive data and must not be committed.
            fs.appendFileSync(outboxPath, JSON.stringify({ phone, message }) + "\n");
            await this.idempotencyStore.add(idempotencyKey);
            return { success: true };
        }

        if (!this.config.region || !this.client || !this.config.originationIdentity || !this.config.entityId || !templateId) {
            throw new Error("Missing required AWS configuration (region, origination identity, Entity ID, or Template ID)");
        }

        try {
            await this.client.send(new SendTextMessageCommand({
                DestinationPhoneNumber: phone,
                OriginationIdentity: this.config.originationIdentity,
                MessageBody: message,
                MessageType: "TRANSACTIONAL",
                DestinationCountryParameters: {
                    IN_ENTITY_ID: this.config.entityId,
                    IN_TEMPLATE_ID: templateId
                }
            }));
            await this.idempotencyStore.add(idempotencyKey);
            return { success: true };
        } catch (e: any) {
            // Send to DLQ without raw text, phone numbers, or bodies. Store only notification type, case ID, idempotency key, safe error code.
            if (this.config.dlqUrl && this.sqsClient) {
                try {
                    await this.sqsClient.send(new SendMessageCommand({
                        QueueUrl: this.config.dlqUrl,
                        MessageBody: JSON.stringify({
                            notificationType,
                            caseId,
                            idempotencyKey,
                            errorCode: e.name || "UnknownError"
                        })
                    }));
                } catch (dlqError) {
                    return { success: false, dlqFailed: true };
                }
            }
            return { success: false, dlqFailed: false };
        }
    }

    async sendAssignment(phone: string, caseId: string, idempotencyKey: string) {
        const msg = getAssignmentTemplateText(caseId);
        return await this.send(phone, msg, this.config.templateIdAssignment, "assignment", caseId, idempotencyKey);
    }

    async sendActionTaken(phone: string, caseId: string, actionText: string, idempotencyKey: string) {
        const msg = getActionTakenTemplateText(caseId, actionText);
        return await this.send(phone, msg, this.config.templateIdActionTaken, "action-taken", caseId, idempotencyKey);
    }
}
