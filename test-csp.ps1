param([int]$Port = 3000)

# Test CSP Compliance
Write-Host "Testing CSP Compliance on http://localhost:$Port/landlord-login"
Write-Host ""

$maxRetries = 15
$retry = 0
$response = $null

while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/landlord-login" -TimeoutSec 2 -ErrorAction Stop
        break
    }
    catch {
        $retry++
        if ($retry -lt $maxRetries) {
            Write-Host "Waiting for server... (Retry $retry/$maxRetries)"
            Start-Sleep -Seconds 1
        }
    }
}

if ($response) {
    Write-Host "✅ Server Response: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    
    $content = $response.Content
    
    # Test 1: Check for nonce in script tags
    $hasNonce = $content -match '<script\s+src="[^"]*"\s+nonce="[a-f0-9]+'
    Write-Host "Test 1 - Nonce in scripts: $(if ($hasNonce) { 'PASS ✅' } else { 'FAIL ❌' })" -ForegroundColor $(if ($hasNonce) { 'Green' } else { 'Red' })
    
    # Test 2: Check for javascript: URLs (should not exist)
    $hasJavaScriptURL = $content -match 'javascript:'
    Write-Host "Test 2 - No javascript: URLs: $(if (!$hasJavaScriptURL) { 'PASS ✅' } else { 'FAIL ❌' })" -ForegroundColor $(if (!$hasJavaScriptURL) { 'Green' } else { 'Red' })
    
    # Test 3: Check for inline onclick (should not exist)
    $hasOnclick = $content -match '\sonclic k\s*='
    Write-Host "Test 3 - No inline onclick: $(if (!$hasOnclick) { 'PASS ✅' } else { 'FAIL ❌' })" -ForegroundColor $(if (!$hasOnclick) { 'Green' } else { 'Red' })
    
    # Test 4: Check for style=" attributes (inline styles without class)
    $hasInlineStyle = $content -match 'style\s*=\s*"[^"]*(?<!hidden)"'
    Write-Host "Test 4 - No excess inline styles: $(if (!$hasInlineStyle) { 'PASS ✅' } else { 'CHECK ⚠️' })" -ForegroundColor $(if (!$hasInlineStyle) { 'Green' } else { 'Yellow' })
    
    Write-Host ""
    Write-Host "Sample script tags with nonce:"
    Write-Host ""
    
    # Show first 2 script tags with nonce
    $matches = [regex]::Matches($content, '<script\s+src="([^"]*)"\s+nonce="([a-f0-9]+)"')
    $count = 0
    foreach ($m in $matches) {
        if ($count -lt 2) {
            Write-Host "  $($m.Groups[1].Value)" -ForegroundColor Cyan
            Write-Host "    nonce=$($m.Groups[2].Value.Substring(0, 16))..." -ForegroundColor DarkCyan
            $count++
        }
    }
    
    Write-Host ""
    Write-Host "═" * 60
    
    if ($hasNonce -and !$hasJavaScriptURL -and !$hasOnclick) {
        Write-Host "✅ CSP COMPLIANCE: PASSED" -ForegroundColor Green -BackgroundColor Black
    } else {
        Write-Host "❌ CSP COMPLIANCE: FAILED" -ForegroundColor Red -BackgroundColor Black
    }
    Write-Host "═" * 60
} else {
    Write-Host "❌ Could not connect to server after $maxRetries retries" -ForegroundColor Red
}
