#!/bin/bash
KEY="test-key-$(date +%s)"
BODY='{"type": "farm_fire", "location": {"lat": 30.266, "lon": 76.04}, "evidence": [], "description": "test"}'
BODY_DIFF='{"type": "farm_fire", "location": {"lat": 30.277, "lon": 76.04}, "evidence": [], "description": "diff"}'

echo "Testing (c) same key different body..."
curl --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d "$BODY" > /dev/null
curl --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d "$BODY_DIFF"

echo -e "\nTesting (d) no idempotency key..."
curl --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -d "$BODY"

echo -e "\nTesting (e) 10 parallel requests..."
KEY2="test-key2-$(date +%s)"
for i in {1..10}; do
  curl --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY2" -d "$BODY" &
done
wait
