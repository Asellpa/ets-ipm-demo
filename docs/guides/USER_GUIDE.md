# ETS IPM — user and administrator guide

Maintained with the in-app Help & guides content. Instructions describe current supported actions; access depends on the assigned role and saved project policy.

## Find your way around

Choose the area for the work you need to do.

1. Sign in using the method provided by your administrator. Company sign-in uses your organisation’s identity account; local environments use a username, user ID and password.
2. Use My Work for your assigned tasks and daily shift checklists. Use Project Register to find and open projects; Grid and Kanban show the same records.
3. Open a project by selecting its title in Grid or anywhere on its Kanban card. Use Expand in the project window for more space.
4. Use the notification bell for unread notices. Use Send feedback to report a problem, including the steps and expected result. Never include passwords or confidential documents in feedback screenshots.
5. If an area or action is missing, ask your administrator to check your role and the project’s access rules. Team membership alone does not grant access.

## Complete your daily checklist

Readiness and handover checks belong to you and the displayed work date.

1. Open My Work. Daily shift checklists appears beside tasks on a wide screen and below them on smaller screens. Only templates assigned to your role appear.
2. Check the displayed date and time zone, then select Start checklist for the relevant start-of-shift or end-of-day template.
3. Tick completed items, add handover notes if needed, and choose Save draft before leaving. A tick is not saved until you save or submit.
4. Finish all required items, then choose Submit checklist. Optional items may remain unchecked. Submitted records become read-only.
5. Use Shift Checklists → My history to review previous records. Reopening today’s submitted record requires a reason; it retains history. Template edits do not change existing records.
6. Checklist completion does not log hours, complete project tasks or sign off a project. Reviewers can review staff records but cannot submit on their behalf.
7. My history shows only your records. Use its date/status filters and Previous records / Next records to browse older entries. A record’s saved time zone controls whether it can still be edited or reopened.
8. Archiving a template or changing its role assignment stops new starts; already-started snapshots remain in the owner’s dated records and follow the normal read-only/submission rules.

## Update assigned tasks

Keep execution status and actual work current.

1. Open My Work, find your task and choose Details. Confirm the project, workflow object and assignee before changing it.
2. Update task status using an available task control or Edit, according to your permissions. Save the change and confirm it appears after refresh.
3. Execution may be blocked until preceding workflow objects are complete. Future work can be planned by an authorised lead, but it cannot be executed early.
4. Complete the task only when its work is finished. Task completion is separate from object completion and project sign-off.
5. Flag an escalation or bottleneck with a clear reason when work is blocked. Ask the project manager or supervisor if a locked object needs reopening.

## Log and correct working hours

Record dated time against your own assigned task.

1. Open task Details → Time log, or the linked task’s time log inside a project object.
2. Enter the work date, hours and a useful description, then choose Log time. Only the assignee with Update Actual MH access can log dated time against active work.
3. Future dates and combined totals above 24 hours per person/day are rejected. Logging above the task estimate requires an overrun reason.
4. To correct an entry, select Correct entry and provide a reason. Original values remain in history. Setting hours to zero voids the entry. Completed work must be reopened by an authorised lead first.
5. Reports → Time entries shows dated records and permitted exports. Historical opening balances are separate from dated entries. A formal timesheet approval process is not provided.

## Create and link clients

Use a reusable client profile instead of repeatedly typing names.

1. With Manage Clients permission, open Clients and create the client profile and contact information. Check for an existing profile before adding another.
2. In the project’s configured client field or editable register column, select the client from the list and save.
3. Client summaries show linked projects and permitted task-hour totals. They respect project, object, field and financial access; totals can differ between roles.
4. Archive an unused client instead of removing its history. Existing links remain. Older text-only client values must be explicitly linked; matching text is not automatically a relationship.

## Create a project

A saved workflow must exist before a project can be created.

