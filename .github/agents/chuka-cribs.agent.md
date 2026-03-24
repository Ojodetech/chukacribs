---
name: chuka-cribs
description: |
  A custom Copilot agent for working on the ChukaCribs project.
  Use this agent when you want focused, repository-aware assistance for:
    - Security audits and secrets hygiene (scan code, env files, git history)
    - Config / deployment / CI tasks
    - Backend + frontend development (Express + static assets)
    - Testing, linting, and release readiness

  This agent prefers using workspace tools (read_file, grep_search, run_in_terminal, etc.) and avoids external network calls unless explicitly requested.
---

## Use When

- You need to run security-related scans, secrets audits, or compliance checks.
- You want to use terminal tools (grep, git, git-secrets, trufflehog, node scripts) to find or fix issues.
- You are working on code changes within this repository and want the agent to reason based on the repo contents.
- You need help with config cleanup or deployment checklists.

## Example Prompts

- "Using the ChukaCribs repo, help me fix the M-Pesa callback flow and suggest what env vars are required."
- "Audit this project for secrets in source files and suggest a remediation plan."
- "What should I run to start the dev server and run the test suite for this project?"
