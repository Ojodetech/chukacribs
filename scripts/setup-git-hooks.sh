#!/usr/bin/env bash
# Setup git pre-commit hook for secret scanning
HOOK_DIR=".git/hooks"
PRE_COMMIT="$HOOK_DIR/pre-commit"

if [ ! -d "$HOOK_DIR" ]; then
  echo "Error: .git/hooks does not exist. Are you in a git repository?"
  exit 1
fi

cat > "$PRE_COMMIT" <<'EOF'
#!/usr/bin/env bash

# Run secret scanning before commit
if command -v git-secrets >/dev/null 2>&1; then
  git secrets --scan
else
  echo "git-secrets not installed. Install with 'brew install git-secrets' or see https://github.com/awslabs/git-secrets."
  exit 1
fi

if command -v trufflehog >/dev/null 2>&1; then
  trufflehog filesystem --depth 5 .
else
  echo "trufflehog not installed. Install with 'pip install truffleHog' or see https://github.com/trufflesecurity/trufflehog."
  exit 1
fi

# Run production secrets check on all commits
NODE_ENV=production node scripts/check-production-secrets.js

exit 0
EOF

chmod +x "$PRE_COMMIT"

echo "Pre-commit hook installed at $PRE_COMMIT"