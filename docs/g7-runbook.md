# Saans Command - Deployment Runbook (G7)

This runbook describes the deployment of the Saans Command module, its Cognito integration, and the SMS notification infrastructure. 

## 1. Team Approval Checkpoint
Before deploying, the team must confirm:
- Target AWS account ID and Stack Name.
- The region must be exactly **ap-south-1**.
- A short-lived public RDS instance and its Secrets Manager secret (`databaseUrl` key) are provisioned.
- The Cognito callback/logout URLs are approved.
- Real-phone SMS is excluded from this demo by team-leader decision.

## 2. Infrastructure Setup & Validation

### Validate Local Identity
Ensure your credentials are correct and point to the right account:
```bash
aws sts get-caller-identity --profile saans
```
Verify the default region is set to `ap-south-1` in your `~/.aws/config`.

### Secure Database URL Handling
Pass only the Secrets Manager ARN as `DatabaseSecretArn`; never place the database URL or password
in shell history, documentation, or Git. The development stack resolves the secret's `databaseUrl`
field during deployment. The current short-lived public RDS connection is encrypted and must be
replaced by private networking plus certificate verification before production use.

### Local Validation
Run these commands to ensure the codebase is clean:
```bash
npx tsc --noEmit
npm test
npm run lint
SAM_CLI_TELEMETRY=0 sam validate --lint --template-file infra/template.yaml
```

### Build
Build the application explicitly mapping the local node dependency paths:
```bash
PATH="$PWD/node_modules/.bin:$PATH" \
NODE_PATH="$PWD/node_modules" \
SAM_CLI_TELEMETRY=0 \
sam build --template-file infra/template.yaml
```

## 3. Deployment

### First Deployment
For the initial deployment, use the guided mode to set parameter overrides (like the Database URL and Cognito domains).
The guided prompts also ask for:
- `BillingAlertEmail` (optional): who gets the $40 and $50 budget emails.
- `SmsToSangrur`, `SmsToPatiala`, `SmsToUnassigned`: E.164 numbers for assignment and action-taken SMS
  (hidden in the console; leave empty for no SMS). Type them at the prompt; don't save them in `samconfig.toml`.
- `SmsBackend` (`outbox` by default) and, for `aws`, `SmsSenderId`, `SmsEntityId`, `SmsTemplateAssignment`,
  `SmsTemplateActionTaken` from the DLT registration. With `outbox` on Lambda, messages go to `/tmp` and
  reach no phone.
```bash
sam deploy --guided
```
**CRITICAL**: Review the CloudFormation change set before execution. **Never** use `--disable-rollback` for the first deployment.

### Outputs
Once deployed, read the CloudFormation outputs (e.g., `ApiUrl`, `CognitoUserPoolId`, `CognitoClientId`, `CognitoDomain`, `PolicyStoreId`). Configure your frontend and server `.env` files using these generated values.

## 4. Post-Deployment User Setup

### Officer Provisioning
Create non-production officer users representing Sangrur and Patiala. Do not place passwords in commands, Git, screenshots, or shell history. Use the AWS Console or secure CLI inputs.

Add each officer to the `officer` Cognito group, plus **exactly one** of the following district groups:
- `district-sangrur`
- `district-patiala`

## 5. End-to-End Testing
Execute the following verification matrix against the deployed API:
- `GET /health` (Public endpoint)
- Protected request without a valid token → Expect **401 Unauthorized**
- Valid same-district request → Expect **200 OK**
- Valid cross-district request → Expect **403 Forbidden**
- Verify that no metadata or record count leakage occurs across district bounds.

## 6. Observability and Alarms
- Inspect CloudWatch alarms (e.g., 5XX errors, Lambda errors).
- Inspect the `NotificationFailureDLQ` for asynchronous message routing failures.

## 7. SMS / DLT Configuration — rejected / out of scope

Decision recorded: `g7-sms rejected by team leader; real-phone SMS excluded from this deployment.`
Do not configure recipient numbers or DLT identifiers and do not claim a successful real-SMS test.
The deployment keeps `SmsBackend=outbox`, which reaches no phone.

## 8. Access-control decision — complete

The approved isolated-development access model is:

- A user must belong to `officer` and exactly one of `district-sangrur` or `district-patiala`.
- Officers may list, view, assign, update, and close only cases in their own district.
- Cross-district access, counts, maps, details, and actions are denied.
- Membership in both district groups, or neither group, is denied.
- `CLOSED` is a terminal state enforced by the command API.
- Field-officer and state-centre roles are intentionally deferred.

## 9. Billing Alerts
The stack creates the **USD 50** guardrail itself: `MonthlyBudget`, an AWS Budget that emails
`BillingAlertEmail`, when supplied, when the month's actual cost passes $40 and again at $50. (A CloudWatch
`EstimatedCharges` alarm would have to live in `us-east-1`; Budgets is account-wide, so it works from
this `ap-south-1` stack.) AWS sends a confirmation email to that address first: confirm it, or no alert
arrives.

## 10. Rollback, Teardown, and Cost Warnings
To destroy the stack:
```bash
sam delete
```
**Cost Warning**: RDS databases, active Cognito user pools, and orphaned S3 buckets incur costs. Ensure tearing down environments also scrubs associated data storage based on data retention policies.
