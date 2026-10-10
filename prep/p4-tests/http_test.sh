#!/usr/bin/env bash
set -e

URL="http://127.0.0.1:3000/v1/tickets"
IDEM="http-test-$(date +%s)-$RANDOM"

echo "=== 1. Create Ticket (201) ==="
RES=$(curl.exe -s -w "%{http_code}" -X POST "$URL" -H "content-type: application/json" -d "{\"type\":\"garbage\",\"district\":\"Sangrur\",\"reporter_identity\":\"citizen-1\",\"reporter_consent\":true,\"idempotency_key\":\"$IDEM\"}")
STATUS=${RES: -3}
BODY=${RES:0:${#RES}-3}
echo "Status: $STATUS"
echo "Body: $BODY"
TICKET_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d: -f2 | tr -d '"')

# === 2. Add Internal Note ===
echo -e "\n=== 2. Add Internal Note ==="
curl.exe -s -w "\nStatus: %{http_code}" -X POST "$URL/$TICKET_ID/note" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"reason":"Secret note"}'

echo -e "\n\n=== 3. Citizen GET vs Officer GET ==="
echo "Citizen (No Auth) [Expect 401]:"
curl.exe -s -w "\nStatus: %{http_code}" -X GET "$URL/$TICKET_ID"
echo -e "\n\nCitizen (Wrong Auth) [Expect 403]:"
curl.exe -s -w "\nStatus: %{http_code}" -X GET "$URL/$TICKET_ID" -H "x-user-id: citizen-2"
echo -e "\n\nCitizen (Valid Auth) [Expect 200, no internal notes]:"
curl.exe -s -X GET "$URL/$TICKET_ID" -H "x-user-id: citizen-1"
echo -e "\n\nOfficer (Auth) [Expect 200, internal notes]:"
curl.exe -s -X GET "$URL/$TICKET_ID" -H "Authorization: Bearer officer-1"

echo -e "\n\n=== 4. Full Lifecycle & History ==="
curl.exe -s -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"under_review"}' > /dev/null
curl.exe -s -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"assigned"}' > /dev/null
curl.exe -s -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"in_progress"}' > /dev/null
curl.exe -s -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"awaiting_information"}' > /dev/null
curl.exe -s -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"in_progress"}' > /dev/null
curl.exe -s -X POST "$URL/$TICKET_ID/resolve" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"summary":"All done!"}' > /dev/null
curl.exe -s -X POST "$URL/$TICKET_ID/citizen_confirm" -H "content-type: application/json" -H "x-user-id: citizen-1" -d '{}' > /dev/null

echo "Ticket after full lifecycle (closed):"
curl.exe -s -X GET "$URL/$TICKET_ID" -H "x-user-id: citizen-1"

# To get the history we need to fetch from the DB directly in the test script, or we expose an endpoint. Wait! The prompt says "Print the status history with timestamps and actors". Since there is no endpoint, I will use psql to dump the history for this ticket.
echo -e "\n\nHistory:"
cat << 'EOF' > get_history.js
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query("SELECT created_at, actor, action, previous_hash, entry_hash, before_state->>'status' as before, after_state->>'status' as after FROM audit_log WHERE ticket_id = $1 ORDER BY created_at ASC", [process.argv[2]])
  .then(res => {
    console.table(res.rows);
    process.exit(0);
  });
EOF
node get_history.js "$TICKET_ID"
rm get_history.js

echo -e "\n\nStatus History:"
cat << 'EOF' > get_status_history.js
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.SAANS_DATABASE_URL });
pool.query("SELECT created_at, status, changed_by, reason FROM status_history WHERE case_id = $1 ORDER BY created_at ASC", [process.argv[2]])
  .then(res => {
    console.table(res.rows);
    process.exit(0);
  });
EOF
node get_status_history.js "$TICKET_ID"
rm get_status_history.js
echo "Try to reopen CLOSED (Expect 409):"
curl.exe -s -w "\nStatus: %{http_code}" -X POST "$URL/$TICKET_ID/citizen_reopen" -H "content-type: application/json" -H "x-user-id: citizen-1" -d '{"reason":"issue still exists"}'

echo -e "\n\nMove back to RESOLVED by Officer to test proper reopen:"
curl.exe -s -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"resolved"}' > /dev/null

echo -e "\nTry to reopen RESOLVED (Expect 200):"
curl.exe -s -w "\nStatus: %{http_code}" -X POST "$URL/$TICKET_ID/citizen_reopen" -H "content-type: application/json" -H "x-user-id: citizen-1" -d '{"reason":"issue still exists"}'

echo -e "\n\nOfficer reviews the reopened ticket (moved to under_review):"
curl.exe -s -w "\nStatus: %{http_code}" -X POST "$URL/$TICKET_ID/update_status" -H "content-type: application/json" -H "Authorization: Bearer officer-1" -d '{"status":"under_review"}'

