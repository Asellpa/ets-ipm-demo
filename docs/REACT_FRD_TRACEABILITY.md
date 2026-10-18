# React migration acceptance evidence

Source: Department_Task_Tracker_FRD.pdf (7 pages, sections 1–9).

Updated 18 October 2026. Verified browser baseline: https://github.com/Asellpa/ets-ipm-demo/actions/runs/39129349168 . Development branch only. Production approval remains pending.

| Requirement | Implementation | Verification |
|---|---|---|
| Role permissions / commercial field security | Server permission matrix, commercial masking, RFQ engineering access, task ownership enforcement, report/export filtering | Isolated API regression passed for Admin, Senior Management, LTSE and TSE; existing browser security tests retained |
| Commercial and Internal EER cards | Detailed project editor, commercial field group, management-controlled handover, EER stakeholder notifications | API regression passed; existing detailed editor browser test retained |
| Task assignment / execution | Task and work package editors, planned dates, actual MH, editable My Work, assignment notifications | API lifecycle and ownership regression passed; My Work browser regression passed in baseline CI |
| Dependency / escalation | Mandatory flag reasons, MH overrun validation, visible flag badge, detail and history pane, timestamped comments | Isolated validation, comments, escalation and audit checks passed |
| Common / individual dashboards | Shared API records; personal task filtering; automatic refresh every 3 seconds; common flags omit reasons | My Work browser regression passed in baseline CI; polling provides eventual updates, not a push subscription |
| Daily capacity / leave | Daily booked/free capacity, weekends, leave creation/removal, overbooking label; packages excluded from totals | API calculation, permissions, invalid dates, duplicate leave and removal passed; browser test passed in baseline CI |
| Management reports | Project/status/assignee/client/sector/release/date/flag filters, CSV, numeric quote versus explicit labour rate | Existing reporting test retained; actual download regression passed in baseline CI |
| Full data export | Permission-filtered JSON for projects (including empty projects), tasks, comments, escalation records, leave, audit and roster; no password hashes | API export and credential exclusion passed |
| Tracker import / team availability | CSV parser with quoted-field handling, preview, validation, append-only WBS import; editable team capacity | API checks reject invalid imports without partial writes; browser import test passed in baseline CI |
| Notifications / audit | In-app notifications, read tracking, change details and audit filters; audit retention cap removed | Assignment / EER / escalation notification and field-change checks passed |
| Workflow / administration parity | Server-backed node designer, hierarchy, completion-rule and profile metadata, project-type binding, user/role editors | API round-trip and cycle validation passed; designer browser test passed in baseline CI |

## Limits and release gate

- Database writes use atomic replacement and serialized mutations; concurrent-write regression passed.
- Build and ESLint passed locally. Both isolated Node API test suites passed.
- New Chromium regressions passed in GitHub Actions run 39129349168 (12 / 12 Chromium tests, commit bb709444). Final refinements are rerun on each push.
- Completion rules in the designer are saved configuration metadata. This increment does not implement a new runtime approval/sign-off engine; that is outside the supplied FRD and must not be advertised as enforced runtime behavior.
- Labour-cost reports require an explicit rate and numeric pricing in a consistent currency. They do not infer a currency or include non-labour costs.
- Tests use temporary copies of seed.json. Regression checks assert the working data/db.json is unchanged.
- No production deployment, no main changes, and no existing database reset.
- Final user acceptance, hosted staging and deployment validation remain required; a green suite is not a full production sign-off.
