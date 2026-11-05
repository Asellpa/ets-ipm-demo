# ETS IPM Source Parity Matrix

Sources reviewed: Department Project & Task Tracking FRD, ETS Work Tracker prototype (Trial 10), and the supplied ETS tracker field structure.

## Functional requirements

| Requirement | Demo status | Notes |
|---|---|---|
| Commercial and Internal EER project types | Implemented | Commercial creation restricted; Internal EER available to engineering roles. |
| Server-side RBAC / field masking | Implemented | Pricing/commercial and RFQ engineering/MH are separate permission groups. |
| LTSE RFQ engineering visibility | Implemented | LTSE sees engineering/MH fields without pricing. |
| TSE/JTSE RFQ engineering masking | Implemented | Protected pre-handover engineering fields are removed from API responses. |
| L1 Project → L2 Work Package → L3 Task | Implemented | Automatic child WBS generation. |
| Task assignment LTSE+ | Implemented | Assignment authority enforced server-side. |
| Assignment notification | Implemented | In-app notification generated. |
| Status / MH tracking | Implemented | Status, estimated MH and actual MH available. |
| MH overrun escalation/bottleneck reason | Implemented | Save is blocked unless the overrun is classified and reason supplied. Imported overruns receive an import reason where the source has none. |
| Comments and audit history | Implemented | Timestamped user activity retained. |
| Common / individual / management views | Implemented for demo | Overview, My Tasks, management reporting and permission-specific data responses. |
| Capacity / leave view | Implemented | Seven-day booked/free capacity and leave. |
| Reporting / CSV export | Implemented | Workload, escalation, MH variance and tracker exports. |
| User administration and reusable permission profiles | Implemented extension | Manage Users and Role Management requested after the FRD. |

## Tracker workflow parity

The client's prototype workflow is: open the tracker UI, import the ETS tracker, and construct the WBS hierarchy from the file. The demo now accepts CSV, XLSX, XLS and XLSM from the Import action. The preferred worksheet is selected by a name containing `ETS Work Tracker`; otherwise the first worksheet is used.

Level 1 rows import as project records. Level 2 rows import as work packages. Level 3+ rows import as tasks. Internal EER groups are created as Internal EER project records rather than being incorrectly treated as Commercial projects.

A management-only **Tracker Data** view retains and displays the complete imported source row/column set in the browser for parity checking. This view is deliberately unavailable to roles without import permission so raw Commercial columns are not exposed through the UI.

## Source fields checked

The parity view checks for the following source fields and reports missing columns after an import:

`WBS`, `Level`, `EER #`, `Sub Dept`, `CLIENT`, `Aircraft`, `A/C Reg`, `Project`, `Details`, `DOA Scope`, `MRO Release`, `Task Classification`, `ETS Sub-Dept`, `Owner`, `Priority`, `Status`, `Client Focal`, `Escalation`, `Customer Support`, `DOA focal`, `MH Estimations`, `Actual MH`, `Current Man Power`, `Workshare Status`, `ROM`, `PO Status`, `Action Items`, `Remarks`, `Start Date`, `Completion Date`, `Card Type`, `Stage`, `Escalation Flag`.

Core project/task fields are mapped into the application model. The management-only source grid is retained so fields used by the existing tracker remain visible during the demo even where they do not yet have a dedicated normalized database column.

## Demo limitation

This remains a demo/pilot architecture. Core project/task/user data is stored by the Node application in JSON. The full imported source-grid copy used for parity inspection is browser-local in this build. Production implementation should move both normalized records and original import metadata into a relational database/import-staging table and replace demo hosting persistence with managed storage.