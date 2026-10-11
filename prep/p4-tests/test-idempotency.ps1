$URL = "http://localhost:3000/v1/complaints"
$IDEM = "test-idempotency-key"
$BODY = '{"type":"garbage","location":{"lat":30.245,"lon":75.842},"description":"Test idempotency parallel requests","evidence":[]}'
$HEADERS = @{
    "Content-Type" = "application/json"
    "Idempotency-Key" = $IDEM
}

# Run 10 parallel requests
$jobs = @()
for ($i = 0; $i -lt 10; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($url, $headers, $body)
        try {
            $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
            return @{
                StatusCode = $response.StatusCode
                Content = $response.Content
            }
        } catch {
            return @{
                StatusCode = $_.Exception.Response.StatusCode.value__
                Content = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
            }
        }
    } -ArgumentList $URL, $HEADERS, $BODY
}

Wait-Job $jobs | Out-Null
$results = Receive-Job $jobs
Remove-Job $jobs

Write-Host "--- PARALLEL RESULTS ---"
$results | ForEach-Object {
    Write-Host "Status: $($_.StatusCode) - Body: $($_.Content)"
}

Write-Host "`n--- TESTING MISSING KEY ---"
$HEADERS_NO_KEY = @{
    "Content-Type" = "application/json"
}
try {
    $r = Invoke-WebRequest -Uri $URL -Method Post -Headers $HEADERS_NO_KEY -Body $BODY -UseBasicParsing -TimeoutSec 10
    Write-Host "Status: $($r.StatusCode) - Body: $($r.Content)"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__) - Body: $([System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd())"
}

Write-Host "`n--- TESTING DIFFERENT BODY ---"
$BODY_DIFF = '{"type":"garbage","location":{"lat":30.245,"lon":75.842},"description":"Different body","evidence":[]}'
try {
    $r2 = Invoke-WebRequest -Uri $URL -Method Post -Headers $HEADERS -Body $BODY_DIFF -UseBasicParsing -TimeoutSec 10
    Write-Host "Status: $($r2.StatusCode) - Body: $($r2.Content)"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__) - Body: $([System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd())"
}

# We also need to query the database to show exactly one complaint row and one case.
# (We can just run a psql command or use curl if there's a GET cases API, but cases are in the DB)
