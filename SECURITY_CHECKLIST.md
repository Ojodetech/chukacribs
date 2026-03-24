# Security Checklist

## 1. Environment Secrets (CI/Secrets Manager)
- Do NOT keep production secrets in source control.
- Use CI environment variables or secret stores:
  - JWT_SECRET
  - ADMIN_SECRET_KEY
  - MONGODB_URI
  - AFRICASTALKING_API_KEY
  - AFRICASTALKING_USERNAME
  - TEXTSMS_API_KEY
  - OPENSMS_API_PASSWORD
  - SMTP credentials (email service)
- For test/dev, set as `test-secret` via `jest.setup.js` only.

## 2. Production configuration enforcement
- `config/database.js` now includes check and error when `MONGODB_URI` missing.
- `config/auth.js` now throws in production when `JWT_SECRET` or `ADMIN_SECRET_KEY` missing.
- No fallback to hardcoded test secrets in production.

## 3. Parameter validation and sanitization
- Keep using `express-validator` for endpoints with user inputs.
- For any manual field assignment, validate length and format before writing to DB.
- Sanitize all request objects before processing to avoid injection (already done in index.js with `sanitizeMongoInput`).

## 4. Release procedure (token + param security)
- Before deploy, run audit script:
  -  `npm test -- --runInBand --silent`
  - Ensure no open handles, all DB disconnects
- Tag release only if all integration + performance tests pass.
- Include pen-test checklist:
  - Missing/weak secrets
  - No `process.env` defaults in production
  - SSO/jwt expiration and refresh not overlong

## 5. `.env*` audit
- `.env*` files must be in `.gitignore`.
- If any `.env*` file is found in the repo, delete it and rotate credentials immediately.
- Example commands to locate secrets in history (run locally):
  - `git ls-files "*.env*"`
  - `grep -R "JWT_SECRET\|ADMIN_SECRET_KEY" .`

## 6. Secret history cleanup (required)
- Use `git-filter-repo` or BFG to purge sensitive files from history (recommended).
- Ensure you **force-push** the cleaned repo once complete.

### Recommended history cleanup (run locally)
```bash
# 1) Ensure your working tree is clean and you have a backup remote branch
git checkout main
git fetch origin
git reset --hard origin/main

# 2) Remove all `.env*` files from history
# Option A (preferred): git-filter-repo
pip install --user git-filter-repo
git filter-repo --path .env --path .env.local --path .env.production --path-glob ".env.*" --invert-paths

# Option B: BFG Repo-Cleaner
# brew install bfg
# bfg --delete-files ".env" --delete-files ".env.local" --delete-files ".env.production" --delete-files "*.env.*"
# git reflog expire --expire=now --all && git gc --prune=now --aggressive

# 3) Force-push cleaned history
git push --force-with-lease origin main
```

## 7. Prevent reintroduction of secrets
- Add a pre-commit hook to scan for secrets before every commit.
- Use the provided scripts:
  - `./scripts/setup-git-hooks.sh` (Unix)
  - `./scripts/setup-git-hooks.ps1` (Windows)
- The hook runs:
  - `git-secrets --scan`
  - `trufflehog filesystem --depth 5 .`
  - `node scripts/check-production-secrets.js`

## 8. Production secret management
- Store all production secrets in a secret manager (GitHub Secrets, AWS Secrets Manager, Vault, etc.).
- Ensure no hardcoded secrets exist in any source file.
- Confirm all CI/CD workflows use `${{ secrets.<NAME> }}` values only.

## 9. Final validation checks
1. Rotate all known secrets (JWT, DB URI, SMS keys, email credentials).
2. Confirm `.env` is absent from repo and not tracked.
3. Ensure the pre-commit hook is installed for developers.
4. Verify CI fails if any secret is detected (secret scan steps are not allowed to pass silently).
