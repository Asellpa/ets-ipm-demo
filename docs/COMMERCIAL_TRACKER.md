# Projects and Internal demo guide

The active catalogue is reset once to **Projects** and **Internal**, as requested. Existing project records keep their saved workflow snapshots. No sample projects are added to the demo database. Later administrator edits and new templates are preserved.

## Project structure

WBS means Work Breakdown Structure. Level 1 is a project, Level 2 a department, and Level 3 a task. Codes are generated. The standard departments are Method & Industrialization, Projects & Support and Certification. The popup shows these as empty department panels; database groups/tasks are created only by a user action.

## Template fields

Projects contains Overview (Project details, Aircraft & scope, People & contacts, Programme & references, Commercial & quotations, Work classification), Dates & hours, Departments & tasks, and Review & closure. The first three run in parallel, allowing work to start while the overview is being completed. Prices remain protected by commercial-field permissions. Dates are validated and actual hours are derived from task time entries rather than a duplicate manual form total.

Internal keeps the prior default Internal workflow fields/lifecycle. The type is displayed as Internal. Existing saved workflows retain their fields and history.

## Everyday use

Open Project Register, create a record using Projects or Internal, and open it from Grid or Kanban. The popup defaults to department tasks. Use Add department or Add task, set owners, priorities and task statuses inline. Expand switches to a full-window view; Restore returns to the popup. Overview provides configured forms and workflow sign-off. Dates & hours shows schedule fields and project hour totals. Linked projects connects Projects with Internal records without copying tasks or merging progress.

Task progress is completed applicable leaf tasks divided by all applicable leaf tasks. Department rows do not count as tasks. Lost/Cancelled, Not Required, No-Go (Client), No-Go (DOA), and Lost (DOA) are excluded. Empty/all-excluded sets display 0% and No applicable tasks. Hours and parent estimates do not change this count-based measure. 100% task progress does not imply workflow sign-off. Project completion requires both applicable tasks and workflow objects to be complete.

## Register configuration

Administration → Register Configuration controls visible and editable grid fields. Project remains visible. WBS, workflow phase, task progress and hour totals are calculated. Column visibility does not grant access to restricted data. Register edits require both field editability and role permissions. The server rejects attempts to edit disabled register fields.

## Linking and access

Only users with project editing permission and access to both records can create/remove links. Links are visible only when the user can access both projects. Linking is a contextual relationship, not a dependency or shared progress rollup. Unlinking removes only the relationship. Deleting a project removes its links.
