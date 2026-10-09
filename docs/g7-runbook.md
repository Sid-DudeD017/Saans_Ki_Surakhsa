# Saans Command - Deployment Runbook (G7)

This runbook describes the deployment of the Saans Command module, its Cognito integration, and the SMS notification infrastructure. 

## 1. Team Approval Checkpoint
Before deploying, the team must confirm:
- Target AWS account ID and Stack Name.
- The region must be exactly **ap-south-1**.
- The production RDS Database URL is provisioned.
- The Cognito callback/logout URLs are approved.
- The SMS delivery backend is chosen (AWS End User Messaging SMS or `outbox` fallback).

## 2. Infrastructure Setup & Validation

### Validate Local Identity
Ensure your credentials are correct and point to the right account:
```bash
aws sts get-caller-identity --profile saans
```
Verify the default region is set to `ap-south-1` in your `~/.aws/config`.

### Secure Database URL Handling
Obtain the production Database URL. Do not place this URL in shell history, `README.md`, or Git. Set it as an environment variable or secure parameter during deployment. 

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
- `BillingAlertEmail` (required): who gets the $40 and $50 budget emails.
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

## 7. SMS / DLT Configuration
If SMS is chosen over the `outbox` fallback, you must configure Indian DLT parameters (`SAANS_SMS_ENTITY_ID`, `SAANS_SMS_SENDER_ID`, etc.). 
- Note: Real SMS cannot be marked complete until a physical phone receives it.
- If DLT registration is pending, explicitly approve the `outbox` fallback.

## 8. Billing Alerts
The stack creates the **USD 50** guardrail itself: `MonthlyBudget`, an AWS Budget that emails
`BillingAlertEmail` when the month's actual cost passes $40 and again at $50. (A CloudWatch
`EstimatedCharges` alarm would have to live in `us-east-1`; Budgets is account-wide, so it works from
this `ap-south-1` stack.) AWS sends a confirmation email to that address first: confirm it, or no alert
arrives.

## 9. Rollback, Teardown, and Cost Warnings
To destroy the stack:
```bash
sam delete
```
**Cost Warning**: RDS databases, active Cognito user pools, and orphaned S3 buckets incur costs. Ensure tearing down environments also scrubs associated data storage based on data retention policies.
