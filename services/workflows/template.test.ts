// infra/template.yaml wires the same handlers and state machine that run locally. (No SAM CLI in CI
// yet; G7 adds `sam validate`.)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import * as apiHandlers from "../command-api/lambda";
import * as stepHandlers from "./lambda";

const root = join(__dirname, "../..");
const template = YAML.parse(readFileSync(join(root, "infra/template.yaml"), "utf8"));
const asl = readFileSync(join(root, "services/workflows/complaint-intake.asl.json"), "utf8");
const resources: Record<string, { Type: string; Properties: Record<string, unknown> }> = template.Resources;
const modules: Record<string, Record<string, unknown>> = {
  "services/command-api/lambda": apiHandlers,
  "services/workflows/lambda": stepHandlers,
};

describe("infra/template.yaml", () => {
  it("every function's handler exists", () => {
    const functions = Object.entries(resources).filter(([, r]) => r.Type === "AWS::Serverless::Function");
    expect(functions.length).toBe(7);
    for (const [name, fn] of functions) {
      const handler = fn.Properties.Handler as string;
      const dot = handler.lastIndexOf(".");
      expect(typeof modules[handler.slice(0, dot)]?.[handler.slice(dot + 1)], `${name}: ${handler}`).toBe("function");
    }
  });

  it("deploys complaint-intake.asl.json with every placeholder filled", () => {
    const machine = resources.IntakeStateMachine.Properties;
    expect(machine.DefinitionUri).toBe("../services/workflows/complaint-intake.asl.json");
    const placeholders = [...new Set([...asl.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]))].sort();
    expect(Object.keys(machine.DefinitionSubstitutions as object).sort()).toEqual(placeholders);
  });

  it("routes the two intake paths", () => {
    const paths = Object.values(resources).flatMap((r) =>
      Object.values((r.Properties.Events ?? {}) as Record<string, { Properties: { Method: string; Path: string } }>).map(
        (e) => `${e.Properties.Method} ${e.Properties.Path}`,
      ),
    );
    expect(paths.sort()).toEqual(["POST /v1/complaints", "POST /v1/uploads"]);
  });
});
