# Current Build Status

The Users/RBAC correction set has been merged to `main` and the backend/API verification for the role model has passed.

Current build includes:
- Authenticated user accounts with active/inactive and offboarding controls
- Reusable role/permission profiles
- Separate Commercial/Pricing and RFQ Engineering/MH permissions
- Server-side role enforcement and protected-field masking
- Restored project/task, capacity, leave, import/export, reporting, notifications and audit functionality

Remaining release activity:
- Perform a final browser smoke test against the deployed hosted build
- Confirm the public demo is running the latest `main` commit

Production hardening remains outside the demo scope, including persistent relational storage, enterprise identity, centralized logging, automated CI/E2E testing and production secret management.
