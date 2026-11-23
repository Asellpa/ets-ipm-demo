const PERMS = ['manageBusinessRoles','manageCalendar','manageTime',
  'viewClients','manageClients','manageChecklists','reviewChecklists',
  'viewCommercial','createCommercial','viewCommercialFields','viewRFQEngineering','createEER',
  'editProjects','deleteProjects','createTasks','assignTasks','updateActualMH','raiseEscalations',
  'viewCapacity','manageLeave','viewReports','exportData','importData','viewAudit','manageTeam',
  'manageSettings','manageUsers','manageRoles','manageFeedback'
];
const fullPermissions = () => Object.fromEntries(PERMS.map(k => [k, true]));
const DEFAULT_PROFILES = [
  { id:'prof-admin', name:'System Administrator', description:'Full application and administration access', permissions:fullPermissions() },
  { id:'prof-app-admin', name:'Admin', description:'Application administration and business role management; protected system access excluded', permissions:{...fullPermissions(),manageRoles:false} },
  { id:'prof-senior', name:'Senior Management', description:'Full project, commercial, reporting and audit access', permissions:{
    viewClients:true,manageClients:true,manageChecklists:false,reviewChecklists:false,
    viewCommercial:true, createCommercial:true, viewCommercialFields:true, viewRFQEngineering:true, createEER:true,
    editProjects:true, deleteProjects:true, createTasks:true, assignTasks:true, updateActualMH:true, raiseEscalations:true,
    viewCapacity:true, manageLeave:true, viewReports:true, exportData:true, importData:true, viewAudit:true, manageTeam:true,
    manageSettings:true, manageUsers:false, manageRoles:false
  }},
  { id:'prof-ltse', name:'LTSE', description:'Engineering lead access with RFQ engineering visibility and task assignment', permissions:{
    viewCommercial:true, createCommercial:false, viewCommercialFields:false, viewRFQEngineering:true, createEER:true,
    editProjects:true, deleteProjects:false, createTasks:true, assignTasks:true, updateActualMH:true, raiseEscalations:true,
    viewCapacity:true, manageLeave:false, viewReports:false, exportData:false, importData:false, viewAudit:false, manageTeam:false,
    manageSettings:false, manageUsers:false, manageRoles:false
  }},
  { id:'prof-tse', name:'TSE/JTSE', description:'Task execution and Internal EER access', permissions:{
    viewCommercial:true, createCommercial:false, viewCommercialFields:false, viewRFQEngineering:false, createEER:true,
    editProjects:false, deleteProjects:false, createTasks:false, assignTasks:false, updateActualMH:true, raiseEscalations:true,
    viewCapacity:true, manageLeave:false, viewReports:false, exportData:false, importData:false, viewAudit:false, manageTeam:false,
    manageSettings:false, manageUsers:false, manageRoles:false
  }}
];
DEFAULT_PROFILES.find(p=>p.id==='prof-ltse').permissions={...DEFAULT_PROFILES.find(p=>p.id==='prof-ltse').permissions,viewClients:true,manageClients:true,manageCalendar:true,manageTime:true};
DEFAULT_PROFILES.find(p=>p.id==='prof-senior').permissions={...DEFAULT_PROFILES.find(p=>p.id==='prof-senior').permissions,manageCalendar:true,manageTime:true};
module.exports={PERMS,DEFAULT_PROFILES,fullPermissions};
