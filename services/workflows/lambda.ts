// Lambda entry points for the steps of complaint-intake.asl.json, as infra/template.yaml wires them.
// Step Functions passes the state in and takes the returned state; a thrown error's name (Transient,
// ComplaintInvalid) is what the definition's Retry and Catch match.
import { commandConfig } from "../command-api/config";
import { newId, pool, s3Client, type IntakeDeps } from "../command-api/deps";
import { InMemoryIdempotencyStore, SmsSender } from "../command-api/sms";
import { assign as assignStep, hashEvidence as hashStep, recordFailure as failureStep, triage as triageStep, validate as validateStep, type IntakeState } from "./steps";

let deps: IntakeDeps | null = null;

function stepDeps(): IntakeDeps {
  if (deps) return deps;
  const config = commandConfig();
  deps = {
    db: pool(config),
    s3: s3Client(config),
    config,
    now: () => new Date(),
    newId,
    startWorkflow: async () => {
      throw new Error("a step doesn't start workflows");
    },
    notifications: new SmsSender({
      backend: process.env.SAANS_SMS_BACKEND === "aws" ? "aws" : "outbox",
      region: process.env.SAANS_SMS_REGION || process.env.AWS_REGION,
      originationIdentity: process.env.SAANS_SMS_SENDER_ID,
      entityId: process.env.SAANS_SMS_ENTITY_ID,
      templateIdAssignment: process.env.SAANS_SMS_TEMPLATE_ASSIGNMENT,
      templateIdActionTaken: process.env.SAANS_SMS_TEMPLATE_ACTION_TAKEN,
      dlqUrl: process.env.SAANS_DLQ_URL,
    }, new InMemoryIdempotencyStore()),
  };
  return deps;
}

export const validate = (input: IntakeState) => validateStep(stepDeps(), input);
export const hashEvidence = (input: IntakeState) => hashStep(stepDeps(), input);
export const triage = (input: IntakeState) => triageStep(stepDeps(), input);
export const assign = (input: IntakeState) => assignStep(stepDeps(), input);
export const recordFailure = (input: IntakeState) => failureStep(stepDeps(), input);
