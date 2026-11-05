# ETS Integrated Project Management

React/TypeScript application with a Node.js API for configurable project workflows, tasks, resource planning, role/field access, attachments, time records, clients and shift checklists.

## Current status

The local demo remains available. The production candidate adds PostgreSQL persistence, private scanned files and an identity-gateway integration. It is **not a deployed or independently security-approved production system**. Company identity/MFA, TLS/VPN, backup scheduling, restore acceptance, security assessment and user acceptance remain deployment gates. See [production readiness](docs/PRODUCTION_READINESS.md).

## Documentation

- Users and administrators: **Help & guides** in the application, or [user guide](docs/guides/USER_GUIDE.md).
- IT/deployment: [production operations](docs/PRODUCTION_OPERATIONS.md).
- Recovery: [backup and restore](docs/RECOVERY.md).
- Engineering scope and launch gates: [production readiness](docs/PRODUCTION_READINESS.md).
- Earlier FRD/parity/QA documents are historical evidence, not current installation instructions. Their old test counts and demo-hosting descriptions do not establish production readiness.

## Local development / existing demo

Requires Node.js 22 or 24. From the repository root:

```powershell
npm ci
npm ci --prefix react
npm run dev
```

In a second terminal, also at the repository root:

```powershell
npm --prefix react run demo
```

Open http://localhost:5175. The frontend proxies API calls to the backend on 5174. Do not add another `react` directory prefix if your terminal is already inside `react`; run `npm run demo` there.

Local development uses `data/db.json` (or `ETS_DATA_DIR`) unless DATABASE_URL is configured. Keep existing data. **Do not run setup:demo on an environment containing records you want to retain.** It is a deliberate demo reset command, not installation or upgrade.

No shared credentials are provided in this guide. Obtain named access from the administrator. Local seed data is synthetic and must not be deployed as production accounts.

## Verification

```powershell
npm run qa:react
npx playwright install chromium
npm run test:e2e
```

Browser/API tests use isolated synthetic data; stop local servers on 5174/5175 before browser QA. PostgreSQL integration tests require an explicitly configured **isolated** test database; see production operations. Tests do not authorise deployment or prove regulatory compliance.

## Production

Do not use Vite development/preview servers or a development tunnel for production. Build the React frontend and run the supervised backend behind company-managed HTTPS and an MFA identity gateway. PostgreSQL and file/scanner services must remain private. Start with the operations runbook; do not point migration commands at existing production data.
