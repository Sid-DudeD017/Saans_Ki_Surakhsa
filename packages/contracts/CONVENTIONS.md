# Phase 4 - Contract Conventions

This document records the authoritative G1 "One vocabulary" decisions for the unified API contract:

- **Coordinates**: Use exactly `lat` and `lon`. Never use `lng`, `latitude`, or `longitude` in P4-owned domain schemas, repository interfaces, implementations, seed data, tests, and the unified API contract.
- **Demo Story & Location**: The shared demo story is based in Sangrur. P4’s incident report and matching NASA FIRMS observation must fall within Sangrur. Patiala is configured and documented as district two.
- **Canonical Operations**:
  - Route operation: `POST /v1/routes/clean`
  - Case-action operation: `POST /v1/cases/{id}/actions`
- **Timestamps**: All wire timestamps use ISO 8601 with the explicit India offset `+05:30` (not `Z`) for demo examples and seeds.
- **Wind Data**: Wind data remains inside `GET /v1/aqi`.
- **AQI Category Wire Values**: Use stable lowercase codes: `good`, `satisfactory`, `moderate`, `poor`, `very_poor`, `severe`. Display labels are a UI concern.
- **Unified Contract Ownership**: P4 owns the integration into the unified contract. P1 and P3 proposal specs are contributor inputs.
- **Known Consumer Handoff Note**: P1’s Agent Kisan implementation was successfully migrated to emit `lon` and `+05:30` alongside G1.

## G2: one spec, a mock and types

- **Status casing (decided at G2, P4 to confirm)**: Saans Command's own lifecycle values stay **uppercase**, because P4's zod schemas, seed and tests and P1's converter already use them: `HelpRequest.status` (`OPEN`, `MATCHED`, `FULFILLED`, `EXPIRED`), `CommandCase.status` and `verificationStatus`, `MachineAsset.status`, `IncidentReport.status`, `SatelliteObservation.source`, and officer actions (`APPROVE`, `CHANGE`, `REJECT`, `MARK_IN_FIELD`, `RECORD_ACTION_TAKEN`, `CLOSE`). Every **shared vocabulary code is lowercase**: AQI categories, pollutants, GRAP stages, complaint types (`farm_fire`, …, `farmer_support`), Kisan's machine codes (`happy_seeder`, …) and Kisan's request status (`filed`, `seen`, `machine_assigned`, …). New values follow the same split.
- **Farmer support requests**: Kisan Saathi files through `POST /v1/complaints` with `type: farmer_support` and the body `FarmerSupportComplaint` (P1's proposal): the farm's `location`, empty `evidence`, the `support_request` (farm, coverage, `plan[]` of suggested CHC bookings, `unmet[]`, `nearby_fires`) and `help_request` in Command's `HelpRequest` shape, with extra fields for the case view. `Idempotency-Key` is the Kisan session id. Citizen reports keep `ComplaintInput`, whose `type` no longer includes `farmer_support`.
- **One spec, built**: each owner edits only their proposal in `proposals/` (`p1-kisan.openapi.json` is generated from the Kisan service; `p4-command.openapi.yaml` holds P4's own paths). `npm run contracts` joins them into `openapi.yaml` and generates `types.ts`; never edit either by hand. CI lints every file and fails if `openapi.yaml` or `types.ts` is out of date. A path belongs to one proposal; components with the same name must be identical, or the later one is renamed with its owner's prefix (P3's `ValidationError` becomes `AqiValidationError`). To use another owner's component, `$ref` it as `./p1-kisan.openapi.json#/components/schemas/…`.
- **Examples**: every response in a proposal has an example; the mock answers with them.
- **Mock**: `npm run mock` serves `openapi.yaml` with Prism on `http://127.0.0.1:4010`, checking requests against the spec (a wrong body gets a 400 or 422, a missing token a 401). Point the app at it with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4010`.
- **Still to align**: three error shapes (`ErrorEnvelope` from Command, `ErrorResponse` from air data, `{detail}` from Kisan's FastAPI). Clients should read all three until one is chosen.
