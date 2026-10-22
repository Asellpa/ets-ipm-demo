# ETS IPM demo — pending work tracker

Updated: 23 October 2026. Branch: `react-migration`. Owner: unassigned unless noted.

This is the current engineering backlog, not a declaration of complete FRD compliance. Keep IDs when updating status. Record acceptance evidence or a linked issue before marking a row Done. P0 blocks production; P1 is next-priority work; P2 is an improvement or decision.

| ID | Priority | Work item | Status | Acceptance criteria / next action |
|---|---|---|---|---|
| WF-01 | P0 | Runtime workflow instances | Implemented for project workspaces | Projects select templates at creation and persist a versioned snapshot. Legacy projects attach explicitly. Existing snapshots stay unchanged after template edits. Version migration remains a separate future operation. |
| WF-02 | P0 | Node permissions | Implemented for project objects and linked tasks | Server checks inherited visibility/edit/complete/approve access. Hidden ancestors hide descendants and linked task data in bootstrap, reports, export, comments, capacity and audit. Assigned manager/supervisor authority is also required to complete; administrator override retained. |
| WF-03 | P0 | Completion rules | Implemented | Parent always waits for children and linked leaf tasks. Required fields, at least-one-task rule, sequential/parallel sibling groups and stale revisions enforced server-side. Reopen with a reason resets affected work and retains history and task records. |
| WF-04 | P0 | Approvals and sign-offs | Implemented as recorded decisions | Approve/reject with comment, actor/time and history; approve access and named project lead required. Rejection blocks progression; approval can follow rejection. These are recorded application decisions, not cryptographic signatures or multi-party approval chains. |
| WF-05 | P1 | Other designer components and activation | Partial | Task title templates instantiate unassigned tasks; project type defaults and explicit workflow selection work; readiness notifications go to named leads. Decision nodes are manual checkpoints. Conditional branching and external notifications remain WIP. |
| QA-01 | P0 | Full FRD traceability and acceptance | Incomplete | Reconcile all FRD clauses against current React implementation and original-app behavior. Attach evidence for each requirement; get owner acceptance. Existing passing regressions cover selected scenarios, not every requirement. |
| SEC-01 | P0 | Production security review | Pending | Review login throttling, session persistence/revocation, CSRF/origin controls, validation, attachment handling, dependencies and authorization boundaries. Remove seeded/default passwords from any shared environment. |
| DATA-01 | P0 | Managed persistence and recovery | Demo implementation | Replace JSON-file storage for production with managed persistent storage; add migrations, tested backups/restore and concurrency/load checks. Current feedback and screenshots persist in the demo database. |
| HOST-01 | P1 | Independent demo/staging hosting | Pending | Deploy an isolated demo with persistent data, HTTPS and restricted access, so laptop sleep or tunnel closure does not stop demos. Requires hosting choice and deployment approval; no deployment authorized here. |
| DEMO-01 | P1 | Demo access and repository privacy | Owner action / verify | Verify current repository visibility; make private if code must not be public. Use unique demo credentials, minimum necessary role permissions and synthetic data. A forwarded URL does not prevent UI copying. |
| IMPORT-01 | P1 | Native Excel import parity | Missing in React | Current React importer accepts CSV. Implement and test XLSX/XLS/XLSM as required, including sheet selection, internal EER classification and rejected-row validation. |
| IMPORT-02 | P1 | Source data preservation | Implemented for new CSV imports | Original rows, including unmapped columns and original order, are stored in server-only importHistory with submitter, timestamp and WBS-to-record references. API regression verifies persistence and no bootstrap disclosure. Existing imports cannot be reconstructed; original spreadsheet files are not archived. |
| UX-01 | P1 | Complete user acceptance pass | Pending | Exercise all screens with representative data, narrow windows, keyboard navigation, different roles and realistic task/workflow sizes; log issues in Feedback. |
| FB-01 | P1 | In-app feedback and review | Implemented; CI verification recorded in commit/run | Header feedback form, optional PNG/JPEG screenshot, page/user/time/server revision, persistent register, own-submission privacy and Manage Feedback review permission; New / In progress / Resolved with reviewer note. |
| FB-02 | P2 | Feedback email alerts | Not implemented | Choose sender/recipient/provider and notification policy before integrating. No email or external messages are sent by this increment. |
| FB-03 | P2 | Feedback triage improvements | Optional | Add reviewer assignment, priority, comments, duplicate links and GitHub/JIRA integration if useful after the first demo. |
| BRAND-01 | P2 | Product name and branding | Decision pending | Confirm what ETS stands for and the final product name; currently ETS IPM · Demo. Update app branding, metadata and screenshots consistently after agreement. |
| OPS-01 | P1 | Operational monitoring and handover | Pending | Define logs/error alerts, support ownership, retention, rollback instructions and uptime expectations for hosted demo/production. |

