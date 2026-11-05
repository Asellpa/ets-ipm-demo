# Production operations runbook

Readiness gates: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Users: [guides/USER_GUIDE.md](guides/USER_GUIDE.md). Recovery: [RECOVERY.md](RECOVERY.md).

## Ownership and topology

Company owns the repository access, hosting, domain, identity, secrets and backup accounts. Provide the maintainer a named MFA/VPN support account with approved elevation and activity logging. Do not share Sysadmin credentials. Confirm permitted hosting region and cross-border support/data rules with the company before provisioning.

Company HTTPS ingress + identity gateway → private app service → PostgreSQL/private file volume. Clamd is reachable only from trusted app/migration services. Do not publish PostgreSQL or clamd ports. The app serves the compiled React frontend in production; no Vite process is needed. The compose example publishes app only on host loopback for ingress.

## Environment

| Variable | Meaning |
|---|---|
| NODE_ENV | production for production checks/headers/static frontend |
| DATABASE_URL_FILE | Protected file containing PostgreSQL connection URL; DATABASE_URL also supported outside secret-file deployments |
| AUTH_MODE | proxy in production; local only for development/test |
| IDENTITY_PROXY_SECRET_FILE | Random 32+ character shared secret between ingress and app |
| APP_ORIGINS | Comma-separated exact approved HTTPS origins, no paths |
| ETS_FILE_DIR | Private writable immutable file directory on persistent encrypted storage |
| CLAMD_HOST / CLAMD_PORT | Private scanner host and port (default 3310); scanner outage blocks upload |
| TRUST_PROXY | true only when the sole reachable ingress overwrites forwarded headers |
| HOST / PORT | Listening interface/port; restrict externally through ingress/network rules |
| ETS_DATA_DIR | Development JSON directory; production does not seed or read demo records |

Use a dedicated least-privileged runtime PostgreSQL role: schema/table reads and DML only, no superuser/DDL. A separate migration account applies SQL. On a new database, apply migration using the owner, then grant runtime role schema USAGE and SELECT/INSERT/UPDATE/DELETE on application tables; do not give the running app ownership. PostgreSQL encryption/TLS must use verified certificates when connecting over an untrusted network; never use rejectUnauthorized=false. Protect DATABASE_URL_FILE and proxy secret from Git/logs. Provider TLS configuration is an IT task, not implied by setting DATABASE_URL.

## Build and provision staging first

1. Review/pin approved container image versions/digests and scan dependencies/images. The supplied tags are starting points and do not promise immutable builds.
2. Provision persistent encrypted PostgreSQL and file disks, separate staging/prod secrets and identities, HTTPS/VPN and the backup worker.
3. Set APP_VERSION to the exact release commit when building so feedback captures the deployed revision. In `deploy/`, create `secrets/database_password`, `secrets/database_url`, `secrets/identity_proxy_secret` using secure local prompts/tools. Never paste real secrets into documentation/chat. The app URL must use the runtime role, not ipm_owner.
4. Initialise the private file volume with owner UID/GID 1000 and permissions 0700 before starting the non-root app; use the same private volume for migration. Compose does not silently change permissions of existing storage.
5. Set APP_ORIGINS to the exact HTTPS origin. Build with `docker compose -f deploy/compose.yml build`. Start database/scanner services, wait for fresh scanner signatures and create runtime/migration database roles.
6. Execute the schema migration with migration-role DATABASE_URL_FILE. Run JSON preflight below. Execute reviewed import in a one-off app-image container with source mounted read-only and access to the private file/scanner network. Temporarily remove NODE_ENV=production for the CLI or provide all production settings; server config checks apply only at server startup.
7. Start the app only after the target is populated. Run `docker compose -f deploy/compose.yml up -d app`. Verify `/health/ready` through a private monitoring path.

The container is a candidate: validate build, runtime file permissions, scanner readiness, network access and shutdown in the actual company platform before deployment. Do not run development setup/reset commands here.

## Identity gateway

