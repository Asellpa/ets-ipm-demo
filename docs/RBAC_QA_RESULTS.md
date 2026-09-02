# ETS IPM — RBAC / Users QA Results

Date: 2026-09-02
Branch: `security-rbac-qa`

## Verified backend checks

- Server syntax check: PASS (`node --check`).
- System Administrator login (`Stephan` / `123` / `Testing`): PASS.
- LTSE commercial pricing masking: PASS.
- LTSE Commercial RFQ engineering/MH visibility: PASS.
- LTSE task assignment permission: PASS.
- TSE/JTSE commercial pricing masking: PASS.
- TSE/JTSE Commercial RFQ engineering/MH masking: PASS.
- LTSE Commercial project creation blocked server-side: PASS (403).
- TSE/JTSE Commercial project creation blocked server-side: PASS (403).
- TSE/JTSE Internal EER creation: PASS (201).
- TSE/JTSE task creation/assignment blocked server-side: PASS (403).
- Capacity API restored: PASS (200).
- Import API restored: PASS (200).
- System Administrator profile protection: PASS (attempt to disable protected admin permission returns 400, not 500).
- Custom profile creation: PASS.
- User creation and login with assigned custom profile: PASS.
- Unauthorized role-administration access blocked server-side: PASS (403).
- Password reset revokes existing sessions: PASS (old session 401).
- Old password rejected after reset: PASS (401).
- New password accepted after reset: PASS (200).
- Offboard action disables login: PASS (401 after offboarding).
- Assigned custom profile deletion blocked: PASS (409).
- Duplicate username/User ID protection: PASS (409).
- Administrator self-deactivation protection: PASS (400).
- User/profile administration actions recorded in audit history: PASS.

## Corrections included

- Added separate `viewRFQEngineering` permission so LTSE RFQ engineering/MH access is not tied to pricing visibility.
- Restored Capacity, Import, Team Roster compatibility and Leave-delete routes removed during the initial Users/RBAC rewrite.
- Fixed Role Management profile update runtime issue.
- Added username/User ID uniqueness validation on edit and create.
- Added assigned-profile validation.
- Added self-lockout and last-active-administrator safeguards.
- Protected the System Administrator profile from permission removal.
- Historical user records are preserved when offboarding/deactivating.

## Remaining validation

A browser-level smoke test on the deployed Render build is still required after merge/deployment. This QA pass verifies backend/API behavior and syntax, not full visual browser interaction.
