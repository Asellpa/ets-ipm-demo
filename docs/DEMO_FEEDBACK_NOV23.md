# Demo feedback implementation — 23 November 2026

Remain in demo until client acceptance. No production deployment and no live data reset were performed.

## Implemented

- Admin business role management with protected system access and bounded delegation.
- Editable project types separate from commercial/internal security category; dynamic register tabs, archive, workflow compatibility and stale-save checks.
- Workflow-defined department/default-task templates, estimates and default role eligibility; snapshots copied only into newly created projects. Current workflows are not automatically rewritten.
- Multiple client contacts, contact archive/editing, project focal selections and project-specific named HTTPS document locations. Attachments opens the configured primary location. SharePoint remains responsible for file access.
- Remove the Internal/Projects linking UI and retire its API with HTTP 410. Client/project associations are retained.
- Configurable register actions; remove duplicate Open. Suppress optional duplicate department fields and empty generic task controls outside the department workspace.
- Scoped recording of time on behalf of staff, explicit approval reason, worker/recorder/approver attribution, daily limits and audit. Review & closure exposes permitted project task logs. Existing task and workflow locks still apply.
- Private extra profile fields under Manage Users; separate from authentication. No profile values in staff bootstrap or unauthorised audit.
- Persistent warnings for three consecutive working days overbooked in the next 60 calendar days. Daily in-app reminders continue until a permitted lead resolves the conflict and records a reason. Staff can add blocker notes; checklist ticks and notification reads never resolve a warning.
- Asia/Dubai working calendar, editable work week/holidays/reserve; board labels match configured non-working days. Legacy reserve remains unchanged until configured; fresh demo reset initialises one hour when no calendar exists.
- Tasks & Departments, Audit & History and Reports marked Under construction. Existing tools retained for demo testing.
- Register task lookups indexed once per render rather than repeatedly scanning the task collection. Authenticated, role-specific conditional refreshes avoid transferring and parsing unchanged bootstrap data; requests still authenticate, and changes to data or permissions invalidate the internal validator shortcut. Only role-scoped response ETags are exposed.
- Private backup-first local demo-clear command; accounts, clients and workflow configuration retained.

## Owner setup

Stephan configures TL/deputy/coordinator profiles and object/field/sign-off access. Roles use capability permissions, not organisation-chart rank strings. Named project leads require task-assignment capability. Do not invent roster identities or silently grant administrator access based on job titles.

Stephan still needs to enter the actual default task list and dependencies and confirm working days/holiday dates. Workflow ordering/prerequisites continue to govern progression. Default task roles do not auto-select staff. No automatic rescheduling has been introduced.

The prior per-object attachment API and stored files are retained for historical access/export. They are no longer offered as the main project upload UI. A document link does not transfer a file or share Microsoft credentials.

## Deliberately deferred

Org-chart view; daily-work/notification redesign; automatic P1 interruption proposals/rescheduling; skills/certification matching; overtime/weekend approvals. Do not label these complete because calendar and time permissions exist. Any future rescheduling must require lead confirmation.

## Fresh demo records

Stop the backend first. From the project root run:

```powershell
npm run demo:clear -- --confirm-clear-projects
```

The command refuses production/PostgreSQL mode and a running local backend, creates a timestamped database backup, clears project/task-specific records and preserves workflow templates and accounts. It does not reset passwords. The operator must protect the backup directory with appropriate filesystem permissions, especially on Windows. Keep the backup until the new demo is accepted.

## QA

Run `npm run qa:react`, `npm run test:e2e` and `npm run qa:performance`. The API suite is serial to prevent randomly chosen test ports from colliding; concurrency tests still explicitly issue concurrent requests. PostgreSQL cases run in CI using a disposable PostgreSQL service. Performance smoke uses 200 synthetic projects and 2,000 tasks in a temporary database; timings are diagnostic, not a production capacity guarantee.