## Demo feedback workflow

1. Any signed-in user clicks **Send feedback** in the header.
2. Choose Bug, Suggestion or Question; describe the issue and optionally attach a PNG/JPEG screenshot up to 1 MB.
3. The server records user identity, page, timestamp and server revision. Source revision is `unversioned` if Git metadata is unavailable.
4. Users see their own submissions under **Feedback**. Reviewers need **Manage Feedback** in Role Management; the built-in System Administrator receives it automatically.
5. Reviewers update New / In progress / Resolved and a reviewer note. Notes are visible to the submitter. No email alert is sent.
6. Review the register after a demo. Promote accepted work to the relevant backlog ID or a tracked issue, then record verification before resolving it.

## Existing verified capabilities

Project/task CRUD, role and user administration, commercial masking, task ownership, saved comments/escalations, reports and exports, CSV preview/import, capacity and leave, task reassignment and notification-bell behavior have selected API/browser regressions. Passing these tests does not remove the pending items above. Existing data and `main` must remain protected; use isolated data for QA.

## Global consistency and scheduling pass — 20 October 2026

Shared form font, control heights, task action grouping and focused user editing implemented. Project, task, work-package and CSV import scheduling rejects invalid calendar dates, years outside 1900–2100 and delivery/due dates before start. Start precedes delivery in project forms. Regression coverage added; UX-01 remains open for the full cross-role, responsive acceptance pass. Runtime workflow execution and production readiness remain pending.

## Project workflow runtime — 20 October 2026

Standard lifecycle: Overview, Planning, Implementation, Review & Approval, Delivery, Closure. Legacy default root labels are upgraded in templates, preserving child node IDs/settings; existing project records are not automatically attached or rewritten. Commercial RFQ/Awarded business status is retained separately for FRD commercial access rules.

New projects get a workflow snapshot automatically (explicit selection or project-type default). Named manager/supervisor are active users with task assignment permission; an eligible creator defaults to manager. Creation requires an existing explicit workflow selection and at least one named lead. Projects created without an eligible lead need an administrator to appoint one before normal completion. Administrators retain editing/access overrides, but parent sign-off must be by the named project manager or supervisor, including for administrators.

Each sibling starts after the previous sibling group. Parallel with previous joins that group; the next group waits for every member. Parents require manual authorised completion after their children and linked tasks finish. Existing tasks can be linked in the project workspace. Task templates create title-only, unassigned task records with zero estimates; task assignment and estimation still need a lead. Locked/completed objects reject task changes. Reopen preserves fields, decisions/history and task records while resetting affected node progress; task records are not automatically reopened.

Validation: API regression covers ordered/parallel progression, hidden-node filtering in exports, required fields, child/task blockers, named lead permissions, stale revision conflicts, approve/reject/reopen, pinned versions and persistence after restart. Browser regression covers creating a project with selected workflow, opening it, completing configured fields/tasks and parallel objects, refresh persistence and reopening. Full owner acceptance is still pending.

## Configured project forms and compulsory parent sign-off — 20 October 2026

New records select an existing workflow and named lead; object fields are entered after creation, not on a universal project details form. Each node supports ordered text, long text, date, number, choice and checkbox fields, required flags, optional register mappings and commercial field-group masking on API reads/writes. Built-in workflows provide blank Overview/Details/Budget and Planning/Team/Supervision pages plus lifecycle phases; custom workflows define their own schemas. Saved instances remain pinned; pre-schema records retain their legacy editing path.

Parent completion requires an explicit signoff action, non-empty comment and the assigned manager/supervisor; ordinary completion and unassigned administrator sign-off are rejected. Actor ID/name, timestamp and history are stored. Reopening clears current sign-off but keeps history.