1. In Project Register choose New project. Select Projects or Internal and an existing workflow. Ask an administrator to configure the workflow first if none is suitable.
2. Enter the project title and select an eligible named project manager or supervisor. Administration-only Sysadmin accounts cannot be project leads.
3. Create the record, then open it. Select the first visible workflow object and fill its configured fields. Choose Save object fields before leaving.
4. The left pane follows the project’s saved workflow order. Existing projects preserve their workflow version when a template changes.
5. Project owner and responsibility fields identify people; the named manager/supervisor controls sign-off authority. These are separate responsibilities.
6. Use Linked projects to relate an Internal project and a Projects record. A link does not combine their tasks, hours, workflows or access.

## Add departments and tasks

Departments group tasks; workflow objects control progression.

1. Open the object configured with the Departments & tasks workspace. New projects do not receive automatic department placeholders.
2. Choose Add department, select a standard option or enter a custom name, and save. Then add the department’s tasks with an active resource assignee, estimate and dates.
3. Use the available Add control to choose the relevant record type. A department/work package groups work; a task records executable work and dated time.
4. When removing a department, choose where its tasks should move: another department or Ungrouped tasks. Task IDs, recorded time and history are retained.
5. Tasks & Departments provides a cross-project view. Ensure each task is linked to the intended saved workflow object.

## Attach and protect documents

Files inherit project/object access and may have additional commercial restrictions.

1. Open the project and select its workflow object. Under Attachments, choose a file, select the appropriate visibility and choose Upload attachment.
2. Supported types are PDF, PNG, JPG, TXT and CSV, up to 2 MB per file. Limits are 20 files per object and 20 MB per project. Closing the file chooser without selecting a file should leave the project open.
3. Use Restricted commercial for budgets, pricing and financial documents, especially files with generic names. Follow object permissions does not mean only the users in a Team members field.
4. Production uploads must pass malware scanning. If scanning is unavailable or a file is rejected, the upload is not accepted; contact your administrator rather than changing the extension.
5. Downloads require access to the project, object and any financial restrictions. Uploads/removal also require appropriate edit access and an unlocked object. Removing a link does not define the backup retention policy.

## Complete objects and sign off a project

Project completion requires an explicit decision by a named project lead.

1. Complete applicable tasks and child objects. Fill and save required fields in the parent object.
2. The assigned project manager or supervisor completes ordinary objects with Complete access. Parent and approval objects also require Approve access and a workflow comment.
3. Select Sign off parent when the object is ready. If blocked, review the displayed prerequisites, required fields, children and linked tasks. System Administrator access alone does not replace the named lead.
4. When all required workflow objects and applicable tasks are complete, open Project Action, enter a project sign-off comment and choose Sign off project.
5. The application records the signatory, time and comment and marks the project Completed. These are recorded application decisions, not cryptographic digital signatures.
6. Reopening requires a reason and appropriate access. It can reopen dependent workflow objects and withdraw final project sign-off; historical task/time records remain.

## Plan resources and read progress

Compare scheduled work with available capacity.

1. Open Resource Planning → Workload to review assigned, unassigned and future tasks. Task leads can set the assignee, estimate, start and due dates.
2. Default allocations spread estimated hours across weekdays in the date range. Custom daily allocations must total the estimate and remain within its dates.
3. Recorded leave and weekend bookings appear as conflicts. The application does not automatically reschedule work around leave.
4. Project task progress counts completed applicable tasks divided by all applicable tasks. Cancelled, No-Go and Not Required tasks are excluded. No applicable tasks shows 0%, not automatic completion.
5. Estimated/actual hours are separate from count-based progress; workflow sign-off is also separate. The dedicated Sysadmin account has no resource capacity or time allocation.

## Use reports and exports

Reports follow the access available to your account.

1. Open Reports and choose the relevant report and filters. Time entries shows dated work records; undated opening balances are excluded from that report.
2. View Reports grants report access. Export Data is additionally required for report CSV downloads.
3. Exports retain project/object/field and financial restrictions. Never treat an ordinary JSON export as a full operational backup: it is permission-filtered and does not contain all system configuration.
4. CSV tracker import provides preview and row validation. Native Excel import is not supported; prepare and check a CSV copy instead. Ask an administrator before importing operational records.

