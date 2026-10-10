# Saans Command (P4) Platform Upgrade Plan

This document outlines the strategy to upgrade the Saans Command (`/command`) module from a read-only demo into a real complaint and incident-management platform.

## 1. Gap Analysis

| Area | Existing Capabilities | What to Build | Risk / Complexity |
| --- | --- | --- | --- |
| **Complaint Submission** | Intake pipeline in `services/command-api/complaints.ts`. Presigned uploads in `services/command-api/uploads.ts`. Race-free idempotency in `schema.ts`. | Validation expansion. Link multiple reports securely. | Low. The core idempotency logic is already solid. |
| **Routing & AuthZ** | `infra/config/routing.json` maps authorities/SLAs. Cedar policies exist (`avp.ts`, `authz.ts`). | STAGE 3: Expand access control for Citizens vs Officers vs Supervisors. Enforce isolation. | High. Cedar policies must strictly isolate jurisdictions without leaking PII. |
| **Threat Assessment** | None. Cases are directly created via intake state machine. | STAGE 4: Small pure function for automated scoring (Low/Medium/High/Critical) and reason generation with manual officer overrides (no automatic action). | Medium. Requires tuning pure functions and logging overrides immutably. |
| **Lifecycle API** | Hardcoded initial uppercase state `OPEN` in `services/command-api/cases.ts`. | Additive state transitions. Pure state machine logic enforcing allowed paths. | Medium. Ensure backward compatibility with existing states. |
| **Backend / Data** | PostGIS schema (`services/command-api/schema.ts`). Tracking in `case_decisions`, `workflow_events`. | Migrations for `status_history`, `audit_log` (immutable), `users`, and new schemas for the lifecycle. | High. Must maintain DB integrity and prevent mutations on the audit log. |
| **Dashboards** | Demo UI using `src/app/command/mockCases.ts` in `page.tsx`, `CaseMap.tsx`, `CaseDetailPanel.tsx`. | Real-time views for Citizens, Officers, Supervisors. Connect to `GET /v1/cases`. | Medium. Responsive UI work reusing existing components. |
| **Notifications** | SMS adapter in `services/command-api/sms.ts`, `notify.ts`. Tracks in `notifications_sent`. | Add email adapter. Notify on new lifecycle events (assignment, resolved). | Low. The `notify.ts` interface is extensible. |

## 2. Lifecycle Additive Mapping

`packages/contracts/CONVENTIONS.md` explicitly states:
> "Saans Command's own lifecycle values stay uppercase, because P4's zod schemas, seed and tests and P1's converter already use them: `HelpRequest.status` (`OPEN`, `MATCHED`, `FULFILLED`, `EXPIRED`), `CommandCase.status` and `verificationStatus`, `MachineAsset.status`, `IncidentReport.status`, `SatelliteObservation.source`, and officer actions (`APPROVE`, `CHANGE`, `REJECT`, `MARK_IN_FIELD`, `RECORD_ACTION_TAKEN`, `CLOSE`)."

To adhere to this, new lifecycle codes will be **UPPERCASE** in the database, and **lowercase snake_case** on the wire for the API contract (`submitted, under_review, assigned, in_progress, awaiting_information, resolved, closed, reopened`).

