#!/usr/bin/env bash
# G5 smoke test, one command: `npm run smoke:intake`.
# Starts the local stack (PostGIS + LocalStack) and the app, then over HTTP: gets a presigned upload,
# PUTs a photo to S3, files a farm-fire complaint, and waits for its case row in PostGIS.
# Uses an app already running at SMOKE_URL if there is one; otherwise starts `next dev` on port 3100.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f infra/compose.yaml)
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
sql() { "${COMPOSE[@]}" exec -T postgis psql -U saans -d saans -tA -F ' | ' -c "$1"; }

say "local stack"
"${COMPOSE[@]}" up -d --wait

if ! curl -s -o /dev/null "$URL/v1/complaints" -X OPTIONS; then
  say "starting the app on port $PORT"
  npx next dev -p "$PORT" >"$WORK/next.log" 2>&1 &
  DEV_PID=$!
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "$URL" && break
    sleep 1
  done
  curl -s -o /dev/null "$URL" || { cat "$WORK/next.log"; fail "the app didn't start"; }
fi

say "POST /v1/uploads"
head -c 4096 /dev/urandom >"$WORK/photo.jpg"
SHA=$(shasum -a 256 "$WORK/photo.jpg" | cut -d' ' -f1)
SIZE=$(wc -c <"$WORK/photo.jpg" | tr -d ' ')
curl -sf -X POST "$URL/v1/uploads" -H 'content-type: application/json' \
  -d "{\"media_type\":\"image/jpeg\",\"byte_size\":$SIZE,\"sha256\":\"$SHA\"}" >"$WORK/upload.json" \
  || fail "POST /v1/uploads: $(cat "$WORK/upload.json" 2>/dev/null)"
KEY=$(jq -r .object_key "$WORK/upload.json")
echo "object_key $KEY, expires $(jq -r .expires_at "$WORK/upload.json")"

say "PUT the photo to S3"
HEADERS=()
while IFS=$'\t' read -r name value; do HEADERS+=(-H "$name: $value"); done < <(jq -r '.headers | to_entries[] | [.key, .value] | @tsv' "$WORK/upload.json")
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "${HEADERS[@]}" --data-binary @"$WORK/photo.jpg" "$(jq -r .upload_url "$WORK/upload.json")")
[ "$STATUS" = 200 ] || fail "S3 answered $STATUS to the presigned PUT"
echo "S3 200"

say "POST /v1/complaints"
IDEM="smoke-$(date +%s)-$RANDOM"
BODY=$(jq -n --arg key "$KEY" --arg sha "$SHA" '{
  type: "farm_fire", location: {lat: 30.266, lon: 76.04}, description: "Smoke test: smoke over the field by the canal",
  evidence: [{object_key: $key, media_type: "image/jpeg", hash: $sha, captured_timestamp: "2026-10-23T13:58:00+05:30"}]}')
curl -s -X POST "$URL/v1/complaints" -H 'content-type: application/json' -H "Idempotency-Key: $IDEM" -d "$BODY" >"$WORK/complaint.json"
ID=$(jq -r '.id // empty' "$WORK/complaint.json")
[ -n "$ID" ] || fail "POST /v1/complaints: $(cat "$WORK/complaint.json")"
echo "complaint $ID ($(jq -r .status "$WORK/complaint.json"))"

AGAIN=$(curl -s -X POST "$URL/v1/complaints" -H 'content-type: application/json' -H "Idempotency-Key: $IDEM" -d "$BODY" | jq -r .id)
[ "$AGAIN" = "$ID" ] || fail "the retry got $AGAIN, not $ID"
echo "retry with the same Idempotency-Key: same complaint"

say "case row in PostGIS"
for _ in $(seq 1 40); do
  [ "$(sql "SELECT count(*) FROM cases WHERE complaint_id = '$ID'")" = 1 ] && break
  sleep 0.5
done
[ "$(sql "SELECT count(*) FROM cases WHERE complaint_id = '$ID'")" = 1 ] || {
  sql "SELECT state, event, detail FROM workflow_events WHERE complaint_id = '$ID' ORDER BY id"
  fail "no case for $ID"
}
sql "SELECT id, type, status, verification_status, array_to_string(authorities, ' + '), deadline, evidence_summary FROM cases WHERE complaint_id = '$ID'"
[ "$(sql "SELECT count(*) FROM complaints WHERE idempotency_key = '$IDEM'")" = 1 ] || fail "the retry added a complaint"
echo
echo "SMOKE PASSED: complaint $ID is one case in PostGIS"