Use the company's approved OIDC gateway (for example oauth2-proxy) against company identity or self-hosted Keycloak. Do not assume Entra/cloud identity is acceptable if all services must be self-hosted. `deploy/nginx.conf.example` shows auth_request integration, not a complete TLS/IdP installation.

- IdP/gateway must enforce MFA, allowed organisation/users, secure cookies, exact callback URL, CSRF protection, approved absolute/idle lifetimes and refresh/revocation policy.
- Ingress must replace X-Forwarded-Email with the verified identity email, inject X-IPM-Proxy-Secret from its protected include, overwrite forwarding headers and prevent direct backend access. An arbitrary client email header alone is never sufficient.
- Each active app user must have a unique email matching the verified identity. Missing/duplicate/unknown/inactive mappings are denied. Roles are assigned within the app, never from browser headers. Review email changes as identity changes; IdP must not recycle a privileged email without app offboarding.
- Local password login/logout is disabled in proxy mode. App Sign out clears the gateway cookie via `/oauth2/sign_out`; it may not terminate the upstream IdP session. Configure federated logout or explain reauthentication behaviour and test it before acceptance.
- No generic local break-glass password bypass is supplied. IT must define audited emergency access in the identity system or an offline recovery procedure. Revoke emergency access after use.
- Test actual MFA, offboarding, session termination, wrong/missing secret, forged headers, wrong/duplicate email and access after role changes.

## JSON migration

Back up the source and stop demo writes for the final cutover. Never repair/renumber records automatically.

```text
npm run db:migrate
npm run db:import -- /read-only-source/db.json
npm run db:import -- /read-only-source/db.json --apply
npm run db:verify -- /read-only-source/db.json
```

Preflight requires complete IDs, unique WBS/user codes/names, valid references and unique active account emails. Resolve reported issues with the data owner on a reviewed copy. Apply refuses a populated target and drops legacy password hashes in the target only. It scans and externalises object attachments/feedback screenshots, checks full round-trip data and file hashes and commits only on success. Keep the source file/hash and validation evidence privately. Failed transactions can leave unreferenced immutable blobs; they are inaccessible through the API but must be accounted for in retention/storage review.

The database holds flexible documents in JSONB with core relational constraints. Current API transactions load the domain and serialise through an advisory lock; they are safe from competing app writes but not engineered for unlimited scale. Never run a second app against the same database with different file storage. Validate load and resource budgets before increasing users/instances.

## Monitoring and operations

- Probe liveness and readiness privately; readiness checks database/schema and file-directory access. It does **not** certify fresh scanner signatures, off-host backups or IdP availability. Monitor these separately.
- Collect structured HTTP status/duration/request IDs and error codes centrally. Logs deliberately omit bodies, cookies, emails, queries and document names. Do not enable proxy query/token logging. Restrict log access and define retention.
- Alert on service failure, sustained 5xx/latency, database/volume capacity, scanner health/signature age, backup failure/age and certificate expiry. Company IT must supply destinations and demonstrate receipt; no external alert is automatically configured.
- Maintain OS, Node, PostgreSQL, gateway and scanner updates. Scan dependency locks/container images on every release; schedule regular maintenance and record remediation.
- Runtime DB access is privileged operational access: SQL readers can see information beyond application roles. Restrict and audit it. Application audit remains database-editable, not a tamper-proof evidence store; ship appropriate security events to controlled external logging.

## Release and incident process

Build/test in staging with synthetic or approved redacted data. Pin the release commit/image; back up before migrations. Use reviewed release approval and a rollback window. Application rollback is safe only if its schema remains compatible. For incompatible migrations use the rehearsed database+file restore; do not blindly roll back code against a new schema.

If compromise is suspected: restrict ingress, preserve logs/evidence, revoke identity/proxy/database access as appropriate, notify the company's incident owner, rotate affected secrets, assess data exposure and restore only from a verified clean point. Company owns regulatory/contractual reporting decisions. Do not erase evidence or restore over production without incident-owner approval.