**Status Mapping Table**:
| Category | Values (Database) | Wire Values (Contract) | Notes |
| --- | --- | --- | --- |
| **Cases (New Lifecycle)** | `SUBMITTED`, `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `AWAITING_INFORMATION`, `RESOLVED`, `CLOSED`, `REOPENED` | `submitted`, `under_review`, `assigned`, `in_progress`, `awaiting_information`, `resolved`, `closed`, `reopened` | Additive mapping. The existing `OPEN` value is considered a legacy equivalent to `SUBMITTED`. |
| **HelpRequests** | `OPEN`, `MATCHED`, `FULFILLED`, `EXPIRED` | `open`, `matched`, `fulfilled`, `expired` | Separate vocabulary, stays unchanged. |
| **Officer Actions** | `APPROVE`, `CHANGE`, `CLOSE`, `REJECT`, `MARK_IN_FIELD`, `RECORD_ACTION_TAKEN` | `approve`, `change`, `close`, `reject`, `mark_in_field`, `record_action_taken` | Separate vocabulary, stays unchanged. |

## 3. Dashboard Data Replacement

The dashboard currently uses `MOCK_CASES` from `src/app/command/mockCases.ts`. This will be replaced entirely:

| Location | Current Usage | Replacement Endpoint |
| --- | --- | --- |
| `src/app/command/page.tsx` | Renders `CaseMap` and case list. | `GET /v1/cases` (list with role-based filters). |
| `src/app/command/CaseDetailPanel.tsx` | Displays active case details. | `GET /v1/cases/{id}` (single case view). |
| `src/app/command/commandApi.ts` | Stub functions returning mock actions. | `POST /v1/cases/{id}/actions` and status updates. |

## 4. Contract Additions (Smallest)

New paths for `packages/contracts/openapi.yaml`:
- **GET /v1/cases** (list filters)
- **GET /v1/cases/{id}** (Officers see internal notes; Citizens receive a separate `CitizenCaseView` response shape with NO internal notes and hidden identities).
- **POST /v1/complaints** (Add privacy consent fields).
- **POST /v1/cases/{id}/actions**:
  - `accept` (Role: Officer, Request: `{ action: "accept" }`)
  - `note` (Role: Officer/Supervisor, Request: `{ action: "note", internal: true, body: "text" }`)
  - `request_info` (Role: Officer, Request: `{ action: "request_info", message: "..." }`)
  - `reassign` (Role: Supervisor, Request: `{ action: "reassign", to: "officer_id" }`)
  - `update_status` (Role: Officer, Request: `{ action: "update_status", status: "in_progress" }`)
  - `resolve` (Role: Officer, Request: `{ action: "resolve", summary: "..." }`)
  - `override_assessment` (Role: Officer/Supervisor, Request: `{ action: "override_assessment", to_level: "high", reason: "..." }`)
- **POST /v1/cases/{id}/confirm** (Role: Citizen, Request: `{ satisfied: true }` -> `CLOSED`)
- **POST /v1/cases/{id}/reopen** (Role: Citizen, Request: `{ reason: "..." }` -> `REOPENED`)
- **GET /v1/cases/{id}/history** (Role: Officer/Supervisor)

## 5. Realistic Timeline & Phasing

*Deadline: Sunday 12:00 Code Freeze. The deployed golden path (`scripts/smoke.sh`) must pass successfully throughout.*

### Must-Have
1. **Stage 2.0: Idempotency Race Verification** - Parallel `curl.exe` tests to verify `Idempotency-Key` prevents races, returns 409 for mismatches, and 4xx for missing keys.
2. **Stage 2: Data Model, State Machine, Audit Log** - History, pure state machine, immutable audit logging.
3. **Stage 3: Routing & Access** - Point-in-polygon routing. Named Cedar tests: a citizen sees only their own tickets, reporter identity hidden without consent, other-district officer gets 403.
4. **Stage 4: Threat Assessment** - Small pure function scoring model and manual override logging (no automatic actions taken by system).
5. **Stage 5: Lifecycle API** - Create, List, Action REST endpoints mapping lowercase wire codes to uppercase DB codes.
6. **Stage 8: Dashboards** - Citizen and officer screens, wired to real endpoints instead of `mockCases.ts`.
7. **Stage 9: End-to-End Demo** - A scripted dev-mode demo verifying the full flow.

### Should-Have
8. **Stage 6: Auth & Data Protection** - Local mock auth, `node:crypto` AES-256-GCM encryption.
9. **Stage 7: Notifications** - Local console adapter and new lifecycle notification triggers.

### Cut-First
- Admin screens
- Supervisor extras (escalation dashboard)
- Email notification adapter

## 6. Required NPM Packages

**Zero** new packages are required. 
- We will use `Intl.DateTimeFormat` for dates.
- We will use `node:crypto` for AES-256-GCM.
- We will use an in-memory map for the rate limiter.
- We will use the existing UI components in `src/components/ui`.