JSON compatibility: workflow catalog advertises protocol version 2; creation is disabled when the backend is missing/incompatible. Unknown API routes return JSON 404; frontend non-JSON failures identify the endpoint/status and restart instructions. Compiled Vite preview explicitly proxies /api to port 5174. Tested on isolated data through the compiled preview.

## Workflow resource planning and dated actual hours — 21 October 2026

Implemented: upcoming workflow tasks may be created and scheduled by leads with object edit access; execution, actual hours and comments stay blocked until prerequisites open the object. Completed objects remain locked. Resource Planning → Workload shows unassigned and future tasks, with assignee, estimate, start, finish and optional daily allocations. Default spreading uses weekdays across both dates; no finish date retains the prior standard-day allocation. Custom allocations must total the task estimate and remain within its dates. Leave and weekend bookings remain visible as conflicts.

Assigned users can append dated, described time entries from the project workspace or My Work task details. Actual hours combine a preserved opening balance with entries; direct aggregate edits are rejected after logging begins. Requests are idempotent per task/entry reference, future dates are rejected and entries across tasks cannot exceed 24 hours per user/day. Overruns require a reason and create an escalation. Parents display descendant task estimates/actuals exactly once, excluding work package totals and generic numeric form fields.

Remaining: formal time-entry correction/reversal and approval, automatic rescheduling around leave, historical versioned resource plans, reporting/export of individual time entries (JSON backup contains them), and full owner acceptance. Existing aggregate-only task records retain their legacy actual-hour edit path until their first time entry. No production database migration or real demo data reset performed.

## Familiar Commercial tracker template and project views — 22 October 2026

Implemented a separate Commercial tracker template from the supplied Trial 14 commercial form and CSV headers, organised into standard lifecycle objects. Pricing/quotes remain restricted. Commercial Grid supports task expansion and hour rollups; Kanban groups by Status, Commercial stage or read-only Workflow phase. Completion cannot bypass object sign-off. Existing snapshots, custom workflow defaults and the Internal EER template are preserved; source customer records were not imported.

Pending: owner acceptance against Stephan's actual day-to-day usage, explicit migration/import mapping of existing customer records if requested, and a corresponding Internal EER template adaptation. Object attachments remain pending.

## Corrected project/department demo flow — 22 October 2026

Supersedes the earlier Commercial tracker template design. The catalogue is migrated once to Projects and Internal; existing project snapshots/history survive. Overview contains grouped reference-tracker fields; schedule/hour information is grouped separately. Department tasks can run in parallel with overview entry. No demonstration projects are seeded.

Implemented compact Kanban, native project popup with full-window expansion, department task creation and inline status/owner/priority, count-based task progress with explicit exclusions, administrator register visibility/editability, and permission-filtered Internal↔Project links. WBS means Work Breakdown Structure, with project/department/task levels. Source files remain reference material rather than live data imports.

Pending owner acceptance and any requested import of real tracker rows. Attachments, time-entry corrections/approvals and production hosting/security remain separate backlog items. Internal tracker-specific form adaptation remains pending; its existing workflow content is retained.

## Demo readiness sprint — 23 October 2026

Implemented and locally verified with production build, ESLint and nine API regression suites (including `tests/sprint-demo.test.cjs`). Browser coverage is added in `tests/e2e/sprint-demo.spec.cjs`; CI results must be recorded after completion before claiming full browser acceptance.

- RES-02: Dedicated `sysadmin` accounts are administration-only: persisted zero capacity, no task allocation/time logging/leave entries, and excluded from Team, capacity and assignment pickers. This is account purpose, independent of the System Administrator permission profile, so named administrators can still be working team members. Existing historical entries are retained.
- ATT-01: Workflow-object file upload/list/download/removal with inherited read/edit checks, locked-object enforcement, authenticated downloads, size/type/filename validation, audit entries and workflow revision updates. Supports PDF/PNG/JPG/TXT/CSV, 2 MB per file, 20 files per object and 20 MB per project. Files persist in the backend JSON database, are included only in authorised explicit JSON exports, and are removed with project cleanup. They are not disclosed through bootstrap. Office documents, malware scanning and external object storage remain pending.
- TIME-02: Time-entry corrections and voiding (zero hours) preserve original values, reason, actor/time and versioned correction history. Entry authors, named project leads and System Administrators may correct unlocked work. Stale revisions and reused correction references are rejected; identical retries are idempotent. Daily 24-hour limits and opening balances remain enforced; task/workflow/report actuals recalculate. Formal timesheet approval is still pending.
- REPORT-02: Reports → Time entries provides dated work records, author/date filtering, corrections and CSV export; undated opening balances are explicitly excluded. Progress and overdue calculations now share cancellation/inapplicability rules across project views, personal work, overview and reports. CSV report endpoints require Export Data in addition to View Reports.
- ACCOUNT-02: Previous one-time setup creates sysadmin / ID 1309 via hidden local password prompts, backs up and clears project work, and gives Stephan Admin. No password or credential hash is committed. This sprint requires pull/restart only; it does not rerun cleanup or delete newly created work.

