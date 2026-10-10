# Security Policy

Pulse reads sensitive local data (agent transcripts that can contain prompts, code, and paths). We treat any way of exposing that data as a security issue.

## Supported versions

| Version | Supported |
| --- | :---: |
| 1.x (latest `main`) | ✅ |
| older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's [private vulnerability reporting](https://github.com/jordaoqualho/akaashi-pulse/security/advisories/new) instead.

Include:

- What an attacker can do, and the conditions they need (for example, another local user, a malicious web page, a crafted JSONL file).
- Steps to reproduce, ideally with `pnpm demo` data rather than your own logs.
- The version or commit, your OS, and your Node.js version.

You can expect an acknowledgement within 5 business days and a fix or mitigation plan within 30 days for confirmed issues. We'll credit you in the release notes unless you prefer to stay anonymous.

## In scope

- Prompt, code, path, or credential disclosure through the dashboard, HTTP API, MCP server, CLI, logs, or the AKAASHI OS integration.
- Reaching the dashboard or API from outside loopback without explicit configuration, including DNS rebinding and cross-site requests.
- Writes to agent log directories (Pulse must never write there).
- Code execution through crafted session files.

## Out of scope

- Findings that require an attacker who already controls your user account.
- Cost estimates that differ from your provider's invoice (please open a regular issue).
