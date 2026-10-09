# Saans Command - Deployment Runbook (G7)

This runbook describes the deployment of the Saans Command module, its Cognito integration, and the SMS notification infrastructure. 

## 1. Team Approval Checkpoint
Before deploying, the team must confirm:
- Target AWS account ID and Stack Name.
- The region must be exactly **ap-south-1**.
- A private RDS instance, its Secrets Manager secret (`databaseUrl` key), private subnet IDs,
  and a Lambda security group allowed to reach the database are provisioned.
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
Pass only the Secrets Manager ARN as `DatabaseSecretArn`; never pass the database URL to SAM.
The workload template resolves the secret and grants only `secretsmanager:GetSecretValue` on that ARN.
Pass the private subnet IDs and Lambda security group IDs when guided deployment prompts for them.

### Local Validation
Run these commands to ensure the codebase is clean:
```bash
npx tsc --noEmit
npm test
npm run lint
npm run cedar:check
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
For the initial deployment, use guided mode to set the secret ARN, private networking, SMS/DLT values, and Cognito domains:
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
Billing metrics exist only in `us-east-1`, so deploy the separate account-level template there:
```bash
aws cloudformation deploy --profile saans --region us-east-1 \
  --stack-name saans-billing-alarm \
  --template-file infra/billing-alarm.yaml \
  --parameter-overrides AlarmEmail=TEAM_EMAIL
```
Confirm the SNS email subscription; an unconfirmed subscription cannot deliver the alarm.

## 9. Rollback, Teardown, and Cost Warnings
To destroy the stack:
```bash
sam delete
```
**Cost Warning**: RDS databases, active Cognito user pools, and orphaned S3 buckets incur costs. Ensure tearing down environments also scrubs associated data storage based on data retention policies.