Still pending: complete FRD/user acceptance, native Excel import, Internal-specific template adaptation, conditional branching, formal time approval, automatic rescheduling/versioned plans, feedback email integration, independent hosting and production database/security/operations work. No production deployment, database migration, real customer import or further live-data reset is part of this sprint.

Sprint acceptance baseline: commit `974676dedb94a42da93f8928bd2847707febe3a2`, CI run `39834905763` passed production build, ESLint, all nine API suites and all 36 Chromium browser tests (53.9 seconds). Tests cover attachment persistence/download/removal, correction history/recalculated actuals/export, dedicated sysadmin resource exclusions, and cancellation-aware progress/overdue metrics. Visual evidence capture and hiding administration-only actual-hour inputs are verified in the following incremental CI run.

Additional verification: commit `c980ebe99d7867900fc050b2868433e5ea51883f`, CI run `39835382496` passed all nine API suites and 36 browser tests (45.3 seconds). Uploaded screenshot evidence was visually reviewed for object attachments, time corrections and the dated-entry report. A final increment makes the object navigation sticky on wide screens and validates work dates against the browser's IANA time zone rather than UTC; midnight-boundary tests cover Asia/Colombo and Asia/Dubai. The local backend suite now has ten passing tests.

## Department controls, object teams and financial privacy — 23 October 2026

Implemented: department placeholders removed; projects show only persisted departments and actual ungrouped tasks. Add department opens a popup with available standard/custom choices. Removal can preserve task IDs, owners, estimates, actuals/time history and workflow links while moving tasks to another department or to the project; locked/hidden tasks cannot be moved. Duplicate names are rejected.

Workflow field types `user` and `users` select active named database resources by stable user ID; Object owner and Team members presets are available. Required empty teams block sign-off. Existing saved schemas remain pinned, so old free-text fields are not silently rewritten. Responsibility assignments do not bypass access or named-lead sign-off. Dedicated administration-only accounts are excluded from manager/supervisor options as well as resources.

Kanban status colours: yellow hold, green in progress, red lost/cancelled, teal completed, purple review, blue not started/other; cards retain text labels and a legend. Scroll changes remove backdrop blur, contain project scrolling, stabilise scrollbar space, prevent body scrolling, and avoid replacing unchanged polling data or refreshing forms while inputs are being edited.

Financial protection extends to custom/legacy budget/cost fields and descendants of budget-labelled objects, with server read/write/export filtering. Attachments have explicit visibility; financial filenames and budget-object ancestry force restriction. Restricted attachment audit rows and exports are filtered. Arbitrary document contents are not scanned, so financial documents with generic names in general objects must be marked Restricted commercial by their uploader.

Local checks: production build, ESLint and 11 backend tests including `departments-security.test.cjs`. Browser coverage adds explicit department creation/removal, status colours, database team/owner selections, scroll stability and LTSE UI/API cost privacy; CI acceptance evidence will be recorded after it completes.

Financial account-management checks also reject non-System Administrators creating stronger roles/accounts, changing higher-privilege accounts or resetting their passwords. This prevents a limited people administrator from indirectly gaining commercial access; the standard Admin profile still manages ordinary staff. Financial matching covers plural budget/quotation labels and budget ancestry. The extended backend regression passes locally.

CI infrastructure adjustment: the official Ubuntu runner image already supplies Google Chrome. CI uses Playwright's Chrome channel and verifies that binary, avoiding the stalled duplicate Chromium/apt installation. Local Playwright retains its existing bundled-browser configuration. The full browser suite is still required; no tests are skipped.
