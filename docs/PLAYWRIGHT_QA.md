# Isolated React browser QA

## Safety model
- The Playwright runner starts its own Node API backend on port 5174.
- `tests/e2e/isolated-server.cjs` creates a unique OS temporary directory, copies `data/seed.json` into it, and sets `ETS_DATA_DIR` to that directory.
- The React Vite server runs on port 5175 and proxies API requests to the isolated backend.
- The runner refuses to reuse an existing backend or frontend server. **Do not stop your working servers merely to run this test.** Use GitHub Actions if ports 5174/5175 are in use.
- Browser tests create only synthetic QA records in the temporary database. They never intentionally use `data/db.json`.
- Temporary test data is removed on normal runner termination. An abnormal OS-level kill may leave a harmless temporary directory.

## Running in GitHub
Push changes to `react-migration` or open a pull request. Open the **Actions** tab, choose **React, API and Browser QA**, and inspect the run. On failure, download `playwright-failure-evidence` for traces, screenshots and HTML reports.

## Running locally (only with ports 5174 and 5175 free)
From repository root:

```powershell
git pull origin react-migration
npm install
npm install --prefix react
npx playwright install chromium
npm run qa:full
```

The `qa:full` command runs React build, lint, isolated API smoke test and Chromium E2E tests. The browser tests are not a replacement for comprehensive FRD or accessibility verification.

## Current coverage
- Administrator sign-in and navigation
- Internal EER project and task creation
- Task persistence across browser refresh
- Role management and configuration screen loading
- Unauthenticated API denial

## Not yet covered
- Full role-by-role commercial masking, workflow editing, imports/exports, leave/capacity planning, accessibility, complex project lifecycle and complete FRD acceptance scenarios
- Production deployment, staging configuration and data migrations

**Do not merge to `main` or deploy to production based on these checks alone.**
