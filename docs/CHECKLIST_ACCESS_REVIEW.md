# Checklist access and logic review — 6 November 2026

## Effective access model

| Role/capability | Own assigned daily records | Other staff records/notes | Template management | Change another person’s record |
|---|---|---|---|---|
| System Administrator / Admin | Yes, when assigned a template | Yes | Yes | Never |
| Senior Management / LTSE / TSE/JTSE defaults | Yes, when assigned | No | No | Never |
| Explicit Review Shift Checklists grant | Yes, when assigned | All staff; read only | No, unless separately granted | Never |
| Explicit Manage Shift Checklists grant | Yes, when assigned | No, unless separately granted | Yes | Never |

Permissions are enforced on API reads/writes, JSON exports and audit visibility. View Reports, Export Data, Manage Users, project ownership and project sign-off authority do not themselves grant staff checklist access. Only System Administrator can edit permission-profile definitions. A delegated reviewer is an organisation-wide reader, not a department/team-scoped reviewer; delegate only to trusted roles.

A one-time policy migration removes the old automatic checklist grants from the built-in Senior Management profile. It preserves explicit custom-role grants and any later deliberate regrant. Admin/System Administrator retain protected administrative capabilities. Existing checklist records, snapshots, templates and answers are not deleted.

## Logic corrections

- Personal and reviewer scopes are separated before pagination. My shift/My Work requests `scope=mine`; My history requests `scope=history`; staff review and templates each require their own explicit scope/permission. Bare legacy catalogue reads remain permission-filtered for compatibility.
- Personal history can no longer be crowded out by the last 100 organisation-wide records. Scoped history/review support validated pagination, date/status filters and staff filtering for reviewers. Templates do not return staff runs/history and personal views do not return staff lists.
- Server-generated edit/reopen flags use the record’s immutable saved time zone, matching PATCH enforcement. Browser time-zone changes do not unlock a past saved record. Starting work still uses the selected/browser work-date zone; this is a readiness/handover tool, not an authoritative attendance clock. A company-wide work-date policy would require an agreed configuration.
- Refresh after confirmed discard remounts the run form so unsaved ticks/notes are actually cleared. Stale scoped responses cannot overwrite a newly selected view. Submission/reopen and revision conflicts remain server-enforced.
- Template archiving or role reassignment prevents new starts but retains already-started personal snapshots. Owners may finish/reopen their own current-day snapshot under the same rules; past snapshots remain read-only. Reviewers cannot submit, reopen or correct records for owners.
- Permission changes remount the relevant workspace on the next successful session poll. Invalid sessions clear the signed-in interface, including while project inputs are focused. Active editors retain normal data-refresh protection when application access is unchanged; API permissions are checked on every request regardless of cached UI state.
- Checklist notes are not a protected project-document store. Do not paste restricted pricing or financial documents there. An authorised global reviewer can read all checklist notes; free text is not automatically classified by project financial permissions.

## Verification boundary

Focused negative tests cover staff A/B isolation, independent template/review roles, defaults/delegation/revocation, role spoof attempts, concurrent start idempotency, submitted locks, required answers, audit/export filtering and offboarding. Deterministic unit checks cover a midnight time-zone boundary and personal history beyond 100 other staff records. Browser checks cover paged review, template-only visibility, actual discard of edits, role revocation and focused-form session invalidation. Full API/browser regressions cover the surrounding application flows.

These checks are not a claim that every possible business rule or production threat is proven safe. Company identity/MFA, actual infrastructure, independent security assessment, recovery acceptance and realistic customer acceptance remain separate production gates.

## Additional ownership/privacy findings closed in this review

Task update/time-entry execution and workflow ownership now check stable assignee IDs. Existing unambiguous name-only records are bound once; unresolved/ambiguous records receive a null owner ID and cannot be claimed automatically by later roster changes. Explicit reassignment by a permitted lead resolves them; the System Administrator data-quality endpoint lists unresolved tasks. Renaming an account updates current task/leave display labels without changing historical actors or user IDs. Normal name-based assignment controls remain for compatibility: names must be distinct when making a new selection; the API additionally accepts an explicit assigneeId. Fully ID-based/disambiguated selection in every legacy planning control remains a usability improvement, not an alternative authorisation path.

Personal notification recipients and per-user read state are bound to IDs; role notices use stable profile IDs. A duplicate/reused display name cannot acquire old personal notices or another user's read state. Ambiguous legacy names fail closed. Capacity calculations use bound task/leave IDs. Bootstrap exposes private leave records/notes only to the record owner or Manage Leave; the capacity board still provides authorised absence summaries.

Regression checks cover duplicate names, a later rename/reused old name, task update/time-entry denial for the wrong user, private notice/leave isolation and explicit reassignment. This closes identified cases; it does not imply every legacy presentation uses IDs internally.
