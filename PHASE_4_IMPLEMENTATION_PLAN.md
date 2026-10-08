# Saans Phase 4 - Command Implementation Plan

## Authoritative scope

Phase 4 is the **Authority module, complaint backbone, authentication, authorization, and DevOps lead**. It provides the contract that all other Saans modules consume and gives an officer a complaint workflow that exposes a nearby farmer support request before punitive action.

This revision is based on the latest Phase 4 roadmap screenshots and supersedes the earlier inferred plan.

## Final Phase 4 outcome

Phase 4 is complete only when all of the following are true:

1. Other modules can build against a frozen OpenAPI 3.1 contract and Prism mock.
2. Evidence is uploaded through presigned S3 URLs and complaints are accepted idempotently.
3. A complaint becomes a PostGIS-backed case through a Step Functions workflow.
4. Duplicate reports within 150 metres and 6 hours merge into one case.
5. FIRMS observations within 1 km can verify a fire case.
6. Jurisdiction, authority, deadline, escalation, and complaint lifecycle rules work.
7. A nearby open `support_request` is visible to the officer before penalty action.
8. Cognito authentication, a Lambda authorizer, and Cedar policies prevent cross-district access.
9. The case console provides queue, map, evidence, case detail, and actions.
10. The SAM stack is deployed with CloudWatch 5xx alarms and a dead-letter queue.
11. SNS or the documented fallback sends assignment and action-taken messages to a real phone.
12. The system sustains 200 complaints per minute with nothing in the dead-letter queue.
13. The public board shows anonymised counts and median resolution time from real app data.
14. The deployed golden path works end to end, the video is under three minutes, and the URL remains available through judging.

## Required technology and repository layout

Use the versions already present in the repository where possible. Do not replace existing choices merely to match this suggestion.

- OpenAPI 3.1 and Prism for the shared contract and mock server.
- AWS SAM for infrastructure and Lambda packaging.
- API Gateway, Lambda, Step Functions, S3, SNS, Cognito, CloudWatch, and SQS dead-letter queues.
- PostgreSQL with PostGIS for spatial complaints, cases, district boundaries, and support-request lookup.
- LocalStack plus local PostGIS for the local integration environment.
- Cedar policies for fine-grained district and role authorization.
- k6 for the required load test.
- A web console compatible with the repository's chosen frontend stack.

Target layout:

```text
packages/contracts/        OpenAPI 3.1, schemas, events, Prism config
services/command-api/      complaint, case, routing and action Lambdas
services/workflows/        Step Functions definitions and workflow code
apps/command-console/      officer case console and public board
infra/template.yaml        AWS SAM stack
infra/policies/            Cedar policies and policy tests
infra/config/              routing, deadlines, districts and authorities
tests/contract/            OpenAPI and Prism contract tests
tests/integration/         LocalStack/PostGIS workflow tests
tests/e2e/                 deployed and local golden-path tests
tests/load/                k6 scripts and thresholds
```

Adapt this layout if the repository already has an agreed monorepo structure.

## Core contracts

### Required HTTP operations

- `GET /v1/routes/clean`
- `POST /v1/uploads` - returns a presigned S3 upload target.
- `POST /v1/complaints` - accepts a complaint with an idempotency key.
- `GET /v1/cases` - officer queue, scoped by authorization.
- `GET /v1/cases/{caseId}` - case detail, evidence, lifecycle and linked support request.
- `POST /v1/cases/{caseId}/actions` - assign, mark in field, record action taken, or close.
- A public metrics endpoint exposing anonymised aggregates only.

The OpenAPI document must also define the complaint shape, error envelope, pagination, authentication, idempotency behavior, and event names/payloads.

### Complaint lifecycle

```text
Received
  -> Triaged
  -> Duplicate (same spot, within 6 h)
     OR Verified (FIRMS fire within 1 km)
  -> Assigned
  -> Escalated when deadline passes
  -> In field
  -> Action taken
  -> Closed
  -> Reporter notified
```

Every transition must be validated, timestamped, attributable, and safe to retry.

### Routing deadlines - demo configuration

| Complaint type | Authority | Deadline |
| --- | --- | ---: |
| Farm fire | SDM + District Agriculture Officer | 4 hours |
| Garbage or e-waste burning | Municipal SWM | 12 hours |
| Vehicle smoke | Traffic police | 24 hours |
| Firecrackers during a banned period | Local police | 2 hours |
| Farmer support request | Agriculture department + CHC | 72 hours; never a penalty |

