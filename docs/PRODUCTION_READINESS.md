# Production readiness — 6 November 2026

Engineering/IT document. Do not embed this backlog in the user application. This supersedes older deployment descriptions; historical QA/FRD files remain evidence for their dated builds only.

## Implemented production candidate

- PostgreSQL tables for users, profiles, projects, tasks, workflow instances and other collections. Workflow/configurable record content remains JSONB rather than a fully decomposed reporting schema. Core IDs, username/user code, project WBS and per-project task WBS have database uniqueness; task/project, user/profile and workflow/project references are foreign keys. Hours are nonnegative. Versioned schema migration is explicit.
- API changes and security state are committed in a transaction before a success response. A database advisory lock serialises application transactions across instances to preserve current whole-domain business rules. This deliberately favours correctness for a small pilot; it is not a claim of high-throughput scaling. Per-request domain loading and serialisation require realistic load testing before sizing or expansion.
- JSON import preflight refuses duplicate/orphan records and missing/duplicate active identity emails. Apply refuses a nonempty target. Full record comparison and file SHA-256 checks occur before commit. Source is never overwritten. Local password hashes are excluded from the imported production copy.
- Private content-addressed file storage outside the web root, authenticated downloads, integrity checks and malware scanning before acceptance. Unapproved/scanner-unavailable uploads fail closed. Feedback screenshots follow the same storage/scanning path. Files are immutable; removal removes the record/link, not immediate physical/backup erasure. Orphan blob retention/garbage collection needs an approved policy.
- Production local login is disabled. Trusted identity-gateway email maps to exactly one active preprovisioned application user. A per-deployment secret and private network protect identity headers. No self-registration, email-based role elevation or automatic account creation. Company IdP/gateway must enforce MFA, sign-in restrictions, account recovery, session expiry and sign-out.
- Persistent hashed local session keys and shared throttling when PostgreSQL is used. Development local sessions expire after 8 hours absolute or 30 minutes without API activity; polling counts as API activity. Production proxy sessions are governed by the gateway/IdP, not this local timer.
- Production configuration checks, secure headers, response sanitisation, request size/time limits, request IDs, structured status/duration/error logs, readiness/liveness checks and graceful shutdown.
- Container build, private service compose candidate, proxy integration example, encrypted backup script and isolated restore procedure. These are deployment candidates; actual company infrastructure is not yet configured.
- Searchable end-user Help & guides. Technical hosting/backlog/demo credentials removed from the user page. Current root/React READMEs replace obsolete vanilla-interface instructions.

## Launch gates — pending until evidence exists

| Gate | Owner needed | Required evidence |
|---|---|---|
| Scope/data classification | Stephan + company IT/security | User count/concurrency, first-release scope, permitted region and support location, data/retention restrictions |
| Identity/MFA | Company identity administrator | Exact issuer/callback and email mapping; MFA; disabled-user/session revocation; recovery and emergency-access drill; gateway header spoof test |
| Infrastructure | Company IT | HTTPS/VPN, private ports, encrypted disks/keys, separate staging/production, restricted secrets and runtime database role |
| Recovery | Company IT + app maintainer | Off-host encrypted scheduled backups, separate backup rights, retention, alert delivery, measured database+file restore |
| Security | Independent assessor + maintainer | Scoped ASVS-based review/penetration test; no unresolved critical/high findings; dependency/image scan and remediation |
| Data migration | Maintainer + data owner | Reviewed duplicate/orphan corrections, preflight/hash/count reconciliation, source backup, staging rehearsal |
| Capacity | Maintainer + IT | Agreed concurrent load, realistic files/workflow size, latency/error thresholds; no lost updates |
| User acceptance | Stephan + actual role representatives | Project lifecycle, parent/final sign-off, negative permission cases, time, files, reports, clients, checklist and offboarding acceptance |
| Operations | Named support owners | Alert destinations, business hours/escalation, patching/rollback, incident response, key/backup ownership |
| Cutover | Data owner + IT | Approved write-freeze, verified backup, final migration, smoke checks, rollback deadline and go/no-go |

Do not label a gate complete because a script exists. No live data, company identity, backup repository or external messages were changed by this implementation.

## First-release exclusions unless separately agreed

Native Excel import, formal timesheet approval, conditional workflow branching, automatic rescheduling, feedback email delivery and Internal-specific template redesign. Existing recorded application sign-offs are not cryptographic signatures. No claim of aviation or privacy-law certification is made.
