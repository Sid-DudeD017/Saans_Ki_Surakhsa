$BODY = '{"type": "farm_fire", "location": {"lat": 30.266, "lon": 76.04}, "evidence": [], "description": "test"}'
$BODY_DIFF = '{"type": "farm_fire", "location": {"lat": 30.277, "lon": 76.04}, "evidence": [], "description": "diff"}'
$KEY1="test-key-$(Get-Date -UFormat %s)"
$KEY2="test-key-$(Get-Date -UFormat %s)a"
$KEY3="test-key-$(Get-Date -UFormat %s)b"

echo "a. POST with new key"
curl.exe -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY1" -d $BODY

echo "`n`nb. Same request, same key"
curl.exe -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY1" -d $BODY

echo "`n`nc. Same key, different body"
curl.exe -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY1" -d $BODY_DIFF

echo "`n`nd. No Idempotency-Key"
curl.exe -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -d $BODY

echo "`n`ne. 10 identical parallel requests with one new key"
1..10 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($k, $b)
        curl.exe -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $k" -d $b
    } -ArgumentList $KEY2, $BODY | Out-Null
}
Get-Job | Wait-Job -Timeout 15 | Receive-Job
Get-Job | Remove-Job