Routing rules, deadlines, district boundaries, and authorities must be configuration or seed data rather than hidden conditionals.

## Non-negotiable acceptance tests

- k6 sustains **200 complaints per minute** and the dead-letter queue remains empty.
- Two reports for the same fire **150 metres apart** within the six-hour window merge into one case.
- An officer from a different district receives **HTTP 403**.
- All **20 Cedar policy tests** pass.
- A missed deadline escalates within **one minute** in demo configuration.
- An officer sends a machine/help action and a **real phone receives the SMS or pre-agreed real-phone fallback**.

## Stage execution rule

Run one Antigravity prompt at a time. At the end of every stage, Antigravity must print a gate table with `PASS` or `FAIL`, evidence, and the exact verification command. Do not begin the next stage while any mandatory item is failing.

Cloud actions that create resources, costs, credentials, IAM permissions, messages to real phones, or deployments require explicit human approval immediately before execution. Antigravity may prepare and validate infrastructure locally without that approval.

---

## Stage 0 - Repository audit and execution map

### Work

- Inspect the entire repository, contracts, modules, infrastructure, tests, and uncommitted changes.
- Map every one of the 24 roadmap tasks to an owner file, test, and verification command.
- Identify contracts other modules already depend on.
- Identify required AWS access, external credentials, phone/DLT constraints, and decisions needing human approval.

### Mandatory completion gate

- [ ] No file is modified.
- [ ] Existing work and conflicts are identified.
- [ ] All 24 roadmap items are mapped.
- [ ] Exact proposed file tree is shown.
- [ ] Local and deployed verification commands are separated.
- [ ] Approval-requiring actions are explicitly listed.
- [ ] No credentials or account identifiers are invented.

### Antigravity prompt

```text
Read PHASE_4_IMPLEMENTATION_PLAN.md and audit the complete repository. Do not modify files, install packages, create cloud resources, send messages, or deploy anything.

Produce: current architecture and git status; existing contracts and dependencies; an adapted proposed file tree; a mapping of all 24 Phase 4 tasks to files, tests and commands; assumptions and blockers; required AWS/SMS/DLT human decisions; and a stage-by-stage execution map.

End with the Stage 0 gate table. If any gate fails, write “STAGE 0 INCOMPLETE” and stop.
```

---

## Stage 1 - Preparation and risk retirement

This corresponds to the roadmap's preparation day. It may be skipped only when the same evidence already exists and is verified.

### Work

1. Define the AWS cost guardrail: USD 50 billing alarm, region `ap-south-1`, and least-privilege team IAM plan.
2. Determine whether SNS can send to Indian phones from the account. Document sandbox/DLT constraints and choose a fallback immediately if required.
3. Run local toy proofs: SAM + LocalStack hello Lambda, two-step Step Functions, and one Cedar allow/deny policy.
4. Draft OpenAPI 3.1, including `/v1/routes/clean`, complaint schema, errors, idempotency, and event names.
5. Create configuration/seed design for routing, deadlines, two district boundaries, and authorities.
6. Record what pre-event planning/material is allowed as a human-owned organiser question.

### Mandatory completion gate

- [ ] Billing-alarm and IAM changes are verified or marked as awaiting authorized human execution.
- [ ] `ap-south-1` is the single default AWS region.
- [ ] SMS path is documented as SNS or a named fallback; uncertainty is not acceptable.
- [ ] Local SAM/LocalStack Lambda proof passes.
- [ ] Two-step local Step Functions proof passes.
- [ ] Cedar allow and deny proof passes.
- [ ] Draft OpenAPI validates as OpenAPI 3.1.
- [ ] Complaint and event names are enumerated.
- [ ] Two district fixtures and authority assignments are specified.
- [ ] Routing/deadline configuration includes all five roadmap categories.
- [ ] Organiser question is recorded for a human; Antigravity does not claim it contacted anyone.

**Stage done when:** billing guardrail is accounted for, SMS path is known, and the contract is drafted.

### Antigravity prompt

```text
Implement only Stage 1 from PHASE_4_IMPLEMENTATION_PLAN.md.

Prepare local proofs for SAM + LocalStack Lambda, a two-step Step Functions state machine, and Cedar allow/deny. Draft and validate OpenAPI 3.1 with /v1/routes/clean, complaint schemas, standard errors, idempotency and event names. Add configuration/fixtures for all routing deadlines, two districts and their authorities.

Document exact AWS billing-alarm, ap-south-1 IAM and Indian SMS/DLT steps, but do not change AWS, create credentials, contact organisers, spend money or send SMS without explicit approval. Require a named fallback if SNS is not viable.

Run every local proof. End with the Stage 1 gate table. If anything fails or the SMS path remains unknown, write “STAGE 1 INCOMPLETE” and stop.
```

