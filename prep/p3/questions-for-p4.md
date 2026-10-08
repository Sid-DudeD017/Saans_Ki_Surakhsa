# Questions for P4

1. **Unified Spec**: Where will the unified OpenAPI specification live once all proposals are combined?
2. **Merge Process**: Who is responsible for merging the individual proposal specs (`packages/contracts/proposals/*.openapi.json`) into the main contract?
3. **Local Dev Setup**: When will the `infra/template.yaml` and mock fixtures be available so we can start testing against the local environment?
4. **Wind Data**: Does the wind object (speed, direction) belong in `GET /v1/aqi`, or should we expose it in a separate weather endpoint (e.g., `GET /v1/weather`)?
5. **AqiCategory enum casing and naming**: The current enum values are `"Good", "Satisfactory", "Moderately polluted", "Poor", "Very poor", "Severe"`. This needs to be agreed with P2 and P4. Suggest: use stable lowercase codes (`good`, `satisfactory`, `moderate`, `poor`, `very_poor`, `severe`) as the wire value, and keep display labels (with mixed case and spaces) as a separate UI concern. This avoids P2's map and P4's command dashboard silently breaking if someone changes capitalisation later.
