// The local runner follows complaint-intake.asl.json as Step Functions would: retries Transient
// errors, sends everything else to RecordFailure, and ends in Failed.
import { describe, expect, it } from "vitest";

import definition from "./complaint-intake.asl.json";
import { runStateMachine, taskName, type Definition, type RunEvent, type Task } from "./runner";
import { STEPS, Transient } from "./steps";

const intake = definition as Definition;
const noSleep = async () => {};

function tasks(overrides: Partial<Record<string, Task>> = {}) {
  const passing: Record<string, Task> = Object.fromEntries(
    Object.keys(STEPS).map((name) => [name, async (input: Record<string, unknown>) => ({ ...input, [name]: true })]),
  );
  return { ...passing, ...overrides } as Record<string, Task>;
}

async function run(t: Record<string, Task>) {
  const events: RunEvent[] = [];
  const result = await runStateMachine(intake, t, { complaintId: "complaint-1" }, { sleep: noSleep, onEvent: (e) => { events.push(e); } });
  return { result, events };
}

describe("complaint-intake.asl.json", () => {
  it("runs validate, hash evidence, triage, assign in order", async () => {
    const { result, events } = await run(tasks());
    expect(result.status).toBe("SUCCEEDED");
    expect(events.filter((e) => e.event === "succeeded").map((e) => e.state)).toEqual(["Validate", "HashEvidence", "Triage", "Assign"]);
    expect(result.output).toMatchObject({ complaintId: "complaint-1", Validate: true, Assign: true });
  });

  it("names a task for every step and a step for every task", () => {
    const resources = Object.values(intake.States).flatMap((s) => ("Resource" in s ? [taskName(s.Resource)] : []));
    expect(resources.sort()).toEqual(Object.keys(STEPS).sort());
  });

  it("retries a Transient error and carries on", async () => {
    let calls = 0;
    const { result, events } = await run(tasks({
      HashEvidence: async (input) => {
        if (++calls < 3) throw new Transient("S3 timed out");
        return input;
      },
    }));
    expect(result.status).toBe("SUCCEEDED");
    expect(events.filter((e) => e.event === "retrying")).toHaveLength(2);
  });

  it("gives up after three retries and records the failure", async () => {
    let recorded: unknown;
    const { result } = await run(tasks({
      Triage: async () => { throw new Transient("database down"); },
      RecordFailure: async (input) => { recorded = input.error; return input; },
    }));
    expect(result).toMatchObject({ status: "FAILED", error: "ComplaintNotProcessed" });
    expect(recorded).toEqual({ Error: "Transient", Cause: "database down" });
  });

  it("doesn't retry other errors", async () => {
    let calls = 0;
    const { result, events } = await run(tasks({
      Validate: async () => { calls++; throw new TypeError("bad complaint"); },
    }));
    expect(calls).toBe(1);
    expect(result.status).toBe("FAILED");
    expect(events.map((e) => `${e.state} ${e.event}`)).toEqual([
      "Validate entered", "Validate caught", "RecordFailure entered", "RecordFailure succeeded", "Failed entered", "Failed failed",
    ]);
  });
});
