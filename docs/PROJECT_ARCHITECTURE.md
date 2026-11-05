# ETS IPM Project Architecture

## Operating model
The application uses one common **Project Register** as the operational source of truth. Current project types are:
- Commercial RFQ
- Internal EER

These appear as tabs within the common register rather than separate top-level modules.

## Project Type vs Workflow
A **Project Type** defines what kind of project is being managed. A **Workflow** defines the lifecycle stages used by that project type.

Current defaults:
- Commercial RFQ → RFQ → Awarded → In Progress → Escalated → Completed
- Internal EER → Raised → Review → Planning → In Progress → Sign-off → Completed

## Workflow objects
Workflows may contain configurable objects and sub-objects. Examples in the demo include Commercial Details, Engineering Planning, Request Details, Planning, Project Information, Project Members and Sign-off.

Each object has profile-level access values:
- Hidden
- View
- Edit

This is intended to support the FRD distinction between restricted commercial data and engineering/task information.

## Configuration areas
Project Configuration contains:
- Project Types
- Workflows
- Register Configuration
- Object Configuration
- Resource Configuration
- System Settings

Resource Planning groups Capacity, Manpower Plan and Team/Availability instead of exposing each as an unrelated top-level module.

## Demo persistence boundary
Core projects, tasks, users, RBAC, comments, audit, leave and tracker imports remain handled by the Node application and JSON demo datastore. The newly introduced workflow/project-type/object/register configuration designer is persisted in browser localStorage for the demo. Production implementation should persist these definitions in the application database and enforce object permissions server-side.

## Production direction
A production configuration model should persist ProjectType, Workflow, WorkflowStage, ObjectDefinition, FieldDefinition, ObjectPermission and RegisterView entities in a relational database. Runtime APIs should then resolve project layout, stage transition rules and field/object permissions from those definitions.