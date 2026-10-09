import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SmsSender, setTestSmsClient, setTestSqsClient, InMemoryIdempotencyStore, IdempotencyStore } from "./sms";
import * as fs from "fs";
import * as path from "path";

vi.mock("@aws-sdk/client-pinpoint-sms-voice-v2", () => ({
  PinpointSMSVoiceV2Client: class {},
  SendTextMessageCommand: class {
    constructor(public input: any) {}
  }
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {},
  SendMessageCommand: class {
    constructor(public input: any) {}
  }
}));

describe("SMS Tests", () => {
  const outboxPath = ".outbox/sms-test.jsonl";
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
    process.env.SAANS_SMS_OUTBOX = outboxPath;
    if (fs.existsSync(outboxPath)) {
      fs.unlinkSync(outboxPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(outboxPath)) {
      fs.unlinkSync(outboxPath);
    }
  });

  const mockSmsClient = (shouldThrow = false, assertInput?: (input: any) => void) => {
    const mock = {
      send: async (cmd: any) => {
        if (assertInput) assertInput(cmd.input);
        if (shouldThrow) {
          const e = new Error("AWS Error");
          e.name = "ThrottlingException";
          throw e;
        }
        return {};
      }
    };
    setTestSmsClient(mock);
    return mock;
  };

  const mockSqsClient = (shouldThrow = false, assertInput?: (input: any) => void) => {
    const mock = {
      send: async (cmd: any) => {
        if (assertInput) assertInput(cmd.input);
        if (shouldThrow) throw new Error("DLQ Error");
        return {};
      }
    };
    setTestSqsClient(mock);
    return mock;
  };

  it("configurable outbox success (retains info)", async () => {
    const sender = new SmsSender({ backend: "outbox" }, store);
    await sender.sendAssignment("+1234567890", "case-123", "idemp-1");
    
    expect(fs.existsSync(outboxPath)).toBe(true);
    const content = fs.readFileSync(outboxPath, "utf8");
    // Should retain enough info but not logged. Outbox file is sensitive.
    expect(content).toContain("+1234567890");
    expect(content).toContain("You have been assigned case case-123");
  });

  it("durable-store interface behavior and duplicate suppression", async () => {
    let count = 0;
    mockSmsClient(false, () => { count++; });
    
    let dbHas = false;
    let dbAdd = false;
    const durableStore: IdempotencyStore = {
        has: async (k) => dbHas,
        add: async (k) => { dbAdd = true; }
    };
    
    const sender = new SmsSender({ 
      backend: "aws", region: "r", originationIdentity: "id", entityId: "e1", templateIdAssignment: "t1" 
    }, durableStore);
    
    await sender.sendAssignment("+123", "c1", "k1");
    expect(count).toBe(1);
    expect(dbAdd).toBe(true);

    dbHas = true;
    await sender.sendAssignment("+123", "c1", "k1");
    expect(count).toBe(1); // duplicate suppressed
  });

  it("missing configuration throws error", async () => {
    const sender = new SmsSender({ backend: "aws", region: "r" }, store);
    await expect(sender.sendAssignment("+123", "c1", "k1")).rejects.toThrow("Missing required AWS configuration");
  });

  it("assignment template and action template", async () => {
    let sentAssign = false;
    let sentAction = false;
    mockSmsClient(false, (input) => {
      if (input.MessageBody.includes("assigned case c1")) sentAssign = true;
      if (input.MessageBody.includes("Action taken on case c1: res")) sentAction = true;
    });
    
    const sender = new SmsSender({
      backend: "aws", region: "us", originationIdentity: "id", entityId: "ent",
      templateIdAssignment: "t1", templateIdActionTaken: "t2"
    }, store);

    await sender.sendAssignment("+123", "c1", "k1");
    await sender.sendActionTaken("+123", "c1", "res", "k2");
    
    expect(sentAssign).toBe(true);
    expect(sentAction).toBe(true);
  });

  it("AWS success", async () => {
    let called = false;
    mockSmsClient(false, (input) => {
      expect(input.DestinationPhoneNumber).toBe("+123");
      expect(input.MessageType).toBe("TRANSACTIONAL");
      called = true;
    });
    const sender = new SmsSender({ backend: "aws", region: "r", originationIdentity: "i", entityId: "e", templateIdAssignment: "t" }, store);
    await sender.sendAssignment("+123", "c1", "k1");
    expect(called).toBe(true);
  });

  it("SMS failure to DLQ with redacted payload", async () => {
    mockSmsClient(true);
    let dlqCalled = false;
    mockSqsClient(false, (input) => {
      expect(input.QueueUrl).toBe("dlq-url");
      const body = JSON.parse(input.MessageBody);
      // redacted: only safe fields
      expect(body.phone).toBeUndefined();
      expect(body.message).toBeUndefined();
      expect(body.notificationType).toBe("assignment");
      expect(body.caseId).toBe("c1");
      expect(body.idempotencyKey).toBe("k1");
      expect(body.errorCode).toBe("ThrottlingException");
      dlqCalled = true;
    });
    
    const sender = new SmsSender({ backend: "aws", region: "r", originationIdentity: "i", entityId: "e", templateIdAssignment: "t", dlqUrl: "dlq-url" }, store);
    const result = await sender.sendAssignment("+123", "c1", "k1");
    expect(dlqCalled).toBe(true);
    expect(result.success).toBe(false);
    expect(result.dlqFailed).toBe(false);
  });

  it("DLQ failure reporting", async () => {
    mockSmsClient(true);
    mockSqsClient(true); // DLQ delivery fails
    const sender = new SmsSender({ backend: "aws", region: "r", originationIdentity: "i", entityId: "e", templateIdAssignment: "t", dlqUrl: "dlq-url" }, store);
    const result = await sender.sendAssignment("+123", "c1", "k1");
    
    expect(result.success).toBe(false);
    expect(result.dlqFailed).toBe(true); // Structured failure recorded
  });
});
