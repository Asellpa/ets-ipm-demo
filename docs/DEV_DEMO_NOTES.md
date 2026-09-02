# ETS IPM — Dev Demo Notes

This build is suitable for a client/developer walkthrough of the current application architecture and role model.

## Demo administrator
- Username: Stephan
- User ID: 123
- Password: Testing

## Users administration
Use **Users → Manage Users** to create accounts, assign profiles, activate/deactivate, reset passwords, and offboard users while preserving historical records.

Use **Users → Role Management** to manage reusable permission profiles. The logged-in user's profile is enforced server-side; the legacy browser role simulator is hidden and no longer controls authorization.

## Important permission split
Commercial pricing access and Commercial RFQ engineering/MH access are intentionally separate:
- Senior Management: pricing + RFQ engineering/MH.
- LTSE: no pricing, but RFQ engineering/MH access and assignment authority.
- TSE/JTSE: no pricing and RFQ engineering/MH fields are masked before handover; cannot assign tasks.

## Demo persistence note
The current demo uses JSON-file persistence. On Render free hosting, data may reset on service restart/redeploy. A production deployment should use a relational database and enterprise authentication such as Entra ID.
