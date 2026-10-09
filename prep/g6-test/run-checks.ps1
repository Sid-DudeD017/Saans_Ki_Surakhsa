function Get-Count {
    $result = docker exec saans-postgis-1 psql -U saans -d saans -t -c "SELECT count(*) FROM complaints;"
    return $result.Trim()
}

echo "Initial count: $(Get-Count)"

$KEY="test-key-$(Get-Date -UFormat %s)"
$BODY='{\"type\": \"farm_fire\", \"location\": {\"lat\": 30.266, \"lon\": 76.04}, \"evidence\": [], \"description\": \"test\"}'
$BODY_DIFF='{\"type\": \"farm_fire\", \"location\": {\"lat\": 30.277, \"lon\": 76.04}, \"evidence\": [], \"description\": \"diff\"}'

echo "Seeding case with key $KEY..."
curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY | Out-Null
echo "Count before (c): $(Get-Count)"

echo "Testing (c) same key different body..."
curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d $BODY_DIFF
echo "`nCount after (c): $(Get-Count)"

echo "Testing (d) no idempotency key..."
curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -d $BODY
echo "`nCount after (d): $(Get-Count)"

$KEY2="test-key2-$(Get-Date -UFormat %s)"
echo "Testing (e) 10 parallel requests with key $KEY2..."
1..10 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($k, $b)
        curl.exe --max-time 10 -s -i -X POST http://127.0.0.1:3100/v1/complaints -H "Content-Type: application/json" -H "Idempotency-Key: $k" -d $b
    } -ArgumentList $KEY2, $BODY | Out-Null
}
Get-Job | Wait-Job -Timeout 15 | Receive-Job
echo "`nCount after (e): $(Get-Count)"
Get-Job | Remove-Job
