import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";

describe("SMS Notification Template Integration", () => {
  const root = path.join(__dirname, "../..");
  const templatePath = path.join(root, "infra/template.yaml");
  const templateStr = fs.readFileSync(templatePath, "utf8");
  const template = parse(templateStr);

  it("adds NotificationFailureDLQ with encryption and retention", () => {
    const queue = template.Resources.NotificationFailureDLQ;
    expect(queue).toBeDefined();
    expect(queue.Type).toBe("AWS::SQS::Queue");
    expect(queue.Properties.SqsManagedSseEnabled).toBe(true);
    expect(queue.Properties.MessageRetentionPeriod).toBe(1209600);
  });

  it("outputs DLQ URL and ARN", () => {
    expect(template.Outputs.NotificationFailureDlqUrl).toBeDefined();
    expect(template.Outputs.NotificationFailureDlqUrl.Value.Ref).toBe("NotificationFailureDLQ");
    expect(template.Outputs.NotificationFailureDlqArn).toBeDefined();
    expect(template.Outputs.NotificationFailureDlqArn.Value["Fn::GetAtt"]).toEqual(["NotificationFailureDLQ", "Arn"]);
  });

  it("injects DLQ URL environment variable to AssignFunction", () => {
    const assignFn = template.Resources.AssignFunction;
    const envVars = assignFn.Properties.Environment.Variables;
    expect(envVars.SAANS_DLQ_URL).toBeDefined();
    expect(envVars.SAANS_DLQ_URL.Ref).toBe("NotificationFailureDLQ");
  });

  it("grants least-privilege IAM to AssignFunction", () => {
    const assignFn = template.Resources.AssignFunction;
    const policies = assignFn.Properties.Policies;
    expect(policies).toBeDefined();
    const statements = policies.flatMap((p: any) => p.Statement ?? []);
    
    const smsPerm = statements.find((s: any) => s.Action === "sms-voice:SendTextMessage");
    expect(smsPerm).toBeDefined();
    expect(smsPerm.Effect).toBe("Allow");
    expect(smsPerm.Resource).toBe("*");

    const sqsPerm = statements.find((s: any) => s.Action === "sqs:SendMessage");
    expect(sqsPerm).toBeDefined();
    expect(sqsPerm.Effect).toBe("Allow");
    expect(sqsPerm.Resource["Fn::GetAtt"]).toEqual(["NotificationFailureDLQ", "Arn"]);
  });
});