---

## Stage 2 - Contract freeze and complaint intake

### Work

1. Freeze the OpenAPI contract under `packages/contracts` and run Prism.
2. Add `infra/template.yaml` and local composition with PostGIS and LocalStack.
3. Implement `POST /v1/uploads` using presigned S3 uploads.
4. Implement `POST /v1/complaints` with required idempotency keys.
5. Implement Step Functions v1: `validate -> hash evidence -> triage -> assign`.
6. Add a one-command end-to-end smoke-test harness.

### Mandatory completion gate

- [ ] OpenAPI 3.1 lint and validation pass.
- [ ] Breaking-contract checks pass against the frozen version.
- [ ] Prism serves representative requests and responses.
- [ ] Local PostGIS and LocalStack start from documented commands.
- [ ] Presigned upload succeeds; unauthorized and expired cases are tested.
- [ ] Complaint without an idempotency key is rejected.
- [ ] Retrying the same complaint creates no duplicate row.
- [ ] Evidence hash is stable for identical evidence.
- [ ] State-machine success and failure paths are observable.
- [ ] A complaint submitted through the mock/intake path creates exactly one PostGIS case row.
- [ ] Smoke harness runs from one documented command.

**Stage done when:** a complaint from the mock lands as a case row in PostGIS.

### Antigravity prompt

```text
Implement only Stage 2. Require Stage 1 to be complete.

Freeze OpenAPI 3.1 in packages/contracts and run it with Prism. Add infra/template.yaml and a documented local PostGIS + LocalStack environment. Implement POST /v1/uploads with presigned S3 semantics and POST /v1/complaints with mandatory idempotency. Implement Step Functions v1 as validate -> hash evidence -> triage -> assign. Persist to PostGIS and add a one-command smoke harness.

Test invalid payloads, expired/unauthorized uploads, repeated keys, workflow failures and rollback. Do not implement dedupe, FIRMS, console, authorization, live SMS or deployment.

Prove one submitted complaint produces exactly one case row. End with the Stage 2 gate table. On any failure write “STAGE 2 INCOMPLETE” and stop.
```

---

## Stage 3 - Workflow intelligence and help-before-penalty

### Work

1. Deduplicate reports using 150 metres and six hours.
2. Check FIRMS evidence; a fire observation within 1 km may verify the case.
3. Perform PostGIS district/jurisdiction lookup.
4. Route to configured authorities and start the appropriate deadline.
5. Escalate missed deadlines, using one minute in automated demo tests.
6. Link a complaint to a nearby open `support_request`.
7. Enforce legal, attributable, idempotent lifecycle transitions.

### Mandatory completion gate

- [ ] Two same-fire reports 150 m apart within six hours merge into one case.
- [ ] Reports outside either boundary do not merge.
- [ ] Exact and just-outside boundaries have tests.
- [ ] FIRMS observation inside 1 km verifies; one outside does not.
- [ ] FIRMS failure has a deterministic fixture/degraded path.
- [ ] Both seeded districts resolve correctly.
- [ ] Every complaint category routes to its configured authority/deadline.
- [ ] Missed deadline escalates within one minute in demo configuration.
- [ ] Nearby open `support_request` is linked in the case model.
- [ ] Farmer support requests are never routed as penalties.
- [ ] Invalid lifecycle transitions are rejected.
- [ ] Retries do not duplicate events or assignments.

**Stage done when:** dedupe, jurisdiction, escalation, and help-context tests pass.

### Antigravity prompt

```text
Implement only Stage 3. Require Stages 1 and 2 complete.

Add PostGIS deduplication at 150 metres within six hours, FIRMS corroboration within 1 km, jurisdiction lookup, configured authority routing, deadlines, escalation and lifecycle enforcement. Link complaints to nearby open support_request records and include the relationship in case detail. A farmer support request must never become a penalty route.

Make workflow operations retry-safe. Put boundaries and deadlines in validated config. Use deterministic FIRMS fixtures and degraded mode; tests must not require live NASA.

Test exact/just-outside boundaries, both districts, all five routes, legal/illegal transitions, retries, no-match and one-minute escalation. End with the gate table. On failure write “STAGE 3 INCOMPLETE” and stop.
```

