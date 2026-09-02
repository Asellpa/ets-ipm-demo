# ETS IPM — FRD Traceability Checklist

Source of truth: **Department Project & Task Tracking Dashboard — Functional Requirements Document** supplied by the client, with the ETS Work Tracker prototype/data used for field names and WBS hierarchy.

## Role / field-group rules

| Requirement | Source intent | Implementation target | QA status |
|---|---|---|---|
| Senior Management can create Commercial RFQ cards | FRD §2 / §3A | `createCommercial` permission | Pending re-test |
| LTSE and below cannot create Commercial cards | FRD §2 / §3A | Server rejects create request | Pending re-test |
| All roles can create Internal EER cards | FRD §2 / §3A | `createEER` permission | Pending re-test |
| Pricing/commercial data only visible to Senior Management | FRD §2, §3, §9 | Separate commercial field-group permission and server-side masking | **Critical re-test** |
| LTSE can access task/MH engineering fields on Commercial RFQ pre-handover | FRD §2 / §3 | Separate RFQ-engineering permission from pricing permission | **Needs correction in current branch** |
| TSE/JTSE cannot access task/engineering fields on Commercial RFQ pre-handover | FRD §2 | Server-side field masking | Pending re-test |
| LTSE and above can assign tasks | FRD §2 / §4 | `assignTasks` permission | Pending re-test |
| TSE/JTSE can execute tasks but cannot assign | FRD §2 / §4 | Status/MH update allowed; assignee changes blocked | Pending re-test |
| Field-level restrictions must be enforced in API responses, not UI only | FRD §2 / §9 | Server-side masking + write authorization | **Non-negotiable** |

> FRD wording note: the §2 table says LTSE pre-handover task/MH access is “read-only”, while §3 says those fields are “Editable/viewable by LTSE and above before handover (to contribute estimates)”. The detailed §3 workflow and §4 assignment authority require LTSE participation in task/MH planning. This discrepancy must be preserved in QA notes rather than silently ignored.

## Project / task model

- Two project types: `commercial` and `internal_eer`.
- Commercial lifecycle: **RFQ → Awarded → In Progress → Escalated → Completed**.
- Project and Task are separate linked records.
- ETS tracker WBS hierarchy is retained as **Level 1 Project → Level 2 Sub-department/Work Package → Level 3 Task**.
- Task fields include assignee, MH estimate, MH actual, status, dependency, remarks/comments and escalation/bottleneck flag.
- Assignment creates an in-app notification.
- Internal EER creation by LTSE-and-below automatically notifies at minimum LTSE and Senior Management.

## Escalation / MH rules

- If actual MH exceeds estimated MH, user must select **Escalation** or **Bottleneck** and provide a mandatory reason/comment.
- Flagged work is visible as a high-level indicator on the common dashboard.
- Full escalation reason is available on drill-down rather than the default common dashboard.
- Escalation history stores timestamp, user and reason.

## Dashboard / resource rules

- Common dashboard is visible department-wide and contains no commercial/pricing data.
- Individual dashboard shows only work assigned to that user.
- Common and individual dashboards use the same underlying task record (single source of truth).
- Capacity view shows booked hours, remaining/free capacity and Leave/OOO per team member/day.
- Management view includes commercial data, escalation drill-down and reporting/export.

## Reporting / audit rules

- All system data must be exportable/reportable on demand.
- Management reporting should support workload/status, escalation/bottleneck and profitability/savings-style analysis where pricing data exists.
- Audit trail must record status changes, assignments, MH changes and escalation tags with user and timestamp.

## User administration extension requested after FRD

The following is an approved extension requested during application build; it is **not explicitly specified in the supplied FRD**, but it implements the FRD's recommended server-side RBAC model:

- Manage Users: create/edit user, reset password, Active/Inactive, offboard, preserve history.
- Role Management: reusable profiles with application permissions.
- Logged-in user's profile controls permissions; no browser-side role simulator.
- Password values must not be returned/displayed after creation and should be stored as hashes.
- Offboarding revokes sessions and prevents new assignment while preserving historical records.

## Sprint gate

Do not merge the `security-rbac-qa` branch to `main` until:

1. Server syntax passes.
2. Frontend JavaScript syntax passes.
3. Stephan administrator login passes.
4. Manage Users CRUD/security actions pass.
5. Role profile create/edit/assignment passes.
6. Senior Management/LTSE/TSE-JTSE permission matrix is verified against the FRD.
7. Commercial pricing and RFQ engineering field masking is tested at API level.
8. Existing Projects, Tasks, EER, Commercial, Capacity, Import/Export, Reports, Notifications and Audit workflows regress cleanly.
