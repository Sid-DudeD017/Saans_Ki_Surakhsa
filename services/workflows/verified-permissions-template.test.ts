import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";

describe("Verified Permissions Template & Policies", () => {
  const root = path.join(__dirname, "../..");
  const schemaPath = path.join(root, "infra/policies/schema.cedar");
  const policiesPath = path.join(root, "infra/policies/policies.cedar");
  const templatePath = path.join(root, "infra/template.yaml");

  const schemaStr = fs.readFileSync(schemaPath, "utf8");
  const policiesStr = fs.readFileSync(policiesPath, "utf8");
  const templateStr = fs.readFileSync(templatePath, "utf8");

  const schema = JSON.parse(schemaStr);
  const template = parse(templateStr);

  it("schema defines expected entities with shapes and memberships", () => {
    const entities = schema.Saans.entityTypes;
    expect(entities.User.shape.type).toBe("Record");
    expect(entities.User.memberOfTypes).toEqual(["UserGroup"]);
    expect(entities.UserGroup.shape.type).toBe("Record");
    expect(entities.Application.shape.type).toBe("Record");
    expect(entities.Case.shape.type).toBe("Record");
    expect(entities.Case.shape.attributes.district.required).toBe(true);
  });

  it("verifies function IAM policies (S3, SFN, AVP)", () => {
    expect(template.Resources.UploadsFunction.Properties.Policies.some((p: any) => p.S3WritePolicy)).toBe(true);

    expect(template.Resources.ComplaintsFunction.Properties.Policies.some((p: any) => p.StepFunctionsExecutionPolicy)).toBe(true);

    expect(template.Resources.AuthorizerFunction.Properties.Policies[0].Statement[0].Action).toBe("verifiedpermissions:IsAuthorizedWithToken");
    expect(template.Resources.AuthorizerFunction.Properties.Policies.length).toBe(1);

    const otherFns = ["HealthFunction", "WhoamiFunction"];
    for (const fn of otherFns) {
      expect(template.Resources[fn].Properties.Policies).toBeUndefined();
    }
  });

  it("schema defines all required actions with principal and resource types", () => {
    const actions = schema.Saans.actions;
    const required = ["whoami", "list", "counts", "map", "detail", "evidence", "assign", "mark_in_field", "record_action", "close"];
    for (const action of required) {
      expect(actions[action]).toBeDefined();
      expect(actions[action].appliesTo.principalTypes).toContain("User");
      if (action === "whoami") {
         expect(actions[action].appliesTo.resourceTypes).toContain("Application");
      } else {
         expect(actions[action].appliesTo.resourceTypes).toContain("Case");
      }
    }
  });

  it("template defines PolicyStore strictly matching schema", () => {
    const store = template.Resources.PolicyStore;
    expect(store.Properties.ValidationSettings.Mode).toBe("STRICT");
    const embeddedSchema = JSON.parse(store.Properties.Schema.CedarJson);
    expect(embeddedSchema).toEqual(schema);
  });

  it("template defines IdentitySource correctly referencing Cognito", () => {
    const idSource = template.Resources.IdentitySource;
    expect(idSource.Properties.PolicyStoreId.Ref).toBe("PolicyStore");
    expect(idSource.Properties.PrincipalEntityType).toBe("Saans::User");
    expect(idSource.Properties.Configuration.CognitoUserPoolConfiguration.UserPoolArn["Fn::GetAtt"]).toEqual(["CognitoUserPool", "Arn"]);
    expect(idSource.Properties.Configuration.CognitoUserPoolConfiguration.ClientIds).toContainEqual({ Ref: "CognitoUserPoolClient" });
    expect(idSource.Properties.Configuration.CognitoUserPoolConfiguration.GroupConfiguration.GroupEntityType).toBe("Saans::UserGroup");
  });

  it("template static policies reference PolicyStore and prevent drift", () => {
    const whoamiPol = template.Resources.WhoamiPolicy;
    expect(whoamiPol.Properties.PolicyStoreId.Ref).toBe("PolicyStore");

    const casesPol = template.Resources.CasesPolicy;
    expect(casesPol.Properties.PolicyStoreId.Ref).toBe("PolicyStore");

    const embeddedPolicies = whoamiPol.Properties.Definition.Static.Statement + "\n" + casesPol.Properties.Definition.Static.Statement;
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(normalize(embeddedPolicies)).toBe(normalize(policiesStr));
  });

  it("policy file requires officer membership", () => {
    expect(policiesStr).toMatch(/principal in Saans::UserGroup::"officer"/);
  });

  it("policy file requires same-district access for Sangrur and Patiala", () => {
    expect(policiesStr).toMatch(/principal in Saans::UserGroup::"district-sangrur"\s*&&\s*resource\.district == "sangrur"/);
    expect(policiesStr).toMatch(/principal in Saans::UserGroup::"district-patiala"\s*&&\s*resource\.district == "patiala"/);
  });

  it("policy file contains no wildcard permits", () => {
    expect(policiesStr).not.toMatch(/permit\s*\(\s*principal\s*,\s*action\s*,\s*resource\s*\)\s*;/);
  });

  it("outputs PolicyStoreId", () => {
    expect(template.Outputs.PolicyStoreId).toBeDefined();
    expect(template.Outputs.PolicyStoreId.Value.Ref).toBe("PolicyStore");
  });
});