---

## Stage 4 - Authentication and authorization

### Work

1. Configure Cognito-compatible roles and claims.
2. Implement the Lambda authorizer.
3. Implement Cedar policies for role, district, resource, and action.
4. Create at least 20 Cedar policy tests, including cross-district denial.
5. Apply authorization to lists, counts, maps, details, evidence, and actions.

### Mandatory completion gate

- [ ] Unauthenticated request receives 401.
- [ ] Unauthorized authenticated request receives 403.
- [ ] Same-district officer can access permitted cases.
- [ ] Officer from another district receives 403.
- [ ] Denied resources do not leak through counts, maps, errors, or IDs.
- [ ] Every case action is authorized.
- [ ] At least 20 named Cedar policy tests pass.
- [ ] Tests include allow and deny cases for every officer action.
- [ ] Tokens, credentials, and personal data are absent from logs/fixtures.
- [ ] Local identities are clearly non-production fixtures.

**Stage done when:** cross-district access returns 403 and all 20 Cedar tests pass.

### Antigravity prompt

```text
Implement only Stage 4. Require Stages 1–3 complete.

Add Cognito-compatible claims, a Lambda authorizer and Cedar authorization for role, district, resource and action. Protect case lists, counts, maps, details, evidence and actions.

Create at least 20 named Cedar tests with allow and deny scenarios. Prove a same-district officer succeeds and another-district officer gets HTTP 403 without metadata leakage. Use local non-production identities. Do not create live users, credentials or deploy.

Run all earlier tests too. End with the gate table. If cross-district access is not 403 or fewer than 20 policy tests pass, write “STAGE 4 INCOMPLETE” and stop.
```

---

## Stage 5 - Officer console and public impact board

### Work

1. Build district-scoped queue, map, case detail, evidence, lifecycle, deadlines, escalation, audit history, and actions.
2. Provide an accessible text equivalent for map content.
3. Surface linked farmer support before enforcement actions.
4. Build a public board with anonymised counts and median resolution time from app data.

### Mandatory completion gate

- [ ] Queue contains only authorized cases.
- [ ] Map and text list contain the same authorized cases.
- [ ] Detail shows evidence provenance and lifecycle history.
- [ ] Deadline and escalation state are visible.
- [ ] Linked support request appears before penalty/enforcement controls.
- [ ] Officer can assign, mark in field, record action, and close according to policy.
- [ ] API blocks invalid/unauthorized actions independently of UI.
- [ ] Loading, empty, error, 401, 403, stale, and degraded-FIRMS states exist.
- [ ] Essential flow is keyboard-accessible at desktop and mobile widths.
- [ ] Public board contains only anonymised aggregates.
- [ ] Counts and median resolution time come from application data.
- [ ] Small-cell/personal-data leakage tests pass.
- [ ] Critical officer-flow end-to-end test passes.

**Stage done when:** an authorized officer closes the seeded case while seeing support first.

### Antigravity prompt

```text
Implement only Stage 5. Require Stages 1–4 complete.

Build the officer console: district-scoped queue, map plus text equivalent, case detail, evidence, lifecycle, authority, deadline, escalation, audit history and permitted actions. Show linked support_request prominently before penalty controls.

Build a public board using anonymised counts and median resolution time computed from app data. Prevent personal, precise-location and small-cell leakage. Include loading, empty, error, 401, 403, stale and degraded states. Make the critical path keyboard accessible and responsive.

Add component, authorization-boundary and E2E tests. Do not deploy or send real SMS. End with the gate table. On any mandatory failure write “STAGE 5 INCOMPLETE” and stop.
```

---

## Stage 6 - Deployment, operations, SMS and performance

### Work

1. Complete and validate the SAM stack.
2. Configure CloudWatch 5xx alarms and dead-letter queues.
3. Implement SNS SMS for case assigned and action taken, or the approved fallback.
4. Run k6 at 200 complaints per minute.
5. Deploy to `ap-south-1` after explicit approval.
6. Run the golden path on the deployed URL.

### Mandatory completion gate

- [ ] `sam validate` and local integration tests pass before deployment.
- [ ] Deployment uses `ap-south-1` and the approved account/stack.
- [ ] Least-privilege IAM is reviewed.
- [ ] CloudWatch alarm covers API/Lambda 5xx failures.
- [ ] DLQ covers every required asynchronous failure path.
- [ ] Assignment and action notifications are each emitted exactly once.
- [ ] A real phone receives the required SMS or approved fallback.
- [ ] Messages use approved templates without unnecessary sensitive data.
- [ ] k6 sustains 200 complaints/minute for the agreed duration.
- [ ] Explicit error-rate and latency thresholds pass.
- [ ] DLQ is empty after the successful load test.
- [ ] Deployed health check and complete golden path pass.
- [ ] Public board shows data produced by the deployed run.

