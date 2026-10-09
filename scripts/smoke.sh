#!/usr/bin/env bash
# G6 Golden Path integration smoke test: `npm run smoke` (or bash scripts/smoke.sh).
# Verifies the full user journey:
#   Air data (/v1/aqi) -> Fire tracking (/v1/fires) -> Shala advisory (/v1/schools/{id}/advisory)
#   -> Shala UI (/shala) -> Complaint report intake (/v1/complaints)
#   -> Command (P4): a farmer files for help -> a citizen reports a fire nearby -> the case links to the
#      farmer's request -> Cedar keeps other districts out -> a second report merges -> the officer sends
#      the machine. Runs CI's golden-path job (.github/workflows/ci.yml) on PostGIS and LocalStack.
# Uses an app already running at SMOKE_URL if there is one; otherwise starts the app on port 3100.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-3100}"
URL="${SMOKE_URL:-http://127.0.0.1:$PORT}"
WORK="$(mktemp -d)"
DEV_PID=""

cleanup() {
  [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

say() { printf '\n== %s\n' "$*"; }
fail() { printf '\nSMOKE FAILED: %s\n' "$*" >&2; exit 1; }

# Optional: start local stack (PostGIS + LocalStack) if Docker daemon is available
COMPOSE=(docker compose -f infra/compose.yaml)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  say "checking local stack"
  "${COMPOSE[@]}" up -d --wait || true
fi

# Ensure app is running
if ! curl -s -o /dev/null "$URL" 2>/dev/null; then
  say "starting app on port $PORT"
  npx next dev -p "$PORT" >"$WORK/next.log" 2>&1 &
  DEV_PID=$!
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "$URL" 2>/dev/null && break
    sleep 1
  done
  curl -s -o /dev/null "$URL" 2>/dev/null || { cat "$WORK/next.log" 2>/dev/null || true; fail "the app did not start"; }
fi

say "1. App Shell (GET /)"
ROOT_STATUS=$(curl -s -o "$WORK/root.html" -w "%{http_code}" "$URL/")
[ "$ROOT_STATUS" = "200" ] || fail "GET / returned $ROOT_STATUS"
grep -q "Saans" "$WORK/root.html" || fail "GET / did not contain 'Saans'"
echo "OK (200)"

say "2. Saans Shala Module UI (GET /shala)"
SHALA_STATUS=$(curl -s -o "$WORK/shala.html" -w "%{http_code}" "$URL/shala")
[ "$SHALA_STATUS" = "200" ] || fail "GET /shala returned $SHALA_STATUS"
grep -qi "Saans Shala" "$WORK/shala.html" || grep -qi "Air Buddy" "$WORK/shala.html" || grep -qi "shala" "$WORK/shala.html" || fail "GET /shala did not render Shala UI content"
echo "OK (200)"

say "3. Air Data API (GET /v1/aqi?lat=30.245&lon=75.842)"
AQI_STATUS=$(curl -s -o "$WORK/aqi.json" -w "%{http_code}" "$URL/v1/aqi?lat=30.245&lon=75.842")
[ "$AQI_STATUS" = "200" ] || fail "GET /v1/aqi returned $AQI_STATUS: $(cat "$WORK/aqi.json" 2>/dev/null)"
AQI_VAL=$(jq -r '.aqi // empty' "$WORK/aqi.json" 2>/dev/null || grep -o '"aqi":[0-9]*' "$WORK/aqi.json" | cut -d: -f2)
[ -n "$AQI_VAL" ] || fail "GET /v1/aqi response missing 'aqi' field"
echo "OK (200, aqi=$AQI_VAL)"

say "4. School Advisory API (GET /v1/schools/school_demo_001/advisory)"
ADV_STATUS=$(curl -s -o "$WORK/advisory.json" -w "%{http_code}" "$URL/v1/schools/school_demo_001/advisory")
[ "$ADV_STATUS" = "200" ] || fail "GET /v1/schools/school_demo_001/advisory returned $ADV_STATUS: $(cat "$WORK/advisory.json" 2>/dev/null)"
STAGE=$(jq -r '.grap_stage // empty' "$WORK/advisory.json" 2>/dev/null || grep -o '"grap_stage":"[^"]*"' "$WORK/advisory.json" | cut -d: -f2 | tr -d '"')
[ -n "$STAGE" ] || fail "School advisory response missing 'grap_stage'"
echo "OK (200, grap_stage=$STAGE)"

say "5. Upwind Fire Detection API (GET /v1/fires?lat=30.245&lon=75.842&radius_km=25)"
FIRES_STATUS=$(curl -s -o "$WORK/fires.json" -w "%{http_code}" "$URL/v1/fires?lat=30.245&lon=75.842&radius_km=25")
if [ "$FIRES_STATUS" = "200" ]; then
  echo "OK (200)"
elif [ "$FIRES_STATUS" = "503" ]; then
  ERR_CODE=$(jq -r '.error.code // empty' "$WORK/fires.json" 2>/dev/null || grep -o '"code":"[^"]*"' "$WORK/fires.json" | cut -d: -f2 | tr -d '"')
  [ "$ERR_CODE" = "sources_unavailable" ] || fail "Expected error.code 'sources_unavailable', got: $(cat "$WORK/fires.json")"
  echo "OK (503 sources_unavailable, NASA FIRMS key not set; graceful contract fallback)"
else
  fail "GET /v1/fires returned unexpected status $FIRES_STATUS: $(cat "$WORK/fires.json")"
fi

say "6. Incident Complaint Intake API (POST /v1/complaints)"
IDEM="smoke-golden-$(date +%s)-$RANDOM"
COMPLAINT_BODY='{"type":"farm_fire","location":{"lat":30.245,"lon":75.842},"description":"Golden path smoke test: smoke reported near school perimeter","evidence":[]}'

POST_STATUS=$(curl -s -o "$WORK/complaint.json" -w "%{http_code}" -X POST "$URL/v1/complaints" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: $IDEM" \
  -d "$COMPLAINT_BODY")

if [ "$POST_STATUS" = "201" ]; then
  CID=$(jq -r '.id // empty' "$WORK/complaint.json" 2>/dev/null || grep -o '"id":"[^"]*"' "$WORK/complaint.json" | cut -d: -f2 | tr -d '"')
  [ -n "$CID" ] || fail "POST /v1/complaints returned 201 but missing complaint id"
  echo "OK (201, complaint_id=$CID)"

  # Verify idempotency: retrying with the exact same Idempotency-Key returns the same complaint ID
  RETRY_STATUS=$(curl -s -o "$WORK/retry.json" -w "%{http_code}" -X POST "$URL/v1/complaints" \
    -H "content-type: application/json" \
    -H "Idempotency-Key: $IDEM" \
    -d "$COMPLAINT_BODY")
  [ "$RETRY_STATUS" = "201" ] || fail "Retry with same Idempotency-Key returned HTTP $RETRY_STATUS, expected 201"
  RETRY_CID=$(jq -r '.id // empty' "$WORK/retry.json" 2>/dev/null || grep -o '"id":"[^"]*"' "$WORK/retry.json" | cut -d: -f2 | tr -d '"')
  [ "$RETRY_CID" = "$CID" ] || fail "Retry with same Idempotency-Key returned id $RETRY_CID, expected $CID"
  echo "OK (Idempotency verified: unchanged retry returned same complaint $CID)"
elif [ "$POST_STATUS" = "503" ] && [ "${SMOKE_MODE:-full}" = "degraded" ]; then
  # Degraded mode: explicitly requested via SMOKE_MODE=degraded when docker/PostGIS is unavailable.
  ERR_CODE=$(jq -r '.error.code // empty' "$WORK/complaint.json" 2>/dev/null || grep -o '"code":"[^"]*"' "$WORK/complaint.json" | cut -d: -f2 | tr -d '"')
  [ "$ERR_CODE" = "unavailable" ] || fail "Expected error.code 'unavailable', got: $(cat "$WORK/complaint.json")"
  echo "OK (DEGRADED MODE: 503 unavailable, local stack offline but error envelope valid)"
else
  fail "POST /v1/complaints failed with status $POST_STATUS: $(cat "$WORK/complaint.json" 2>/dev/null). Local stack dependency (PostGIS/LocalStack) is required for full golden path. Start the stack with 'npm run stack' or set SMOKE_MODE=degraded for offline envelope checks."
fi

if [ "${SMOKE_MODE:-full}" != "degraded" ]; then
  # ---- Command (P4): help before penalty, end to end over HTTP ----
  SDM="Authorization: Bearer local-officer-sangrur"      # demo identities, infra/config/officers.local.json
  PATIALA="Authorization: Bearer local-officer-patiala"
  STATE="Authorization: Bearer local-state-command"
  # Somewhere new in Sangrur each run, so earlier runs' reports (150 m, 6 h) don't merge with this one.
  FARM_LAT=$(awk -v r="$RANDOM" 'BEGIN { printf "%.5f", 30.10 + r / 32768 * 0.20 }')
  FARM_LON=$(awk -v r="$RANDOM" 'BEGIN { printf "%.5f", 75.75 + r / 32768 * 0.30 }')
  near() { awk -v a="$1" -v m="$2" 'BEGIN { printf "%.6f", a + m / 111195 }'; } # m metres north

  file_complaint() { # body file -> complaint id
    local out="$WORK/filed.json"
    local status
    status=$(curl -s -o "$out" -w "%{http_code}" -X POST "$URL/v1/complaints" -H "content-type: application/json" \
      -H "Idempotency-Key: smoke-p4-$(date +%s)-$RANDOM" --data @"$1")
    [ "$status" = "201" ] || fail "POST /v1/complaints ($1) returned $status: $(cat "$out")"
    jq -r .id "$out"
  }

  case_for() { # complaint id -> case id, waiting for the workflow (pages through the state queue)
    for _ in $(seq 1 40); do
      local cursor="" found=""
      while :; do
        curl -s -H "$STATE" "$URL/v1/cases?limit=100${cursor:+&cursor=$cursor}" >"$WORK/queue.json"
        found=$(jq -r --arg id "$1" '.cases[] | select(.case.incidentReportId == $id) | .case.id' "$WORK/queue.json")
        cursor=$(jq -r '.next_cursor // empty' "$WORK/queue.json")
        [ -n "$found" ] || [ -z "$cursor" ] && break
      done
      [ -n "$found" ] && { echo "$found"; return; }
      sleep 0.5
    done
    fail "no case for complaint $1"
  }

  say "7. Farmer files for help (Kisan Saathi's farmer_support complaint)"
  HELP_ID="kisan-smoke-$(date +%s)-$RANDOM"
  jq --arg id "$HELP_ID" --argjson lat "$FARM_LAT" --argjson lon "$FARM_LON" --arg key "smoke-$RANDOM$RANDOM" '
    .components.schemas.FarmerSupportComplaint.examples[0]
    | .location = {lat: $lat, lon: $lon}
    | .help_request.id = $id | .help_request.farmLocation = {lat: $lat, lon: $lon}
    | .support_request.idempotency_key = $key | .support_request.farm.lat = $lat | .support_request.farm.lon = $lon' \
    packages/contracts/proposals/p1-kisan.openapi.json >"$WORK/farmer.json"
  HELP_CASE=$(case_for "$(file_complaint "$WORK/farmer.json")")
  echo "OK (help request $HELP_ID, case $HELP_CASE)"

  say "8. A citizen reports a farm fire 300 m away; the case links to the farmer's open request"
  FIRE_LAT=$(near "$FARM_LAT" 300)
  jq -n --argjson lat "$FIRE_LAT" --argjson lon "$FARM_LON" \
    '{type: "farm_fire", location: {lat: $lat, lon: $lon}, description: "Golden path smoke test: smoke over the paddy", evidence: []}' >"$WORK/fire.json"
  FIRE_COMPLAINT=$(file_complaint "$WORK/fire.json")
  FIRE_CASE=$(case_for "$FIRE_COMPLAINT")
  curl -s -H "$SDM" "$URL/v1/cases/$FIRE_CASE" >"$WORK/case.json"
  jq -e --arg id "$HELP_ID" '.case.helpRequestId == $id and .helpRequest.status == "OPEN" and .report.district == "Sangrur"
    and (.helpLink.distanceMeters | . > 250 and . < 350) and (.case.recommendationReason | contains("acres still need"))' "$WORK/case.json" >/dev/null \
    || fail "the fire case doesn't show the farmer's open help request first: $(cat "$WORK/case.json")"
  echo "OK (case $FIRE_CASE, $(jq -r .helpLink.distanceMeters "$WORK/case.json") m from the farm, machine $(jq -r '.recommendedMachine.id // "none free"' "$WORK/case.json"))"

  say "9. Cedar: no sign-in is 401, another district's officer is 403"
  [ "$(curl -s -o /dev/null -w "%{http_code}" "$URL/v1/cases/$FIRE_CASE")" = 401 ] || fail "an unsigned request wasn't refused with 401"
  [ "$(curl -s -o /dev/null -w "%{http_code}" -H "$PATIALA" "$URL/v1/cases/$FIRE_CASE")" = 403 ] || fail "the Patiala officer could open a Sangrur case"
  curl -s -H "$PATIALA" "$URL/v1/cases?limit=100" | jq -e --arg id "$FIRE_CASE" 'all(.cases[]; .case.id != $id)' >/dev/null || fail "the Patiala queue lists a Sangrur case"
  echo "OK (401 unsigned, 403 for Patiala, absent from Patiala's queue)"

  say "10. A second report of the same fire, 100 m away, merges into the case"
  jq -n --argjson lat "$(near "$FIRE_LAT" 100)" --argjson lon "$FARM_LON" \
    '{type: "farm_fire", location: {lat: $lat, lon: $lon}, description: "Golden path smoke test: same fire, seen from the road", evidence: []}' >"$WORK/fire2.json"
  file_complaint "$WORK/fire2.json" >/dev/null
  for _ in $(seq 1 40); do
    [ "$(curl -s -H "$SDM" "$URL/v1/cases/$FIRE_CASE" | jq -r .reports)" = 2 ] && break
    sleep 0.5
  done
  [ "$(curl -s -H "$SDM" "$URL/v1/cases/$FIRE_CASE" | jq -r .reports)" = 2 ] || fail "the second report didn't merge into $FIRE_CASE"
  echo "OK (case $FIRE_CASE has 2 reports)"

  say "11. The Sangrur officer sends the machine; the farmer's request is matched"
  VERSION=$(curl -s -H "$SDM" "$URL/v1/cases/$FIRE_CASE" | jq -r .case.version)
  jq -n --argjson v "$VERSION" '{action: "APPROVE", selectedMachineId: "demo-chc-c:happy_seeder",
    reason: "Golden path smoke test: send the machine before any penalty", previousCaseVersion: $v}' >"$WORK/approve.json"
  act() { curl -s -o "$WORK/act.json" -w "%{http_code}" -X POST -H "$1" -H "content-type: application/json" --data @"$WORK/approve.json" "$URL/v1/cases/$FIRE_CASE/actions"; }
  [ "$(act "$PATIALA")" = 403 ] || fail "the Patiala officer could act on a Sangrur case: $(cat "$WORK/act.json")"
  ACT_STATUS=$(act "$SDM")
  { [ "$ACT_STATUS" = 200 ] && jq -e '.status == "ACTION_APPROVED"' "$WORK/act.json" >/dev/null; } || fail "APPROVE returned $ACT_STATUS: $(cat "$WORK/act.json")"
  curl -s -H "$SDM" "$URL/v1/cases/$FIRE_CASE" >"$WORK/case.json"
  jq -e '.helpRequest.status == "MATCHED" and (.decisions | map(.action) | index("APPROVE")) != null and (.decisions[-1].officerId == "officer-sangrur")' "$WORK/case.json" >/dev/null \
    || fail "after APPROVE the help request isn't matched: $(cat "$WORK/case.json")"
  echo "OK (ACTION_APPROVED by officer-sangrur, help request MATCHED)"
fi

if [ "${SMOKE_MODE:-full}" = "degraded" ]; then
  printf '\n=============================================\n'
  printf 'GOLDEN PATH SMOKE TEST PASSED (DEGRADED MODE):\n'
  printf '  ✓ Web Shell (/)\n'
  printf '  ✓ Saans Shala (/shala)\n'
  printf '  ✓ Air Quality API (/v1/aqi)\n'
  printf '  ✓ School Advisory API (/v1/schools/school_demo_001/advisory)\n'
  printf '  ✓ Fire Tracking API (/v1/fires)\n'
  printf '  ⚠ Incident Intake API (/v1/complaints - local stack offline)\n'
  printf '=============================================\n\n'
else
  printf '\n=============================================\n'
  printf 'GOLDEN PATH SMOKE TEST PASSED (FULL STACK):\n'
  printf '  ✓ Web Shell (/)\n'
  printf '  ✓ Saans Shala (/shala)\n'
  printf '  ✓ Air Quality API (/v1/aqi)\n'
  printf '  ✓ School Advisory API (/v1/schools/school_demo_001/advisory)\n'
  printf '  ✓ Fire Tracking API (/v1/fires)\n'
  printf '  ✓ Incident Intake API (/v1/complaints + Idempotency)\n'
  printf '  ✓ Command: farmer files -> fire reported -> linked case -> 401/403 -> merge -> machine sent\n'
  printf '=============================================\n\n'
fi
