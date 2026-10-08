// Runs an Amazon States Language definition in-process, for the local stack and tests: the subset
// complaint-intake.asl.json uses (Task, Pass, Succeed, Fail; Retry and Catch on error names; ResultPath).
// On AWS, Step Functions runs the same file.

export interface StepError {
  Error: string;
  Cause: string;
}

type State =
  | { Type: "Task"; Resource: string; Next?: string; End?: boolean; ResultPath?: string | null; Retry?: Retrier[]; Catch?: Catcher[] }
  | { Type: "Pass"; Next?: string; End?: boolean; Result?: unknown; ResultPath?: string | null }
  | { Type: "Succeed" }
  | { Type: "Fail"; Error?: string; Cause?: string };

interface Retrier {
  ErrorEquals: string[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
}

interface Catcher {
  ErrorEquals: string[];
  Next: string;
  ResultPath?: string | null;
}

export interface Definition {
  StartAt: string;
  States: Record<string, State>;
}

export type Task = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface RunEvent {
  state: string;
  event: "entered" | "succeeded" | "retrying" | "caught" | "failed";
  detail?: unknown;
}

export interface RunOptions {
  onEvent?: (e: RunEvent) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
}

export type RunResult =
  | { status: "SUCCEEDED"; output: Record<string, unknown> }
  | { status: "FAILED"; error: string; cause: string; output: Record<string, unknown> };

/** "${ValidateFunctionArn}" names the task "Validate". */
export function taskName(resource: string) {
  const m = resource.match(/^\$\{(\w+)FunctionArn\}$/);
  if (!m) throw new Error(`can't run resource ${resource} locally`);
  return m[1];
}

function errorOf(e: unknown): StepError {
  if (e instanceof Error) return { Error: e.name || "Error", Cause: e.message };
  return { Error: "Error", Cause: String(e) };
}

function matches(names: string[], error: string) {
  return names.includes(error) || names.includes("States.ALL") || (names.includes("States.TaskFailed") && !error.startsWith("States."));
}

function place(input: Record<string, unknown>, path: string | null | undefined, result: unknown) {
  if (path === null) return input;
  if (path === undefined || path === "$") return result as Record<string, unknown>;
  const m = path.match(/^\$\.(\w+)$/);
  if (!m) throw new Error(`ResultPath ${path} isn't supported locally`);
  return { ...input, [m[1]]: result };
}

export async function runStateMachine(
  definition: Definition,
  tasks: Record<string, Task>,
  input: Record<string, unknown>,
  { onEvent = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: RunOptions = {},
): Promise<RunResult> {
  let name = definition.StartAt;
  let data = input;
  for (let steps = 0; steps < 100; steps++) {
    const state = definition.States[name];
    if (!state) throw new Error(`no state ${name}`);
    await onEvent({ state: name, event: "entered" });

    if (state.Type === "Succeed") return { status: "SUCCEEDED", output: data };
    if (state.Type === "Fail") {
      const error = state.Error ?? "States.Fail";
      await onEvent({ state: name, event: "failed", detail: { error, cause: state.Cause } });
      return { status: "FAILED", error, cause: state.Cause ?? "", output: data };
    }

    let caughtNext: string | null = null;
    if (state.Type === "Pass") {
      data = place(data, state.ResultPath, state.Result ?? data);
    } else {
      const task = tasks[taskName(state.Resource)];
      if (!task) throw new Error(`no task for ${state.Resource}`);
      for (let attempt = 0; ; ) {
        try {
          data = place(data, state.ResultPath, await task(data));
          await onEvent({ state: name, event: "succeeded" });
          break;
        } catch (e) {
          const error = errorOf(e);
          const retrier = state.Retry?.find((r) => matches(r.ErrorEquals, error.Error));
          if (retrier && attempt < (retrier.MaxAttempts ?? 3)) {
            const wait = (retrier.IntervalSeconds ?? 1) * 1000 * (retrier.BackoffRate ?? 2) ** attempt;
            attempt++;
            await onEvent({ state: name, event: "retrying", detail: { ...error, attempt } });
            await sleep(wait);
            continue;
          }
          const catcher = state.Catch?.find((c) => matches(c.ErrorEquals, error.Error));
          if (!catcher) {
            await onEvent({ state: name, event: "failed", detail: error });
            return { status: "FAILED", error: error.Error, cause: error.Cause, output: data };
          }
          await onEvent({ state: name, event: "caught", detail: error });
          data = place(data, catcher.ResultPath, error);
          caughtNext = catcher.Next;
          break;
        }
      }
    }

    if (caughtNext) {
      name = caughtNext;
    } else if (state.End) {
      return { status: "SUCCEEDED", output: data };
    } else if (state.Next) {
      name = state.Next;
    } else {
      throw new Error(`state ${name} has neither Next nor End`);
    }
  }
  throw new Error("the state machine ran more than 100 states");
}
