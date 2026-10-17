# React migration (work in progress)

This is an **isolated, incomplete** React + TypeScript migration. The original application on port 5174 remains unchanged on `main`.

## Start locally

Terminal 1 (repository root):
```powershell
npm run dev
```

Terminal 2:
```powershell
cd react
npm install
npm run dev
```

Open http://localhost:5175. The Vite dev server proxies /api to the existing Node server at http://localhost:5174, preserving existing backend authentication and records.

## Migrated so far
- Login and refresh-based session restoration
- Shared shell and permission-filtered navigation
- Overview metrics and blank states
- Project Register with Commercial / Internal EER tabs and search (read-only)
- My Work task list (read-only)
- Manage Users active/offboarded tabs and account reactivation

## Not yet migrated
Project and task creation/editing, resource planning, reports, audit, role editor, workflow designer, object/project configuration, import/export and other admin actions. These screens explicitly show a migration placeholder in React. Do **not** use this branch for the client demo yet.

## Validation required
- Run `npm run build` in react and address TypeScript errors.
- Exercise login/logout/refresh, role access, both user tabs and reactivation.
- Verify the existing app continues to work on port 5174.
- Migrate remaining modules in functional slices and run end-to-end tests before switching the production entry point.