**Stage done when:** the officer sends a machine/help action and a real phone receives it.

### Antigravity prompt

```text
Prepare Stage 6. Require Stages 1–5 complete.

Complete SAM, CloudWatch 5xx alarm, DLQ wiring, SNS assignment/action notifications or approved fallback, k6 at 200 complaints/minute, health checks and deployed golden-path test.

First run sam validate and all local checks. Do not deploy, modify IAM, create paid resources, send real SMS or run a cost-bearing load test until the human explicitly approves the exact account, region and phone path.

After approval, deploy only to ap-south-1, run load and golden-path tests, inspect DLQ and prove user-visible notification idempotency. End with the gate table. If real-phone delivery, 200/minute, empty DLQ or deployed golden path fails, write “STAGE 6 INCOMPLETE” and stop.
```

---

## Stage 7 - Submission and final audit

### Work

1. Run every acceptance test from a clean setup.
2. Record the officer scene around 1:55 and architecture build-up around 2:25 with voiceover.
3. Source impact-panel values only from app data.
4. Produce a final cut under three minutes.
5. Submit and keep the URL available through results.
6. Attempt stretch items only after every mandatory gate passes.

### Mandatory completion gate

- [ ] Fresh-clone/local setup documentation is accurate.
- [ ] Contract, unit, integration, Cedar, UI, and E2E suites pass.
- [ ] 150 m/6 h dedupe test passes.
- [ ] Cross-district 403 and all 20 Cedar tests pass.
- [ ] One-minute escalation test passes.
- [ ] 200 complaints/minute passes with empty DLQ.
- [ ] Real-phone notification proof exists.
- [ ] Public metrics are anonymised and derived from app data.
- [ ] Deployed golden path passes immediately before recording.
- [ ] Video is below three minutes and matches the deployed build.
- [ ] Submission is confirmed by a human.
- [ ] Deployed URL remains healthy after submission.
- [ ] No critical/high issue remains.

### Antigravity prompt

```text
Perform Stage 7 final audit. Do not add features.

From a clean setup, run contract, unit, PostGIS/LocalStack integration, Cedar, UI, E2E, 150 m/6 h dedupe, cross-district 403, one-minute escalation and approved 200/minute deployed tests. Verify empty DLQ and deployed golden path.

Verify anonymised app-derived metrics, notification proof, accurate docs, no committed secrets and no critical/high issue. Prepare the recording runbook for the officer scene, architecture build-up, voiceover and under-three-minute cut. Do not claim to submit or contact anyone unless a human performs or explicitly authorizes it.

Output every gate with PASS/FAIL and evidence. If any mandatory gate fails, state “PHASE 4 INCOMPLETE - DO NOT SUBMIT”. Only after every technical gate passes and a human confirms submission may you state “PHASE 4 COMPLETE - SUBMITTED AND DEMO URL HEALTHY”.
```

## Golden-path demo

1. Citizen requests a presigned upload and submits a farm-fire complaint with an idempotency key.
2. The workflow validates it, hashes evidence, and creates a PostGIS case.
3. A nearby second report merges into the same case.
4. FIRMS corroborates it; district lookup routes it to the SDM and Agriculture Officer.
5. The officer signs in and sees only permitted-district cases.
6. Case detail shows evidence, deadline, and nearby farmer support before enforcement.
7. The officer sends a machine/help action.
8. A real phone receives the notification.
9. The case records action taken and closes with append-only history.
10. The public board updates anonymised counts and median resolution time.

## Cut first if behind

- EKS and Helm.
- Fargate `command-api`.
- OpenSearch.
- Officer copilot.
- Village watchlist and fitting watchlist weights.

Do not cut the contract, PostGIS case creation, dedupe, authorization, escalation, support-request link, deployment, real-phone notification, 200/minute target, DLQ check, or acceptance tests.

## Master completion rule

```text
Contract + intake + workflow + dedupe + FIRMS + routing + deadlines
+ help-before-penalty + Cognito/Cedar + console + deployment
+ observability + real-phone notification + 200/minute load test
+ anonymised public metrics + deployed golden path + submitted video
= Phase 4 complete
```
