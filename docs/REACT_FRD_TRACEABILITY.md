# ETS IPM React migration — FRD traceability and QA gate

Source of truth: `Department_Task_Tracker_FRD.pdf`, sections 1–9. This is a **gap assessment**, not a claim of completed QA.

| FRD requirement | Existing API / React state | Status | Acceptance test needed |
|---|---|---|---|
| 2. Server-side RBAC and commercial field masking | API uses profiles, `safeProject`, `safeTask`; React checks permissions | PARTIAL | Test each role via API for pricing and RFQ engineering data |
| 3A. Commercial vs Internal EER cards | React create/edit and API project types | PARTIAL | Validate type-specific fields and LTSE/Senior notifications |
| 3. RFQ project fields, handover, pricing | React editor only exposes basic fields | MISSING | Complete fields, handover stages and commercial editor |
| 4. Task assignment and in-app notification | API supports assignment; React task editor basic | PARTIAL | Assignment notification, status updates, shared dashboards |
| 5. Dependency, escalation/bottleneck, reason drilldown | API validates MH overrun and logs; React lacks flag editor/drilldown | PARTIAL | Flag+reason, private detail drilldown, audit |
| 6A. Common dashboard and escalation indicators | Basic overview counts | PARTIAL | Active projects, flagged tasks, no pricing, detail access |
| 6A. Daily capacity, bookings, leave | React shows aggregate workload only | MISSING | Day-by-day capacity and leave |
| 6B. Individual dashboard | React My Work filters assigned tasks | PARTIAL | Progress %, deadlines, editable task status, live sync |
| 6C. Management dashboard | Management metrics basic | PARTIAL | Pricing, drilldown and profitability |
| 7. Filterable reports and export | API CSV endpoints; React has basic stats | PARTIAL | Export buttons, report filters and permissions |
| 8. Notifications | Backend notification records | MISSING in React | In-app notification center, unread/read |
| 8. Audit history | API audit records; React timestamp/activity mapping corrected | PARTIAL | Verify all field changes, assignments, escalations, filters |
| 9. Commercial data inaccessible to LTSE and below | Backend masking intended | UNVERIFIED | Unauthorized HTTP response assertions |
| 9. One source of truth | React consumes Node API | IMPLEMENTED architecturally | Confirm updates reflected in both views |
| 9. Complete audit trail | Backend audits many writes | PARTIAL | Cover every relevant mutation |
| 9. Exportable/reportable data | Backend CSV endpoints exist | PARTIAL | React UI + role checks + complete datasets |

## QA status
- Automated checks added: TypeScript build, ESLint, isolated Node API smoke test, GitHub Actions workflow.
- **No successful local build, lint, API smoke or browser run has been observed from this environment.** CI must run and pass before claiming these checks passed.
- UI regression, role-by-role RBAC tests, workflow designer, object configuration, import/export, notification center, accessibility and cross-browser tests remain open.
- **Release decision: NOT READY FOR PRODUCTION.**

## Safe test commands
From repository root:
```powershell
git switch react-migration
git pull
npm install --prefix react
npm run qa:react
```
API tests use a temporary data directory and never touch the local `data/db.json`. Keep a backup of production data before deploying.