## Configure workflows and forms

Define the project structure before users create records.

1. Open Project Settings → Workflows → Open Designer. Add parents and children; use Move earlier / Move later to set sibling order.
2. Choose Configured fields, Departments & tasks or Dates & hours for the object workspace. Add field labels, types, required flags and relevant register mappings.
3. Use database-backed user/team selectors for responsibility fields. These fields record responsibility without granting permissions.
4. Sequential objects wait for the preceding sibling group. Parallel with previous sibling joins that group; the next group waits for every member. Children and required sign-off still apply.
5. Save the workflow before creating a project. Structural edits apply to new project snapshots; they do not rearrange existing projects.
6. Configure role access under Project Settings → Field permissions, not in the workflow designer.

## Manage access and register fields

Application permissions, object rules and field rules are cumulative restrictions.

1. Assign existing role profiles under Manage Users. Only System Administrator can manage role profiles. Admin can administer permitted areas without acquiring the protected role-management capability.
2. Role Management controls application capabilities such as creating projects, assigning tasks, reports and commercial-data access.
3. Project Settings → Field permissions → Objects & sign-off controls Hidden, View, Edit, Complete and Approve. Unspecified access inherits from the ancestor; a hidden ancestor hides descendants.
4. The Fields matrix controls Inherit, Hidden, View and Edit. A field rule cannot expand object access, bypass workflow locks, grant financial access or replace a named lead.
5. Saving template policies applies to new projects. The explicit existing-project option updates matching access rules without replacing structure, values or sign-offs. Review the affected records before choosing it.
6. Register configuration controls column visibility/editability and project-type tab order. Showing a column does not grant access to its data.
7. Financial protection remains separate. Team/owner fields do not grant extra access, pricing visibility or sign-off authority. Test sensitive changes with representative accounts.

## Manage users and checklist templates

Maintain named accounts and role-specific daily checks.

1. Use Manage Users to create named accounts and assign the least-privileged suitable profile. In company sign-in environments, each active account needs a unique email matching the identity provider.
2. Offboard users when they leave. Company identity administrators must also revoke their identity sessions/access. Retain historical work attribution.
3. Keep the dedicated Sysadmin account for administration. Named working administrators can have resource capacity; the dedicated account cannot receive tasks or log time.
4. Open Shift Checklists → Templates to create/edit a template, choose Start of shift or End of day, select assigned roles and add individual items.
5. Mark required items, remove unwanted rows and save the active template. Paste item list is available for bulk entry; “? ” marks an optional item.
6. Template changes affect future runs. Assign System Administrator explicitly if that account should receive a checklist; it has no default operational template. Staff review is read-only and does not permit submitting for another user.
7. System Administrator and Admin receive template management and staff review by default. Senior Management and staff do not. System Administrator may explicitly delegate either permission. Template management does not grant access to staff notes; staff review reads all staff, not only a project team, and never permits completing another person’s checklist.
8. Use distinct display names, such as Alex Smith (1309), when people share a name. Ambiguous name-based task selections are rejected; changing a name does not transfer existing task ownership.

## Resolve common problems

Check saved state before retrying a change.

1. If a save fails or the connection drops, reopen the record and check whether the change was saved before retrying. Include the page, approximate time and steps in feedback.
2. For a blocked sign-off, check the named manager/supervisor, Approve access, required fields, child objects and applicable tasks. Save fields before signing off.
3. For missing data/actions, ask the administrator to check your application profile and the saved project’s object/field policies. A register column setting is not an access grant.
4. If no checklist appears, confirm an active template is assigned to your current role and check the displayed date. Existing runs retain their original items.
5. If you cannot sign in or the whole application is unavailable, contact your company’s support channel. In-app feedback requires a working signed-in session.
6. Notifications are in-app; email delivery is not provided. Status/priority colours supplement labels: yellow hold, green ongoing/low priority, red lost/cancelled/high priority, teal complete, purple review and blue not started/normal priority.

