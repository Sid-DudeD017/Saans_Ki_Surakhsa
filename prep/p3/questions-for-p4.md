# Questions for P4

1. **Unified Spec**: Where will the unified OpenAPI specification live once all proposals are combined?
   - **Answer**: Unified OpenAPI lives at `packages/contracts/openapi.yaml`.

2. **Merge Process**: Who is responsible for merging the individual proposal specs (`packages/contracts/proposals/*.openapi.json`) into the main contract?
   - **Answer**: P4 owns integration into the unified contract; P1/P3 proposal specs remain reviewed inputs.

3. **Local Dev Setup**: When will the `infra/template.yaml` and mock fixtures be available so we can start testing against the local environment?
   - **Answer**: `infra/template.yaml` and canonical local mock fixtures are a Stage 2 deliverable after G1 contract freeze.

4. **Wind Data**: Does the wind object (speed, direction) belong in `GET /v1/aqi`, or should we expose it in a separate weather endpoint (e.g., `GET /v1/weather`)?
   - **Answer**: Wind belongs inside `GET /v1/aqi`.

5. **AqiCategory enum casing and naming**: The current enum values are `"Good", "Satisfactory", "Moderately polluted", "Poor", "Very poor", "Severe"`. This needs to be agreed with P2 and P4. Suggest: use stable lowercase codes (`good`, `satisfactory`, `moderate`, `poor`, `very_poor`, `severe`) as the wire value, and keep display labels (with mixed case and spaces) as a separate UI concern. This avoids P2's map and P4's command dashboard silently breaking if someone changes capitalisation later.
   - **Answer**: AQI uses the lowercase wire codes listed above.
