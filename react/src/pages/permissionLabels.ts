export const permissionLabels:Record<string,{label:string;help:string}> = {
viewClients:{label:"View Client Profiles",help:"Read client contacts and linked projects. Project and field permissions still filter linked work and hours."},
manageClients:{label:"Manage Client Profiles",help:"Create, edit and archive clients. Requires View Client Profiles."},
manageChecklists:{label:"Manage Shift Checklists",help:"Create, edit and archive role-based templates. Does not grant access to other staff records. Admins only by default; System Administrator can delegate."},
reviewChecklists:{label:"Review Shift Checklists",help:"Read drafts, submissions and notes for ALL staff, not just your project/team. Cannot change or submit for anyone else. Admins only by default; delegate only to trusted reviewers."},
  "viewCommercial": {
    "label": "View Projects",
    "help": "See Project cards and RFQs."
  },
  "createCommercial": {
    "label": "Create Projects",
    "help": "Create new Projects."
  },
  "viewCommercialFields": {
    "label": "View Commercial / Pricing Fields",
    "help": "Access restricted pricing, ROM, negotiation, offer and agreement data."
  },
  "viewRFQEngineering": {
    "label": "View RFQ Engineering / MH Fields",
    "help": "Access task breakdown and MH/engineering fields on Projects before handover. This is deliberately separate from pricing access."
  },
  "createEER": {
    "label": "Create Internal",
    "help": "Create Internal project cards."
  },
  "editProjects": {
    "label": "Edit Projects",
    "help": "Edit register-level project details, subject to field rules and locks. Workflow object forms use the Objects & sign-off matrix; neither grants task assignment, pricing access or named-lead authority."
  },
  "deleteProjects": {
    "label": "Delete Projects",
    "help": "Delete projects and child records."
  },
  "createTasks": {
    "label": "Create Tasks / Departments",
    "help": "Create and delete tasks and department groups, subject to workflow access and locks."
  },
  "assignTasks": {
    "label": "Assign Tasks & Estimates",
    "help": "Assign users and maintain estimates/dates."
  },
  "updateActualMH": {
    "label": "Update Actual MH",
    "help": "Record actual man-hours for an eligible named resource account. Logging dated time is limited to the task assignee."
  },
  "raiseEscalations": {
    "label": "Raise Escalations / Bottlenecks",
    "help": "Set escalation/bottleneck flags and reasons."
  },
  "viewCapacity": {
    "label": "View Capacity",
    "help": "Access capacity/manpower information."
  },
  "manageLeave": {
    "label": "Manage Leave / Availability",
    "help": "Add leave, OOO and training."
  },
  "viewReports": {
    "label": "View Management Reports",
    "help": "Access management reporting."
  },
  "exportData": {
    "label": "Export Data",
    "help": "Download tracker exports."
  },
  "importData": {
    "label": "Import Data",
    "help": "Import tracker data."
  },
  "viewAudit": {
    "label": "View Audit Trail",
    "help": "Read audit/history records."
  },
  "manageTeam": {
    "label": "Manage Team Roster",
    "help": "Maintain operational team roster."
  },
  "manageSettings": {
    "label": "Manage System Settings",
    "help": "Change application/field settings."
  },
  "manageUsers": {
    "label": "Manage Users",
    "help": "Create, activate, reset and offboard accounts."
  },
  "manageRoles": {
    "label": "Manage Roles",
    "help": "Reserved for the built-in System Administrator profile. It cannot be delegated to a custom role."
  }
};

permissionLabels.manageFeedback={label:'Manage Feedback',help:'Review all demo feedback, view attached screenshots and update status and reviewer notes. Users without this permission see only their own submissions.'};
