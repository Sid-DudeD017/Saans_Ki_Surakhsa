// infra/template.yaml wires the same handlers and state machine that run locally. (No SAM CLI in CI
// yet; G7 adds `sam validate`.)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { vi } from "vitest";
vi.mock("aws-jwt-verify", () => ({ CognitoJwtVerifier: { create: vi.fn() } }));
import * as apiHandlers from "../command-api/lambda";
import * as healthHandlers from "../command-api/health";
import * as authHandlers from "../command-api/authorizer";
import * as whoamiHandlers from "../command-api/whoami";
import * as caseHandlers from "../command-api/cases";
import * as stepHandlers from "./lambda";

const root = join(__dirname, "../..");
const template = YAML.parse(readFileSync(join(root, "infra/template.yaml"), "utf8"));
const asl = readFileSync(join(root, "services/workflows/complaint-intake.asl.json"), "utf8");
const resources: Record<string, { Type: string; Properties: Record<string, unknown> }> = template.Resources;
const modules: Record<string, Record<string, unknown>> = {
  "services/command-api/lambda": apiHandlers,
  "services/command-api/health": healthHandlers as any,
  "services/command-api/authorizer": authHandlers as any,
  "services/command-api/whoami": whoamiHandlers as any,
  "services/command-api/cases": caseHandlers as any,
  "services/workflows/lambda": stepHandlers,
};

describe("infra/template.yaml", () => {
  it("every function's handler exists", () => {
    const functions = Object.entries(resources).filter(([, r]) => r.Type === "AWS::Serverless::Function");
    expect(functions.length).toBe(11);
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

  it("routes intake and protected case paths", () => {
    const paths = Object.values(resources).flatMap((r) =>
      Object.values((r.Properties.Events ?? {}) as Record<string, { Properties: { Method: string; Path: string } }>).map(
        (e) => `${e.Properties.Method} ${e.Properties.Path}`,
      ),
    );
    expect(paths.sort()).toEqual([
      "GET /health", "GET /v1/cases", "GET /v1/cases/{id}", "GET /v1/officer/whoami",
      "POST /v1/cases/{id}/actions", "POST /v1/complaints", "POST /v1/uploads",
    ]);
  });
});
describe("template.yaml structural checks (migrated)", () => {
  const doc = YAML.parse(readFileSync(join(root, "infra/template.yaml"), "utf8"));

  it("contains HealthFunction with GET /health route", () => {
    expect(doc.Resources.HealthFunction).toBeDefined();
    expect(doc.Resources.HealthFunction.Properties.Events.Get.Properties.Path).toBe("/health");
  });

  it("does not contain unused SQS DLQ", () => {
    expect(doc.Resources.FailureDLQ).toBeUndefined();
  });

  it("contains properly dimensioned Alarms", () => {
    expect(doc.Resources.Api5xxAlarm.Properties.Dimensions).toContainEqual({ Name: "Stage", Value: { Ref: "Stage" } });
    expect(doc.Resources.UploadsErrorAlarm).toBeDefined();
    expect(doc.Resources.ComplaintsErrorAlarm).toBeDefined();
  });

  it("contains configurable CORS on Api", () => {
    expect(doc.Parameters.CorsAllowedOrigin).toBeDefined();
    expect(doc.Resources.Api.Properties.CorsConfiguration.AllowOrigins).toContainEqual({ Ref: "CorsAllowedOrigin" });
  });

  it("keeps Lambda outside the VPC for the short-lived public-RDS demo", () => {
    expect(doc.Globals.Function.VpcConfig).toBeUndefined();
    expect(doc.Parameters.VpcSubnetIds).toBeUndefined();
    expect(doc.Parameters.LambdaSecurityGroupIds).toBeUndefined();
  });

  it("contains valid outputs", () => {
    expect(doc.Outputs.ApiUrl).toBeDefined();
    expect(doc.Outputs.EvidenceBucketName).toBeDefined();
    expect(doc.Outputs.IntakeStateMachineArn).toBeDefined();
    expect(doc.Outputs.CognitoUserPoolId).toBeDefined();
    expect(doc.Outputs.CognitoClientId).toBeDefined();
    expect(doc.Outputs.CognitoDomain).toBeDefined();
  });

  it("contains Cognito user pool, three groups, and client", () => {
    expect(doc.Resources.CognitoUserPool).toBeDefined();
    expect(doc.Resources.OfficerGroup).toBeDefined();
    expect(doc.Resources.DistrictSangrurGroup).toBeDefined();
    expect(doc.Resources.DistrictPatialaGroup).toBeDefined();

    const client = doc.Resources.CognitoUserPoolClient;
    expect(client.Properties.GenerateSecret).toBe(false);
    expect(client.Properties.AllowedOAuthFlows).toContain("code");
    expect(client.Properties.CallbackURLs).toContainEqual({ Ref: "AppCallbackUrl" });
  });

  it("contains Authorizer configuration on WhoamiFunction", () => {
    const whoami = doc.Resources.WhoamiFunction;
    expect(whoami).toBeDefined();
    expect(whoami.Properties.Events.Get.Properties.Auth.Authorizer).toBe("CustomAuthorizer");
  });

  it("contains policy-store environment configuration and least-privilege IAM for AuthorizerFunction", () => {
    const auth = doc.Resources.AuthorizerFunction;
    expect(auth.Properties.Environment.Variables.VERIFIED_PERMISSIONS_POLICY_STORE_ID).toEqual({ Ref: "PolicyStore" });
    const policy = auth.Properties.Policies[0].Statement[0];
    expect(policy.Effect).toBe("Allow");
    expect(policy.Action).toBe("verifiedpermissions:IsAuthorizedWithToken");
    expect(policy.Resource["Fn::Sub"]).toBe("arn:aws:verifiedpermissions:${AWS::Region}:${AWS::AccountId}:policy-store/${PolicyStore}");
  });
});
