# ETS Integrated Project Management

ETS IPM is a departmental project and task tracking application covering Commercial RFQ work, Internal EER work, project/task hierarchy, user administration, role-based access control, capacity planning, reporting, notifications, and audit history.

The current build is intended for functional demonstration and technical review against the supplied ETS requirements and tracker structure.

## Run locally

Requirements: Node.js 18+.

```powershell
npm run dev
```

Open:

```text
http://localhost:5174
```

No npm runtime dependencies are required; the application uses the Node.js built-in HTTP server.

## Demo administrator

- Username: `Stephan`
- User ID: `123`
- Password: `Testing`

The administrator account is intended for demo use only.

## Functional areas

- Overview and project portfolio
- Commercial RFQ projects
- Internal EER projects
- Level 1 Project → Level 2 Work Package → Level 3 Task hierarchy
- Task assignment, status, MH estimate and actual MH tracking
- Escalation and bottleneck handling with mandatory reasons for MH overruns
- User account management, activation/deactivation, password reset and offboarding
- Reusable role/permission profiles
- Server-side RBAC and restricted-field masking
- Capacity and manpower planning
- Team roster and leave/availability management
- Notifications and task comments
- Management reports and CSV import/export
- Audit and change history
- Field/system settings

## Access model

Application permissions are derived from the authenticated user's assigned profile and enforced by the API.

Default profiles:

- **System Administrator** — full application and administration access
- **Senior Management** — Commercial, pricing, project, assignment, reporting and audit access
- **LTSE** — engineering lead access, including Commercial RFQ engineering/MH information and task assignment, without pricing access
- **TSE/JTSE** — task execution and Internal EER access; Commercial RFQ engineering/MH fields are restricted before handover and task assignment is not permitted

Commercial/pricing access is intentionally separate from Commercial RFQ engineering/MH access.

## Architecture

- **Frontend:** HTML, CSS and vanilla JavaScript
- **API:** Node.js built-in HTTP server
- **Authentication:** server-side session cookie with password hashes stored in the demo data store
- **Authorization:** profile-based permission checks enforced on API routes and protected API response fields
- **Demo persistence:** JSON (`data/db.json`), initialized from `data/seed.json`

`data/db.json` is excluded from source control so local/demo changes do not alter the seed dataset.

## Project structure

```text
public/
  index.html       Application shell
  styles.css       Main UI styles
  app.js           Core application UI/workflows
  admin.js         User and role administration UI

data/
  seed.json        Demo seed dataset

docs/
  FRD_TRACEABILITY.md
  RBAC_QA_RESULTS.md
  DEV_DEMO_NOTES.md
  CLIENT_DEMO_CHECKLIST.md
  RELEASE_NOTE_RBAC.md

server.js           HTTP API, authentication, RBAC and persistence
package.json        Run scripts/project metadata
```

## Security notes

This build contains controls suitable for demonstration, including password hashing, server-managed sessions, active/inactive account checks, session revocation, protected permission profiles and server-side field masking.

Before production use, replace the JSON data store with a persistent relational database and implement enterprise identity/authentication such as Microsoft Entra ID or another approved identity provider. Production deployment should also include environment-specific secrets, HTTPS-only cookies, centralized logging, automated tests, backups and private source control.

## Deployment note

The application reads the hosting platform's `PORT` environment variable and binds to `0.0.0.0`, so it can run on platforms such as Render.

JSON-file persistence is not suitable for a production or multi-instance hosted deployment. Data may reset when an ephemeral service is restarted or redeployed.

## Technical reference

See `docs/FRD_TRACEABILITY.md` for requirement mapping and `docs/RBAC_QA_RESULTS.md` for the role/security verification completed for the current build.
