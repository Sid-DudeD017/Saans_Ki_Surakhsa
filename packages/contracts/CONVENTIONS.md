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
