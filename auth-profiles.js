const PERMS = [
  'viewCommercial','createCommercial','viewCommercialFields','viewRFQEngineering','createEER',
  'editProjects','deleteProjects','createTasks','assignTasks','updateActualMH','raiseEscalations',
  'viewCapacity','manageLeave','viewReports','exportData','importData','viewAudit','manageTeam',
  'manageSettings','manageUsers','manageRoles','manageFeedback'
];
const fullPermissions = () => Object.fromEntries(PERMS.map(k => [k, true]));
const DEFAULT_PROFILES = [
  { id:'prof-app-admin', name:'Admin', description:'Application administration without system administrator or role administration access', permissions:{...fullPermissions(),manageRoles:false} },
  { id:'prof-admin', name:'System Administrator', description:'Full application and administration access', permissions:fullPermissions() },
  { id:'prof-senior', name:'Senior Management', description:'Full project, commercial, reporting and audit access', permissions:{
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
module.exports={PERMS,DEFAULT_PROFILES,fullPermissions};
