import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { awsDeps } from "./lambda";
import { describe, expect, it, beforeEach, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-sfn", () => {
  return {
    SFNClient: class {
      send = sendMock;
    },
    StartExecutionCommand: class {
      constructor(args: any) {
        Object.assign(this, args);
      }
    }
  };
});

describe("lambda startWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SAANS_STATE_MACHINE_ARN = "arn:aws:states:region:account:stateMachine:IntakeStateMachine";
    vi.resetModules();
  });

  it("StartExecution receives the correct ARN, name and JSON input", async () => {
    const deps = awsDeps();
    await deps.startWorkflow("comp-123");
    
    expect(sendMock).toHaveBeenCalledTimes(1);
    const args = sendMock.mock.calls[0][0];
    expect(args.stateMachineArn).toBe("arn:aws:states:region:account:stateMachine:IntakeStateMachine");
    expect(args.name).toBe("comp-123");
    expect(args.input).toBe(JSON.stringify({ complaintId: "comp-123" }));
  });

  it("ExecutionAlreadyExists is accepted", async () => {
    const deps = awsDeps();
    sendMock.mockRejectedValueOnce({ name: "ExecutionAlreadyExists" });
    
    await expect(deps.startWorkflow("comp-123")).resolves.toBeUndefined();
  });

  it("Other AWS failures are rethrown", async () => {
    const deps = awsDeps();
    sendMock.mockRejectedValueOnce(new Error("SomeOtherError"));
    
    await expect(deps.startWorkflow("comp-123")).rejects.toThrow("SomeOtherError");
  });

  it("fails safely if SAANS_STATE_MACHINE_ARN is missing", async () => {
    delete process.env.SAANS_STATE_MACHINE_ARN;
    const deps = awsDeps();
    await expect(deps.startWorkflow("comp-123")).rejects.toThrow("SAANS_STATE_MACHINE_ARN is missing");
  });
});
