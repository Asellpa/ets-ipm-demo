# ETS IPM React

React + TypeScript frontend is in `react/` on branch `react-migration`.

## Run locally

From your existing repository, stop the running development servers and pull the development branch:

```powershell
git switch react-migration
git pull --ff-only
npm install --prefix react
npm run dev
```

In a second terminal at repository root:

```powershell
npm --prefix react run dev
```

Open **http://localhost:5175/**. The API runs at **http://localhost:5174/** and Vite proxies `/api` requests to it. Starting only the React server can render the login page but cannot authenticate or load records.

This is a local address on the computer running the servers, not a public hosted website. Keep the existing data directory; do not run reset or clear-records commands. Back up local changes before pulling if Git reports a dirty working tree.

## Verification

```powershell
npm install
npm run qa:react
npx playwright install chromium
npm run test:e2e
```

Automated tests start a separate backend using an isolated temporary database and refuse to reuse an existing server. Stop local servers on 5174/5175 before running browser QA. See `docs/REACT_FRD_TRACEABILITY.md` for current coverage and limits.
