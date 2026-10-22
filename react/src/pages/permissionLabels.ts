export const permissionLabels:Record<string,{label:string;help:string}> = {
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
    "help": "Access task breakdown and MH/engineering fields on Projects before handover before handover. This is deliberately separate from pricing access."
  },
  "createEER": {
    "label": "Create Internal",
    "help": "Create Internal project cards."
  },
  "editProjects": {
    "label": "Edit Projects",
    "help": "Change project details and lifecycle."
  },
  "deleteProjects": {
    "label": "Delete Projects",
    "help": "Delete projects and child records."
  },
  "createTasks": {
    "label": "Create Tasks / Work Packages",
    "help": "Create and delete work packages/tasks."
  },
  "assignTasks": {
    "label": "Assign Tasks & Estimates",
    "help": "Assign users and maintain estimates/dates."
  },
  "updateActualMH": {
    "label": "Update Actual MH",
    "help": "Enter actual man-hours."
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
    "help": "Create and edit permission profiles."
  }
};

permissionLabels.manageFeedback={label:'Manage Feedback',help:'Review all demo feedback, view attached screenshots and update status and reviewer notes. Users without this permission see only their own submissions.'};
