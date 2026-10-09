$KEY="test-key-$(Get-Date -UFormat %s)"
$BODY='{\"type\": \"farm_fire\", \"location\": {\"lat\": 30.266, \"lon\": 76.04}, \"evidence\": [], \"description\": \"test\"}'
$BODY_DIFF='{\"type\": \"farm_fire\", \"location\": {\"lat\": 30.277, \"lon\": 76.04}, \"evidence\": [], \"description\": \"diff\"}'

echo "3a" > prep\g6-test\03-idempotency.txt
curl.exe -s -i -X POST http://localhost:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY >> prep\g6-test\03-idempotency.txt

echo "`n3b" >> prep\g6-test\03-idempotency.txt
curl.exe -s -i -X POST http://localhost:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY >> prep\g6-test\03-idempotency.txt

echo "`n3c" >> prep\g6-test\03-idempotency.txt
curl.exe -s -i -X POST http://localhost:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY_DIFF >> prep\g6-test\03-idempotency.txt

echo "`n3d" >> prep\g6-test\03-idempotency.txt
curl.exe -s -i -X POST http://localhost:3100/v1/complaints -H "Content-Type: application/json" -d $BODY >> prep\g6-test\03-idempotency.txt

echo "`n3e" >> prep\g6-test\03-idempotency.txt
$KEY2="test-key2-$(Get-Date -UFormat %s)"
1..10 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($k, $b)
        curl.exe -s -i -X POST http://localhost:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $k" -d $b
    } -ArgumentList $KEY2, $BODY | Out-Null
}
Get-Job | Wait-Job | Receive-Job >> prep\g6-test\03-idempotency.txt
Get-Job | Remove-Job
