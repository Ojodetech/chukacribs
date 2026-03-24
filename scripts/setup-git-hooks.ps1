# Setup Git pre-commit hook for secret scanning (PowerShell)
$hookDir = ".git\hooks"
$preCommit = Join-Path $hookDir "pre-commit"

if (-not (Test-Path $hookDir)) {
  Write-Error "Error: $hookDir does not exist. Are you in a git repository?"
  exit 1
}

$hookContent = @'
#!/usr/bin/env pwsh

# Run secret scanning before commit
if (Get-Command git-secrets -ErrorAction SilentlyContinue) {
  git secrets --scan
} else {
  Write-Error "git-secrets not installed. Install it (https://github.com/awslabs/git-secrets)."
  exit 1
}

if (Get-Command trufflehog -ErrorAction SilentlyContinue) {
  trufflehog filesystem --depth 5 .
} else {
  Write-Error "trufflehog not installed. Install it (https://github.com/trufflesecurity/trufflehog)."
  exit 1
}

# Validate required production secrets in environment
$env:NODE_ENV = 'production'
node scripts/check-production-secrets.js

exit 0
'@

Set-Content -Path $preCommit -Value $hookContent -Force -Encoding UTF8

# Make the hook executable when checked out on Unix
if (Test-Path "/usr/bin/chmod") {
  & chmod +x $preCommit
}

Write-Host "Pre-commit hook installed at $preCommit"