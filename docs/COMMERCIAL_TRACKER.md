# Commercial tracker template

Based on the supplied `ets-work-tracker Trial 14.html` field definitions and the headers of `ETS Project Tracking - 2026 (A to Z) 06-08-2026(1).csv`. Source files were inspected only. Customer records were not imported or committed.

Choose **Project Register → Commercial RFQ → + New project → Commercial tracker**. Save the minimal record, then enter the configured fields in its object pages. Values begin blank. The lifecycle remains Overview, Planning, Implementation, Review & Approval, Delivery, Closure. Every parent still needs named manager/supervisor sign-off after its children and tasks finish.

| Object | Fields from the current tracker |
| --- | --- |
| Overview | Project, CLIENT, Details, Start Date, Priority, Request Date |
| Aircraft & scope | Aircraft, A/C Reg, DOA Scope, MRO Release |
| People & contacts | Owner, Client Focal, DOA focal, Customer Support |
| Programme & references | Programme, Sage, Site, Internal Client, Project Timeline, NRE Status |
| Commercial & quotations | ROM, PO Status, BU-BU MH Rate (AED), Internal Quote (AED), Demande d'achat, Internal Quote Status, Internal PO Status, External Quote Value, negotiation notes, offer/agreement details |
| Planning / Work classification & workshare | Expected delivery date, planning notes, Task Classification, ETS Sub-Dept, Workshare Status |
| Planning / Team & supervision | Team responsibilities, required inputs; named manager/supervisor come from the project record |
| Implementation | Action Items, Escalation / blocked by, Remarks |
| Review & Approval | Review comments |
| Delivery | Deliverables, Completion Date |
| Closure | Closure notes |

Overview children run in parallel so users can enter aircraft, contact and quotation details together. Contact fields accept names without fixing them to the source file's historic staff roster. Keep Owner separate from the named project manager/supervisor, because the latter control sign-off.

WBS and Level describe generated hierarchy rather than editable form fields. Card Type comes from creation. Status and Stage stay on the project record. MH Estimations and Actual MH are task rollups, with actual time entries preserved; do not enter a second total in the template. Current Man Power is derived from task assignments rather than a separate staffing commitment. Escalation flags/reasons remain tied to tasks; project-level blocked-by text is available under Implementation.

Commercial & quotations is hidden from the standard LTSE/TSE profiles; all of its field values also use the restricted commercial data group. Existing server-side commercial and RFQ engineering access rules remain in force. Commercial tracker is restricted to commercial projects. The Internal EER template is unchanged.

The Commercial RFQ register has Grid and Kanban views of the same records. Expand grid rows for individual tasks. Kanban defaults to the current tracker's Status grouping, with Commercial stage and Workflow phase alternatives. Status/stage can be changed by permitted leads using a dropdown or by dragging into an existing column. Workflow phase is read-only and follows execution/sign-off. Marking a project Completed is rejected until all workflow objects are complete.

The template is installed once. When the untouched built-in Commercial project is the default, new commercial projects default to Commercial tracker. Custom defaults, customised templates and existing project snapshots are preserved. Administrators can edit the template and change the default in Project Configuration. No existing project is silently migrated to this workflow.
