# docs/OPEN-ITEMS.md
**All deferred scope, blocked items, and known gaps live here.**
**Nothing open lives only in chat.**

---

## DEFERRED — Out of Scope for MVP

| ID | Item | Status | Notes |
|---|---|---|---|
| DEF-001 | SaaS: multi-user, public signup, billing, admin panel | DEFERRED | Data model uses `profile_id` on every record — adding a second profile does not need a schema rewrite |
| DEF-002 | Auto submit, auto boost, auto messaging, auto replies | DEFERRED — HARD BAN | Also banned by Safe Model (Section 2). Cannot be added without full re-review of the safe model |
| DEF-003 | Browser extension of any kind | DEFERRED — HARD BAN | Banned by Section 2 |
| DEF-004 | More than one Upwork profile simultaneously | DEFERRED | Schema is profile-aware. Add a profile row when needed |
| DEF-005 | Mobile apps | DEFERRED | Responsive web only in MVP |
| DEF-006 | Outreach, email sending, social posting | DEFERRED | No integration built or planned |
| DEF-007 | Hardware integration | DEFERRED | Section 13 rule applies when this is approved. See `packages/hardware/README.md` |

---

## BLOCKED BY SAFE MODEL

| ID | Item | Blocked By | Notes |
|---|---|---|---|
| BLK-001 | Reading client message history to improve scoring | Section 2, Rule 3 — No message access | Messages are a write-adjacent scope. Mark client responsiveness as "Not Available" |
| BLK-002 | Automatically boosting a proposal with Connects | Section 2, Rule 2 — No auto submit, no Connects spending | App can SUGGEST a boost. Farid decides and boosts manually on Upwork |
| BLK-003 | Tracking whether Upwork delivered a notification for a job | Section 2 — No write/notification scope | Use polling timestamp as a proxy for "early" timing |

---

## MCP-SPECIFIC OPEN ITEMS

| ID | Item | Status | Notes |
|---|---|---|---|
| MCP-001 | Exact list of tools exposed by `mcp.upwork.com` for a Freelancer account | OPEN — verify in Phase 2 | The MCP server exposes write tools (submit_proposal, messaging). Our allowlist blocks all of these. The scope guard test verifies the allowlist on every commit. When Farid connects in Phase 2, the actual tool list returned by the MCP server must be compared to the allowlist and logged. Any tool not in the allowlist is logged and ignored — never called. |
| MCP-002 | MCP rate limits for job search polling | OPEN — verify in Phase 2 | Default poll interval is 30 minutes. If the MCP server enforces stricter limits, the `defaultPollIntervalMinutes` setting must be updated and recorded in DECISIONS.md |
| MCP-003 | Whether `get_job_details` is available as a separate MCP tool | OPEN — verify in Phase 2 | If not available, `search_jobs` results are stored as-is with available fields only. Missing fields stored as null |

---

## KNOWN GAPS

| ID | Item | Phase to Address | Notes |
|---|---|---|---|
| GAP-001 | OWASP Top 10 2025 check | Phase 4 | To be done and documented in `docs/RUNBOOK.md` |
| GAP-002 | Database backup test | Phase 4 | Backup steps written in runbook, tested once before MVP complete |
| GAP-003 | Generic draft detector | Phase 3 | Logic for detecting template-paste drafts vs job-specific drafts |
| GAP-004 | Connects tracking UI | Phase 3 | Farid enters Connects spent manually per job |
