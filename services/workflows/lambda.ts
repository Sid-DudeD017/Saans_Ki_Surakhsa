// Lambda entry points for the steps of complaint-intake.asl.json, as infra/template.yaml wires them.
// Step Functions passes the state in and takes the returned state; a thrown error's name (Transient,
// ComplaintInvalid) is what the definition's Retry and Catch match.
import { commandConfig } from "../command-api/config";
import { newId, pool, s3Client, type IntakeDeps } from "../command-api/deps";
import { escalateOverdue } from "../command-api/escalation";
import { liveFires } from "../command-api/firms";
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
    fires: liveFires(),
  };
  return deps;
}

export const validate = (input: IntakeState) => validateStep(stepDeps(), input);
export const hashEvidence = (input: IntakeState) => hashStep(stepDeps(), input);
export const triage = (input: IntakeState) => triageStep(stepDeps(), input);
export const assign = (input: IntakeState) => assignStep(stepDeps(), input);
export const recordFailure = (input: IntakeState) => failureStep(stepDeps(), input);

/** The one-minute schedule (EscalationFunction): cases past their deadline with no officer action go up. */
export const escalate = async () => ({ escalated: await escalateOverdue(stepDeps()) });
