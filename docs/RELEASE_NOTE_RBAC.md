# Release note — Users and RBAC hardening

The Users/Role Management implementation has been hardened before client/developer review. Authorization is now derived from the authenticated user's assigned profile and enforced on the server. LTSE Commercial RFQ engineering/MH visibility is separated from pricing visibility, TSE/JTSE RFQ engineering fields are masked server-side, lost compatibility routes have been restored, and administrator lockout protections have been added.

See `FRD_TRACEABILITY.md` and `RBAC_QA_RESULTS.md` for requirement mapping and QA evidence.
