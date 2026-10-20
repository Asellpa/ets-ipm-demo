# ETS IPM demo — pending work tracker

Updated: 20 October 2026. Branch: `react-migration`. Owner: unassigned unless noted.

This is the current engineering backlog, not a declaration of complete FRD compliance. Keep IDs when updating status. Record acceptance evidence or a linked issue before marking a row Done. P0 blocks production; P1 is next-priority work; P2 is an improvement or decision.

| ID | Priority | Work item | Status | Acceptance criteria / next action |
|---|---|---|---|---|
| WF-01 | P0 | Runtime workflow instances | Not started | Link each project's records and tasks to a versioned workflow instance. Decide explicitly how configuration changes affect existing projects. |
| WF-02 | P0 | Node permissions | Configuration only | Enforce Hidden / View / Edit / Complete / Approve on the server and UI. Apply to reads, writes, reports, exports and child records. Test each profile and direct API access. |
| WF-03 | P0 | Completion rules | Configuration only | Define required fields and task links; prevent completion until field, child or task conditions are satisfied. Test cycles, stale updates and blocked transitions. |
| WF-04 | P0 | Approvals and sign-offs | Configuration only | Persist decisions, approver identity, time and comments. Specify reject, reopen and resubmit behavior; enforce permissions and audit decisions. |
| WF-05 | P1 | Other designer components and activation | Configuration only | Define executable task-group, decision, milestone and notification behavior. Apply project-type workflow assignments at runtime. Current designer stores configuration only. |
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
