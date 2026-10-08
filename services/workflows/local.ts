// Starts complaint-intake.asl.json in-process, for the local stack: the same definition and steps that
// Step Functions runs on AWS. Every state entered, retried, caught or failed is written to workflow_events.
import type { IntakeDeps } from "../command-api/deps";
import definition from "./complaint-intake.asl.json";
import { runStateMachine, type Definition, type RunResult, type Task } from "./runner";
import { STEPS, type IntakeState } from "./steps";

export function intakeTasks(deps: IntakeDeps): Record<string, Task> {
  return Object.fromEntries(
    Object.entries(STEPS).map(([name, step]) => [name, (input) => step(deps, input as IntakeState)]),
  );
}

export async function runIntake(deps: IntakeDeps, complaintId: string, sleep?: (ms: number) => Promise<void>): Promise<RunResult> {
  const executionId = deps.newId("exec");
  return runStateMachine(definition as Definition, intakeTasks(deps), { complaintId }, {
    sleep,
    onEvent: async ({ state, event, detail }) => {
      await deps.db.query(
        "INSERT INTO workflow_events (execution_id, complaint_id, state, event, detail, at) VALUES ($1, $2, $3, $4, $5, $6)",
        [executionId, complaintId, state, event, detail === undefined ? null : JSON.stringify(detail), deps.now()],
      );
    },
  });
}
