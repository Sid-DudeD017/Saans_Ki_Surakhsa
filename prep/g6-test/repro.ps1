$BODY='{"type": "farm_fire", "location": {"lat": 30.266, "lon": 76.04}, "evidence": [], "description": "test"}'
$BODY_DIFF='{"type": "farm_fire", "location": {"lat": 30.277, "lon": 76.04}, "evidence": [], "description": "diff"}'
$KEY="repro-key-$(Get-Date -UFormat %s)"

echo "Testing (d) no idempotency key..."
curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -d $BODY

echo "Seeding case with key $KEY..."
curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY

echo "Testing (c) same key different body..."
curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY_DIFF

echo "Testing (e) 10 parallel requests..."
$KEY2="repro-key2-$(Get-Date -UFormat %s)"
1..10 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($k, $b)
        curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $k" -d $b
    } -ArgumentList $KEY2, $BODY | Out-Null
}
Get-Job | Wait-Job -Timeout 15 | Receive-Job
Get-Job | Remove-Job
