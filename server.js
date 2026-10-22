const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const WF=require('./workflow-runtime');
const Register=require('./register-fields');

const PORT = process.env.PORT || 5174;
const ROOT = __dirname;
const DATA = process.env.ETS_DATA_DIR ? path.resolve(process.env.ETS_DATA_DIR) : path.join(ROOT, 'data');
const DB = path.join(DATA, 'db.json');
const SEED = path.join(DATA, 'seed.json');
const sessions = new Map();
const SERVER_VERSION=(()=>{try{return require('child_process').execFileSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT,stdio:['ignore','pipe','ignore']}).toString().trim()}catch{return 'unversioned'}})();

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(DB) && fs.existsSync(SEED)) fs.copyFileSync(SEED, DB);

const {PERMS,DEFAULT_PROFILES,fullPermissions}=require('./auth-profiles');

// Permission values must be booleans; coercing strings such as "false" grants access.
function profilePermissionError(value){
  if(value===undefined)return '';
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Permissions must be an object of boolean values';
  for(const [key,enabled] of Object.entries(value)){
    if(!PERMS.includes(key))return 'Unknown permission: '+key;
    if(typeof enabled!=='boolean')return 'Permission '+key+' must be true or false';
  }
  return '';
}
const WORKFLOW_ACCESS = new Set(['hidden','view','edit','complete','approve']);
function normalizeWorkflowPermissions(config,profiles){
  if(!config)return null;
  const cfg=structuredClone(config);
  for(const w of cfg.workflows||[])for(const item of [...(w.nodes||[]),...(w.objects||[])]){
    if(item.permissions===undefined)continue;
    if(!item.permissions||typeof item.permissions!=='object'||Array.isArray(item.permissions))throw Error('Workflow profile permissions must be an object');
    const result={};
    for(const [key,value] of Object.entries(item.permissions)){
      const profile=profiles.find(p=>p.id===key)||profiles.find(p=>p.name===key);
      if(!profile)throw Error('Workflow references an unknown profile: '+key);
      if(!WORKFLOW_ACCESS.has(value))throw Error('Invalid workflow access for '+profile.name+': '+value);
      // Stable profile IDs take precedence over old name-based keys.
      if(key===profile.id||!Object.hasOwn(result,profile.id))result[profile.id]=value;
    }
    item.permissions=result;
  }
  return cfg;
}
const DEFAULT_PROFILE_IDS = new Set(DEFAULT_PROFILES.map(p => p.id));

function id(prefix){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function now(){ return new Date().toISOString(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')){
  return { passwordSalt:salt, passwordHash:crypto.scryptSync(String(password), salt, 64).toString('hex') };
}
function verifyPassword(password, user){
  if(!user?.passwordHash || !user?.passwordSalt) return false;
  const got = crypto.scryptSync(String(password), user.passwordSalt, 64);
  const exp = Buffer.from(user.passwordHash, 'hex');
  return got.length === exp.length && crypto.timingSafeEqual(got, exp);
}
function normalize(db){
  db.users ||= []; db.projects ||= []; db.tasks ||= []; db.notifications ||= []; db.audit ||= [];
  db.projectWorkflows ||= {};
  db.projectLinks ||= [];
  db.workflowConfig=WF.upgradeConfig(db.workflowConfig);
  db.feedback ||= []; db.comments ||= []; db.escalations ||= []; db.leave ||= [];
  db.settings ||= { standardHoursPerDay:8, commercialFields:['pricing','rom','poStatus','negotiationNotes','offerDetails','agreementDetails'], departments:['Certification','M&I','P&S','Engineering','DOA','Internal'] };
  db.profiles ||= structuredClone(DEFAULT_PROFILES);
  for(const d of DEFAULT_PROFILES){
    let p = db.profiles.find(x => x.id === d.id);
    if(!p){ db.profiles.push(structuredClone(d)); continue; }
    p.permissions ||= {};
    for(const k of PERMS){ if(!(k in p.permissions)) p.permissions[k] = !!d.permissions[k]; }
    if(p.id === 'prof-admin') p.permissions = fullPermissions();
    if(p.id === 'prof-app-admin') p.permissions = {...fullPermissions(),manageRoles:false};
  }
  for(const u of db.users){
    u.id ||= id('u');
    u.username ||= u.name;
    u.userId ||= u.name === 'Stephan' ? '123' : (String(u.id).replace(/\D/g,'') || String(Math.floor(Math.random()*9000+1000)));
    u.email ||= '';
    u.position ||= u.role || '';
    u.capacity = Number(u.capacity || 8);
    u.active = u.active !== false;
    u.profileId ||= u.name === 'Stephan' ? 'prof-admin' : u.role === 'LTSE' ? 'prof-ltse' : u.role === 'TSE/JTSE' ? 'prof-tse' : 'prof-senior';
    if(u.name === 'Stephan' && !u.passwordHash) Object.assign(u, hashPassword('Testing','3960cf8e585c51dbae91a9b6f41ee4fc'));
    delete u.password; delete u.role;
  }
  db.workflowConfig=normalizeWorkflowPermissions(db.workflowConfig,db.profiles);
  return db;
}
const read = () => normalize(JSON.parse(fs.readFileSync(DB,'utf8')));
const write = db => {const temp=DB+'.tmp';fs.writeFileSync(temp,JSON.stringify(normalize(db),null,2));fs.renameSync(temp,DB);};
function body(req){ return new Promise((resolve,reject)=>{ let s=''; req.on('data',c=>{ s+=c; if(s.length>5e6) req.destroy(); }); req.on('end',()=>{ try{ resolve(s?JSON.parse(s):{}); }catch(e){ reject(e); } }); req.on('error',reject); }); }
function cookies(req){ return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{ const i=v.indexOf('='); return [decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))]; })); }
function sessionOf(req){ const t=cookies(req).ets_session,s=t&&sessions.get(t);if(s&&Date.now()-s.createdAt>28800000){sessions.delete(t);return null}return s; }
function currentUser(req,db){ const s=sessionOf(req); return s && db.users.find(u=>u.id===s.userId && u.active); }
function profileOf(db,u){ return db.profiles.find(p=>p.id===u?.profileId); }
function perms(db,u){ return profileOf(db,u)?.permissions || {}; }
function send(res,code,obj,type='application/json',extra={}){ const out=type==='application/json'?JSON.stringify(obj):obj; res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store',...extra}); res.end(out); }
function requireAuth(req,res){ const db=read(), user=currentUser(req,db); if(!user){ send(res,401,{error:'Authentication required'}); return null; } return {db,user,profile:profileOf(db,user),permissions:perms(db,user)}; }
function audit(db,user,text,meta={}){ db.audit.unshift({id:id('a'),ts:now(),user:user?.name||'System',role:profileOf(db,user)?.name||'',text,...meta});  }
function notify(db,text,recipients=['All']){ db.notifications.unshift({id:id('n'),ts:now(),text,recipients,readBy:[]});  }
function safeProject(p,ps){ const x=structuredClone(p); if(p.type!=='commercial'||!ps.viewCommercialFields)for(const k of ['pricing','rom','poStatus','negotiationNotes','offerDetails','agreementDetails'])delete x[k]; if(p.type==='commercial'&&p.stage==='RFQ'&&!ps.viewRFQEngineering)for(const k of ['scope','requiredInputs','deliverables','remarks'])delete x[k];return x; }
function safeAudit(a,ps){const x=structuredClone(a);if(!ps.viewCommercialFields&&x.changes)x.changes=x.changes.filter(c=>!['pricing','rom','poStatus','negotiationNotes','offerDetails','agreementDetails'].includes(c.field));return x;}
function canReadTask(t,ps,p,db,user){return !!t&&!!p&&(p.type!=='commercial'||(ps.viewCommercial&&(p.stage!=='RFQ'||ps.viewRFQEngineering)))&&(!t.workflowNodeId||!db||WF.canRead(db,p,user,ps,t.workflowNodeId));}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function planningDateError(start,end,endLabel='Due date'){
  for(const value of [start,end])if(value&&(!validDate(value)||value<'1900-01-01'||value>'2100-12-31'))return 'Dates must be valid calendar dates between 1900 and 2100';
  if(start&&end&&end<start)return `${endLabel} cannot precede start date`;
  return '';
}
function projectDateError(p){return planningDateError(p.startDate,p.edd,'Expected delivery date');}
function taskError(t){if(!String(t.title||'').trim())return 'Task title is required';if(![t.mhActual,t.mhEstimate].every(n=>Number.isFinite(Number(n))&&Number(n)>=0))return 'Man-hours must be finite and non-negative';if(t.flag&&!['Escalation','Bottleneck'].includes(t.flag))return 'Invalid escalation flag';if(t.flag&&!String(t.flagReason||'').trim())return 'A flag reason is required';return planningDateError(t.startDate,t.dueDate);}

function safeTask(t,ps,p){ const x=structuredClone(t); if(p?.type==='commercial' && p?.stage==='RFQ' && !ps.viewRFQEngineering){ for(const k of ['mhEstimate','mhActual','timeEntries','actualOpeningBalance','plannedAllocations','department','dependency','action','remarks']) delete x[k]; } return x; }
function project(db,pid){ return db.projects.find(p=>p.id===pid); }
function taskLevel(t,p){ if(t.level) return Number(t.level); const rest=String(t.wbs||'').replace(String(p?.wbs||''),'').replace(/^\./,''); return rest?rest.split('.').length+1:1; }
function nextWbs(db,p,parent){ parent=String(parent||p.wbs); const depth=parent.split('.').length+1; const nums=db.tasks.filter(t=>t.projectId===p.id&&String(t.wbs).startsWith(parent+'.')&&String(t.wbs).split('.').length===depth).map(t=>Number(String(t.wbs).split('.').pop())).filter(Number.isFinite); return `${parent}.${(nums.length?Math.max(...nums):0)+1}`; }
function diff(a,b,fields){ return fields.filter(k=>JSON.stringify(a[k]??'')!==JSON.stringify(b[k]??'')).map(k=>({field:k,from:a[k]??'',to:b[k]??''})); }
function mime(p){ return p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.html')?'text/html':'application/octet-stream'; }
function csv(v){if(typeof v==='string'&&/^[=+@\t\r-]/.test(v))v="'"+v; return `"${String(v??'').replaceAll('"','""')}"`; }
function spreadHours(startDate,total,max=8,dueDate='') {
  const result={}; if(!startDate || !Number(total)) return result;
  if(dueDate && dueDate>=startDate) {
    const dates=[]; let d=new Date(startDate+'T00:00:00Z');
    while(d.toISOString().slice(0,10)<=dueDate) { if(![0,6].includes(d.getUTCDay()))dates.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
    // Weekend-only work remains visible as a capacity conflict.
    if(!dates.length)dates.push(startDate);
    const units=Math.round(Number(total)*10000), base=Math.floor(units/dates.length);
    dates.forEach((date,i)=>result[date]=(base+(i<units-base*dates.length?1:0))/10000);
    return result;
  }
  let d=new Date(startDate+'T00:00:00Z'),left=Number(total),guard=0;
  while(left>0&&guard++<75000){if(![0,6].includes(d.getUTCDay())){const h=Math.min(max,left);result[d.toISOString().slice(0,10)]=h;left-=h;}d.setUTCDate(d.getUTCDate()+1);}return result;
}
function isSystemAdmin(user){return user?.profileId==='prof-admin';}
function protectedUser(user,target,nextProfile){return !isSystemAdmin(user)&&(isSystemAdmin(target)||nextProfile==='prof-admin');}
function ownerError(db,value,current){if(value!==undefined&&typeof value!=='string')return 'Project owner must be selected from existing users';return value && value!==current && !db.users.some(u=>u.active&&u.name===value)?'Project owner must be an active existing user':'';}
function activeAdminCount(db){ return db.users.filter(u=>u.active && profileOf(db,u)?.permissions?.manageUsers && profileOf(db,u)?.permissions?.manageRoles).length; }
function profileExists(db,pid){ return db.profiles.some(p=>p.id===pid); }
function uniqueUserConflict(db,uid,username,userId){ return db.users.some(x=>x.id!==uid && (String(x.username||'').toLowerCase()===String(username||'').trim().toLowerCase() || String(x.userId||'')===String(userId||'').trim())); }

function workflowTemplate(db,p,requested){const workflowId=requested||db.workflowConfig.projectTypes.find(t=>t.id===p.type)?.workflowId;return db.workflowConfig.workflows.find(w=>w.id===workflowId&&(!w.projectType||w.projectType===p.type));}
function leadError(db,b){for(const key of ['managerId','supervisorId'])if(b[key]){const u=db.users.find(u=>u.id===b[key]&&u.active);if(!u||!perms(db,u).assignTasks)return 'Project managers and supervisors must be active users with task assignment permission';}return '';}
function attachWorkflow(db,p,w,user){const instance=WF.create(w,user.id);db.projectWorkflows[p.id]=instance;p.workflowId=w.id;p.workflowVersion=instance.version;p.workflowSchemaVersion=3;for(const node of instance.nodes)for(const title of node.taskTemplates){const wbs=nextWbs(db,p,p.wbs);db.tasks.push({id:id('t'),projectId:p.id,wbs,parentWbs:p.wbs,level:3,title,assignee:'Unassigned',status:'To Do',mhEstimate:0,mhActual:0,startDate:p.startDate||new Date().toISOString().slice(0,10),dueDate:'',workflowNodeId:node.id,flag:'',flagReason:''});}WF.refresh(instance);}
function workflowAuditVisible(db,a,user,ps){if(a.workflowNodeId){const p=project(db,a.projectId);return p&&WF.canRead(db,p,user,ps,a.workflowNodeId);}if(a.entityType==='task'){const t=db.tasks.find(t=>t.id===a.entityId);if(t?.workflowNodeId)return canReadTask(t,ps,project(db,t.projectId),db,user);}return true;}
function workflowNotify(db,p,user,before){const instance=db.projectWorkflows[p.id];if(!instance)return;WF.refresh(instance);for(const node of instance.nodes){if(instance.states[node.id].status==='In progress'&&before?.[node.id]?.status!=='In progress'){const recipients=db.users.filter(u=>u.active&&[p.managerId,p.supervisorId].includes(u.id)&&WF.canRead(db,p,u,perms(db,u),node.id)).map(u=>u.name);if(recipients.length){notify(db,'Project '+p.wbs+': '+node.name+' is ready',recipients);Object.assign(db.notifications[0],{projectId:p.id,workflowNodeId:node.id});if(node.type==='notification')instance.states[node.id].notificationSentAt=now();}}}}


let mutationQueue=Promise.resolve();
const server = http.createServer(async(req,res)=>{ let release;try{
  const u = new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(req.method)){const previous=mutationQueue;mutationQueue=new Promise(resolve=>{release=resolve});await previous;}

  if(req.method==='POST'&&u.pathname==='/api/login'){
    const b=await body(req), db=read(), login=String(b.user||'').trim().toLowerCase(), uid=String(b.id||'').trim();
    const user=db.users.find(x=>(String(x.username||'').toLowerCase()===login||String(x.name||'').toLowerCase()===login)&&String(x.userId||'')===uid);
    if(!user||!user.active||!verifyPassword(b.password,user)) return send(res,401,{error:'Invalid credentials or inactive account'});
    const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{userId:user.id,createdAt:Date.now()}); user.lastLoginAt=now(); write(db);
    return send(res,200,{ok:true,user:user.name},'application/json',{'Set-Cookie':`ets_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`});
  }
  if(req.method==='POST'&&u.pathname==='/api/logout'){
    const t=cookies(req).ets_session; if(t)sessions.delete(t);
    return send(res,200,{ok:true},'application/json',{'Set-Cookie':'ets_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
  }

  let A=null;
  if(u.pathname.startsWith('/api/')){ A=requireAuth(req,res); if(!A)return; }
  const db=A?.db, user=A?.user, ps=A?.permissions||{};

  // Shared workflow configuration; server validates references and requires administrator access to edit.
  if(u.pathname==='/api/workflow-config'){
    if(req.method==='GET'){
      if(!ps.manageSettings)return send(res,403,{error:'Manage Settings permission required'});
      let config;try{config=normalizeWorkflowPermissions(db.workflowConfig,db.profiles)}catch(e){return send(res,400,{error:e.message})}return send(res,200,{config,profiles:db.profiles.map(p=>({id:p.id,name:p.name})),runtimeEnforced:true});
    }
    if(req.method==='PUT'){
      if(!ps.manageSettings)return send(res,403,{error:'Manage Settings permission required'});
      const payload=await body(req),cfg=payload.config;
      if(cfg)cfg.templateCatalog={...db.workflowConfig.templateCatalog,...cfg.templateCatalog};
      if(!cfg||!Array.isArray(cfg.workflows)||!Array.isArray(cfg.projectTypes)||!cfg.register||!cfg.resource)return send(res,400,{error:'Invalid workflow configuration'});
      const ids=new Set(cfg.workflows.map(w=>w.id));
      if(ids.size!==cfg.workflows.length)return send(res,400,{error:'Duplicate workflow IDs'});
      if(!cfg.workflows.length)return send(res,400,{error:'At least one workflow is required'});
      for(const w of cfg.workflows){
        if(w.projectType&&!['commercial','internal_eer'].includes(w.projectType))return send(res,400,{error:"Invalid workflow project type"});
        const runtimeError=WF.validate(w);if(runtimeError)return send(res,400,{error:runtimeError});if(w.nodes?.some(n=>n.parallelWithPrevious!==undefined&&typeof n.parallelWithPrevious!=='boolean'))return send(res,400,{error:'Parallel setting must be boolean'});
        if(!w.id||!String(w.name||'').trim()||!w.stages?.length||new Set(w.stages).size!==w.stages.length||w.stages.some(s=>!String(s).trim()))return send(res,400,{error:'Workflow name and unique non-empty stages required'});
        if(w.nodes){if(!Array.isArray(w.nodes))return send(res,400,{error:'Invalid workflow nodes'});const nids=new Set(w.nodes.map(n=>n.id));if(nids.size!==w.nodes.length)return send(res,400,{error:'Duplicate node IDs'});for(const n of w.nodes){if(!n.id||!String(n.name||'').trim()||!['stage','object','taskgroup','approval','signoff','decision','milestone','notification'].includes(n.type)||!['manual','fields','children','tasks','approval','signoff'].includes(n.completion))return send(res,400,{error:'Invalid workflow node'});let cur=n,seen=new Set([n.id]);while(cur.parent){if(!nids.has(cur.parent)||seen.has(cur.parent))return send(res,400,{error:'Invalid or circular node parent'});seen.add(cur.parent);cur=w.nodes.find(x=>x.id===cur.parent)}}}

        if(!Array.isArray(w.stages)||!Array.isArray(w.objects))return send(res,400,{error:'Invalid workflow structure'});
        const objIds=new Set(w.objects.map(o=>o.id));
        if(objIds.size!==w.objects.length)return send(res,400,{error:'Duplicate object IDs'});
        for(const o of w.objects){
          if(!o.name||!w.stages.includes(o.stage))return send(res,400,{error:'Invalid object name or stage'});
          if(o.parent&&!objIds.has(o.parent))return send(res,400,{error:'Parent must belong to the same workflow'});
          let cursor=o,seen=new Set([o.id]);
          while(cursor.parent){if(seen.has(cursor.parent))return send(res,400,{error:'Circular object hierarchy'});seen.add(cursor.parent);cursor=w.objects.find(x=>x.id===cursor.parent);if(!cursor)break;}
        }
      }
      if(cfg.projectTypes.some(t=>cfg.workflows.find(w=>w.id===t.workflowId)?.projectType&&cfg.workflows.find(w=>w.id===t.workflowId).projectType!==t.id))return send(res,400,{error:'Default workflow must match its project type'});
      if(cfg.projectTypes.some(t=>!ids.has(t.workflowId)))return send(res,400,{error:'Project type references an unknown workflow'});
      let validated;try{validated=normalizeWorkflowPermissions(cfg,db.profiles)}catch(e){return send(res,400,{error:e.message})}db.workflowConfig=validated;audit(db,user,'Updated workflow configuration');write(db);
      return send(res,200,{ok:true});
    }
  }

  if(req.method==='GET'&&u.pathname==='/api/workflow-templates')return send(res,200,{protocolVersion:2,defaultManagerId:ps.assignTasks?user.id:'',workflows:db.workflowConfig.workflows.map(w=>({id:w.id,name:w.name,projectType:w.projectType,description:w.description})),projectTypes:db.workflowConfig.projectTypes,managers:db.users.filter(u=>u.active&&perms(db,u).assignTasks).map(u=>({id:u.id,name:u.name}))});
  if(/^\/api\/projects\/[^/]+\/workflow(?:\/nodes\/[^/]+)?$/.test(u.pathname)){
    const parts=u.pathname.split('/'),p=project(db,parts[3]);if(!p||!canReadTask({},ps,p,db,user))return send(res,404,{error:'Project workflow not found or engineering access is restricted'});
    if(req.method==='GET'&&parts.length===5)return send(res,200,{workflow:WF.view(db,p,user,ps),canAttach:!!(ps.editProjects&&ps.assignTasks)});
    if(req.method==='POST'&&parts.length===5){if(!ps.editProjects||!ps.assignTasks)return send(res,403,{error:'Project editing and assignment permissions required'});if(db.projectWorkflows[p.id])return send(res,409,{error:'This project already has a saved workflow. Its version is preserved.'});const b=await body(req),w=workflowTemplate(db,p,b.workflowId);if(!w)return send(res,422,{error:'Select a valid workflow'});attachWorkflow(db,p,w,user);workflowNotify(db,p,user,{});audit(db,user,'Attached project workflow '+w.name,{entityType:'project',entityId:p.id,projectId:p.id});write(db);return send(res,201,{workflow:WF.view(db,p,user,ps)});}
    if(req.method==='PATCH'&&parts.length===7){const instance=db.projectWorkflows[p.id];if(!instance)return send(res,404,{error:'Project has no workflow'});const b=await body(req),before=structuredClone(instance.states),result=WF.transition(db,p,user,ps,parts[6],b);if(result.error)return send(res,result.status,{error:result.error});workflowNotify(db,p,user,before);audit(db,user,'Workflow object '+b.action,{entityType:'workflow',entityId:p.id,projectId:p.id,workflowNodeId:parts[6],action:b.action,comment:String(b.comment||'').slice(0,3000)});write(db);return send(res,200,{workflow:WF.view(db,p,user,ps)});}
  }

  if(u.pathname==='/api/register-config'){
    if(req.method==='GET')return send(res,200,{fields:Register.fields.filter(f=>!f.restricted||ps.viewCommercialFields),config:db.settings.registerConfig||Register.defaults});
    if(req.method==='PUT'){if(!ps.manageSettings)return send(res,403,{error:'Manage Settings permission required'});const c=await body(req),error=Register.error(c);if(error)return send(res,422,{error});db.settings.registerConfig={columns:c.columns,editable:c.editable};audit(db,user,'Updated project register columns',{entityType:'settings'});write(db);return send(res,200,{ok:true});}
  }
  if(u.pathname==='/api/project-links'&&req.method==='POST'){
    if(!ps.editProjects)return send(res,403,{error:'Edit Projects permission required'});
    const b=await body(req),a=project(db,b.projectId),z=project(db,b.linkedProjectId);
    if(!a||!z||!canReadTask({},ps,a,db,user)||!canReadTask({},ps,z,db,user))return send(res,404,{error:'Both projects must be accessible'});
    if(a.type===z.type)return send(res,422,{error:'Link an Internal project with a Project'});
    if(!db.projectLinks.some(l=>[l.projectId,l.linkedProjectId].includes(a.id)&&[l.projectId,l.linkedProjectId].includes(z.id)))db.projectLinks.push({id:id('link'),projectId:a.id,linkedProjectId:z.id,createdBy:user.id,createdAt:now()});
    audit(db,user,'Linked project records',{entityType:'project',entityId:a.id,projectId:a.id});write(db);return send(res,201,{ok:true});
  }
  if(req.method==='DELETE'&&/^\/api\/project-links\/[^/]+$/.test(u.pathname)){
    if(!ps.editProjects)return send(res,403,{error:'Edit Projects permission required'});const link=db.projectLinks.find(l=>l.id===u.pathname.split('/').pop());if(!link)return send(res,404,{error:'Link not found'});
    if(![link.projectId,link.linkedProjectId].every(pid=>canReadTask({},ps,project(db,pid),db,user)))return send(res,404,{error:'Link not found'});
    db.projectLinks=db.projectLinks.filter(l=>l.id!==link.id);audit(db,user,'Removed project link',{entityType:'project',entityId:link.projectId,projectId:link.projectId});write(db);return send(res,200,{ok:true});
  }
  if(req.method==='GET'&&u.pathname==='/api/bootstrap'){
    const pmap=Object.fromEntries(db.projects.map(p=>[p.id,p]));
    const visibleProjects=db.projects.filter(p=>p.type!=='commercial'||ps.viewCommercial);
    const visibleIds=new Set(visibleProjects.map(p=>p.id));
    const notifications=db.notifications.filter(n=>n.recipients?.includes('All')||n.recipients?.includes(user.name)||n.recipients?.includes(profileOf(db,user)?.name)).filter(n=>!n.workflowNodeId||project(db,n.projectId)&&WF.canRead(db,project(db,n.projectId),user,ps,n.workflowNodeId));
    return send(res,200,{user:user.name,userId:user.userId,profile:profileOf(db,user)?.name,permissions:ps,
      users:db.users.filter(x=>x.active).map(x=>({id:x.id,name:x.name,position:x.position,capacity:x.capacity,profileId:x.profileId})),
      projectLinks:db.projectLinks.filter(l=>[l.projectId,l.linkedProjectId].every(pid=>visibleIds.has(pid)&&canReadTask({},ps,pmap[pid],db,user))),
      projects:visibleProjects.map(p=>safeProject(p,ps)),workflowSummaries:Object.fromEntries(visibleProjects.filter(p=>canReadTask({},ps,p,db,user)&&db.projectWorkflows[p.id]).map(p=>{const w=WF.view(db,p,user,ps);return [p.id,{name:w.name,completed:w.completed,total:w.total,isComplete:w.isComplete,active:w.nodes.filter(n=>!n.parent&&n.status==='In progress').map(n=>n.name)}]})),
      tasks:db.tasks.filter(t=>visibleIds.has(t.projectId)&&canReadTask(t,ps,pmap[t.projectId],db,user)).map(t=>({...safeTask(t,ps,pmap[t.projectId]),level:taskLevel(t,pmap[t.projectId]),workflowPlanningAllowed:WF.canPlanTask(db,pmap[t.projectId],user,ps,t),workflowLocked:!!t.workflowNodeId&&!WF.canUpdateTask(db,pmap[t.projectId],user,ps,t)})),
      comments:db.comments.filter(c=>canReadTask(db.tasks.find(t=>t.id===c.taskId),ps,pmap[c.projectId],db,user)), escalations:ps.viewReports?db.escalations.filter(e=>canReadTask(db.tasks.find(t=>t.id===e.taskId),ps,pmap[e.projectId],db,user)):[], notifications, audit:ps.viewAudit?db.audit.filter(a=>workflowAuditVisible(db,a,user,ps)).map(a=>safeAudit(a,ps)):[], leave:db.leave, settings:db.settings});
  }

  if(req.method==='GET'&&u.pathname==='/api/feedback'){
    const feedback=db.feedback.filter(f=>ps.manageFeedback||f.createdById===user.id).map(({screenshot,...f})=>({...f,hasScreenshot:!!screenshot}));
    return send(res,200,{feedback,canManage:!!ps.manageFeedback});
  }
  if(req.method==='POST'&&u.pathname==='/api/feedback'){
    const b=await body(req),text=String(b.description||'').trim();
    if(!['Bug','Suggestion','Question'].includes(b.type)||text.length<5||text.length>5000)return send(res,422,{error:'Choose a feedback type and enter 5–5000 characters'});
    if(String(b.expected||'').length>2000||String(b.page||'').length>120)return send(res,422,{error:'Feedback context is too long'});
    let screenshot;
    if(b.screenshot){const image=b.screenshot;if(!['image/png','image/jpeg'].includes(image.mime)||typeof image.data!=='string'||image.data.length>1400000||! /^[A-Za-z0-9+/]+={0,2}$/.test(image.data))return send(res,422,{error:'Screenshot must be PNG or JPEG, at most 1 MB'});const bytes=Buffer.from(image.data,'base64');const valid=image.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!valid||bytes.length>1048576)return send(res,422,{error:'Invalid screenshot or file exceeds 1 MB'});screenshot={mime:image.mime,data:image.data};}
    const feedback={id:id('fb'),type:b.type,description:text,expected:String(b.expected||'').trim(),page:String(b.page||'').trim(),createdAt:now(),createdById:user.id,createdBy:user.name,serverVersion:SERVER_VERSION,status:'New',adminNote:'',screenshot};
    db.feedback.unshift(feedback);audit(db,user,'Submitted demo feedback',{entityType:'feedback',entityId:feedback.id});write(db);return send(res,201,{ok:true,id:feedback.id});
  }
  if(req.method==='GET'&&/^\/api\/feedback\/[^/]+\/screenshot$/.test(u.pathname)){
    const f=db.feedback.find(f=>f.id===u.pathname.split('/')[3]);if(!f||(!ps.manageFeedback&&f.createdById!==user.id))return send(res,404,{error:'Feedback not found'});if(!f.screenshot)return send(res,404,{error:'Screenshot not found'});
    return send(res,200,Buffer.from(f.screenshot.data,'base64'),f.screenshot.mime,{'X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="feedback-screenshot.'+(f.screenshot.mime==='image/png'?'png':'jpg')+'"'});
  }
  if(req.method==='PATCH'&&/^\/api\/feedback\/[^/]+$/.test(u.pathname)){
    if(!ps.manageFeedback)return send(res,403,{error:'Manage Feedback permission required'});const f=db.feedback.find(f=>f.id===u.pathname.split('/').pop());if(!f)return send(res,404,{error:'Feedback not found'});const b=await body(req);
    if(Object.keys(b).some(k=>!['status','adminNote'].includes(k)))return send(res,422,{error:'Only status and reviewer note may be changed'});
    if(b.status!==undefined&&!['New','In progress','Resolved'].includes(b.status))return send(res,422,{error:'Invalid feedback status'});if(b.adminNote!==undefined&&(typeof b.adminNote!=='string'||b.adminNote.length>3000))return send(res,422,{error:'Reviewer note must be at most 3000 characters'});
    if(b.status!==undefined)f.status=b.status;if(b.adminNote!==undefined)f.adminNote=b.adminNote.trim();f.updatedAt=now();f.updatedBy=user.name;audit(db,user,'Updated feedback '+f.id+' — '+f.status,{entityType:'feedback',entityId:f.id});write(db);return send(res,200,{ok:true});
  }

  if(req.method==='GET'&&u.pathname==='/api/admin/users'){
    if(!ps.manageUsers)return send(res,403,{error:'Manage Users permission required'});
    return send(res,200,{users:db.users.map(x=>({id:x.id,name:x.name,username:x.username,userId:x.userId,email:x.email,position:x.position,capacity:x.capacity,profileId:x.profileId,active:x.active,lastLoginAt:x.lastLoginAt||'',offboardedAt:x.offboardedAt||'',offboardReason:x.offboardReason||''})),profiles:db.profiles.filter(p=>isSystemAdmin(user)||p.id!=='prof-admin').map(p=>({id:p.id,name:p.name}))});
  }
  if(req.method==='POST'&&u.pathname==='/api/admin/users'){
    if(!ps.manageUsers)return send(res,403,{error:'Manage Users permission required'});
    const b=await body(req); if(!b.name||!b.username||!b.userId||!b.password||!b.profileId)return send(res,400,{error:'Name, username, User ID, password and profile are required'});
    if(String(b.password).length<6)return send(res,400,{error:'Password must be at least 6 characters'});
    if(protectedUser(user,null,b.profileId))return send(res,403,{error:'Only System Administrators can assign System Administrator access'});
    if(!profileExists(db,b.profileId))return send(res,400,{error:'Assigned profile does not exist'});
    if(uniqueUserConflict(db,null,b.username,b.userId))return send(res,409,{error:'Username or User ID already exists'});
    const nu={id:id('u'),name:String(b.name).trim(),username:String(b.username).trim(),userId:String(b.userId).trim(),email:String(b.email||'').trim(),position:String(b.position||'').trim(),capacity:Number(b.capacity||8),profileId:b.profileId,active:b.active!==false,createdAt:now(),createdBy:user.name,...hashPassword(b.password)};
    db.users.push(nu); audit(db,user,`Created user ${nu.name}`,{entityType:'user',entityId:nu.id}); write(db); return send(res,201,{ok:true,id:nu.id});
  }
  if(req.method==='PATCH'&&/^\/api\/admin\/users\/[^/]+$/.test(u.pathname)){
    if(!ps.manageUsers)return send(res,403,{error:'Manage Users permission required'});
    const uid=u.pathname.split('/').pop(), target=db.users.find(x=>x.id===uid); if(!target)return send(res,404,{error:'User not found'});
    const b=await body(req), before=structuredClone(target);if(protectedUser(user,target,b.profileId))return send(res,403,{error:'Only System Administrators can manage System Administrator accounts'});if(Object.hasOwn(b,'capacity')&&(!Number.isFinite(Number(b.capacity))||Number(b.capacity)<=0||Number(b.capacity)>24))return send(res,422,{error:'Daily capacity must be greater than zero and at most 24'});
    const nextUsername=Object.hasOwn(b,'username')?String(b.username).trim():target.username, nextUserId=Object.hasOwn(b,'userId')?String(b.userId).trim():target.userId;
    if(!nextUsername||!nextUserId)return send(res,400,{error:'Username and User ID are required'});
    if(uniqueUserConflict(db,uid,nextUsername,nextUserId))return send(res,409,{error:'Username or User ID already exists'});
    if(Object.hasOwn(b,'profileId')&&!profileExists(db,b.profileId))return send(res,400,{error:'Assigned profile does not exist'});
    if(isSystemAdmin(target)&&(b.active===false||(b.profileId&&b.profileId!=='prof-admin'))&&db.users.filter(x=>x.active&&isSystemAdmin(x)).length<=1)return send(res,400,{error:'At least one active System Administrator must remain'});
    const wouldDeactivate=Object.hasOwn(b,'active')&&b.active===false;
    const wouldLoseAdmin=Object.hasOwn(b,'profileId')&&(!db.profiles.find(p=>p.id===b.profileId)?.permissions?.manageUsers||!db.profiles.find(p=>p.id===b.profileId)?.permissions?.manageRoles);
    if(target.id===user.id&&(wouldDeactivate||wouldLoseAdmin))return send(res,400,{error:'You cannot deactivate your own account or remove your own administrator access'});
    if(target.active&&profileOf(db,target)?.permissions?.manageUsers&&profileOf(db,target)?.permissions?.manageRoles&&(wouldDeactivate||wouldLoseAdmin)&&activeAdminCount(db)<=1)return send(res,400,{error:'At least one active administrator must remain'});
    for(const k of ['name','username','userId','email','position','profileId'])if(Object.hasOwn(b,k))target[k]=String(b[k]).trim();
    if(Object.hasOwn(b,'capacity'))target.capacity=Number(b.capacity); if(Object.hasOwn(b,'active'))target.active=!!b.active;
    const changes=diff(before,target,['name','username','userId','email','position','profileId','capacity','active']);
    if(changes.length)audit(db,user,`Updated user ${target.name}: ${changes.map(c=>c.field).join(', ')}`,{entityType:'user',entityId:target.id,changes}); write(db); return send(res,200,{ok:true});
  }
  if(req.method==='POST'&&/^\/api\/admin\/users\/[^/]+\/password$/.test(u.pathname)){
    if(!ps.manageUsers)return send(res,403,{error:'Manage Users permission required'});
    const uid=u.pathname.split('/')[4], target=db.users.find(x=>x.id===uid), b=await body(req); if(!target)return send(res,404,{error:'User not found'});
    if(protectedUser(user,target))return send(res,403,{error:'Only System Administrators can reset System Administrator passwords'});
    if(!b.password||String(b.password).length<6)return send(res,400,{error:'Password must be at least 6 characters'});
    Object.assign(target,hashPassword(b.password)); target.passwordChangedAt=now(); for(const[token,s]of sessions)if(s.userId===uid)sessions.delete(token);
    audit(db,user,`Reset password for ${target.name}`,{entityType:'user',entityId:target.id}); write(db); return send(res,200,{ok:true});
  }
  if(req.method==='POST'&&/^\/api\/admin\/users\/[^/]+\/offboard$/.test(u.pathname)){
    if(!ps.manageUsers)return send(res,403,{error:'Manage Users permission required'});
    const uid=u.pathname.split('/')[4], target=db.users.find(x=>x.id===uid), b=await body(req); if(!target)return send(res,404,{error:'User not found'});
    if(protectedUser(user,target))return send(res,403,{error:'Only System Administrators can offboard System Administrators'});
    if(isSystemAdmin(target)&&db.users.filter(x=>x.active&&isSystemAdmin(x)).length<=1)return send(res,400,{error:'At least one active System Administrator must remain'});
    if(target.id===user.id)return send(res,400,{error:'You cannot offboard your own account'});
    if(target.active&&profileOf(db,target)?.permissions?.manageUsers&&profileOf(db,target)?.permissions?.manageRoles&&activeAdminCount(db)<=1)return send(res,400,{error:'At least one active administrator must remain'});
    target.active=false; target.offboardedAt=now(); target.offboardedBy=user.name; target.offboardReason=String(b.reason||'').trim();
    for(const[token,s]of sessions)if(s.userId===uid)sessions.delete(token); audit(db,user,`Offboarded user ${target.name}`,{entityType:'user',entityId:target.id,changes:[{field:'active',from:true,to:false},{field:'reason',from:'',to:target.offboardReason}]}); write(db); return send(res,200,{ok:true});
  }

  if(req.method==='GET'&&u.pathname==='/api/admin/profiles'){
    if(!isSystemAdmin(user))return send(res,403,{error:'System Administrator access required for role management'}); return send(res,200,{profiles:db.profiles,permissions:PERMS});
  }
  if(req.method==='POST'&&u.pathname==='/api/admin/profiles'){
    if(!isSystemAdmin(user))return send(res,403,{error:'System Administrator access required for role management'}); const b=await body(req);
    const permissionError=profilePermissionError(b.permissions);if(permissionError)return send(res,400,{error:permissionError});
    if(!String(b.name||'').trim())return send(res,400,{error:'Profile name is required'});
    if(db.profiles.some(p=>p.name.toLowerCase()===String(b.name).trim().toLowerCase()))return send(res,409,{error:'Profile name already exists'});
    const p={id:id('prof'),name:String(b.name).trim(),description:String(b.description||'').trim(),permissions:Object.fromEntries(PERMS.map(k=>[k,!!b.permissions?.[k]]))};
    db.profiles.push(p); audit(db,user,`Created role profile ${p.name}`,{entityType:'profile',entityId:p.id}); write(db); return send(res,201,{ok:true,id:p.id});
  }
  if(req.method==='PATCH'&&/^\/api\/admin\/profiles\/[^/]+$/.test(u.pathname)){
    if(!isSystemAdmin(user))return send(res,403,{error:'System Administrator access required for role management'});
    const pid=u.pathname.split('/').pop(), p=db.profiles.find(x=>x.id===pid); if(!p)return send(res,404,{error:'Profile not found'});
    const b=await body(req), before=structuredClone(p);
    const permissionError=profilePermissionError(b.permissions);if(permissionError)return send(res,400,{error:permissionError});
    if(['prof-admin','prof-app-admin'].includes(pid)){
      if(Object.hasOwn(b,'name')&&String(b.name).trim()!==p.name)return send(res,400,{error:'Built-in administrator profile name is protected'});
      if(b.permissions&&PERMS.some(k=>Object.hasOwn(b.permissions,k)&&b.permissions[k]!==!(pid==='prof-app-admin'&&k==='manageRoles')))return send(res,400,{error:'Built-in administrator permissions are protected'});
    }
    let migratedWorkflow;try{migratedWorkflow=normalizeWorkflowPermissions(db.workflowConfig,db.profiles)}catch(e){return send(res,400,{error:e.message})}
    if(Object.hasOwn(b,'name')){ const nm=String(b.name).trim(); if(!nm)return send(res,400,{error:'Profile name is required'}); if(db.profiles.some(x=>x.id!==pid&&x.name.toLowerCase()===nm.toLowerCase()))return send(res,409,{error:'Profile name already exists'}); p.name=nm; }
    if(Object.hasOwn(b,'description'))p.description=String(b.description||'').trim();
    if(b.permissions)for(const k of PERMS)if(Object.hasOwn(b.permissions,k))p.permissions[k]=!!b.permissions[k];
    if(pid==='prof-admin')p.permissions=fullPermissions();if(migratedWorkflow)db.workflowConfig=migratedWorkflow;
    audit(db,user,`Updated role profile ${p.name}`,{entityType:'profile',entityId:p.id,changes:diff(before,p,['name','description','permissions'])}); write(db); return send(res,200,{ok:true});
  }
  if(req.method==='DELETE'&&/^\/api\/admin\/profiles\/[^/]+$/.test(u.pathname)){
    if(!isSystemAdmin(user))return send(res,403,{error:'System Administrator access required for role management'}); const pid=u.pathname.split('/').pop();
    if(DEFAULT_PROFILE_IDS.has(pid))return send(res,400,{error:'Default profiles cannot be deleted'});
    if(db.users.some(x=>x.profileId===pid))return send(res,409,{error:'Profile is assigned to users'});
    const p=db.profiles.find(x=>x.id===pid); if(!p)return send(res,404,{error:'Profile not found'}); for(const w of db.workflowConfig?.workflows||[])for(const item of [...(w.nodes||[]),...(w.objects||[])])if(item.permissions){delete item.permissions[pid];delete item.permissions[p.name]} db.profiles=db.profiles.filter(x=>x.id!==pid);
    audit(db,user,`Deleted role profile ${p.name}`,{entityType:'profile',entityId:pid}); write(db); return send(res,200,{ok:true});
  }

  if(req.method==='POST'&&u.pathname==='/api/projects'){
    const b=await body(req), type=b.type==='commercial'?'commercial':'internal_eer';
    if(type==='commercial'&&!ps.createCommercial)return send(res,403,{error:'Create Commercial permission required'});
    if(type==='internal_eer'&&!ps.createEER)return send(res,403,{error:'Create EER permission required'});
    const ownerValidation=ownerError(db,b.owner);if(ownerValidation)return send(res,422,{error:ownerValidation});
    const n=type==='commercial'?db.projects.filter(p=>p.type==='commercial').length+1:db.projects.filter(p=>p.type==='internal_eer').length+1;
    const p={id:id('p'),wbs:b.wbs||(type==='commercial'?String(n):`EER-${String(n).padStart(3,'0')}`),type,client:b.client||(type==='internal_eer'?'Internal':''),title:b.title||'Untitled project',aircraft:b.aircraft||'',registration:b.registration||'',releaseType:b.releaseType||'',sector:b.sector||'',owner:b.owner||user.name,priority:b.priority||'Normal',stage:type==='commercial'?(b.stage||'RFQ'):(b.stage||'In Progress'),status:b.status||b.stage||(type==='commercial'?'RFQ':'In Progress'),scope:b.scope||'',edd:b.edd||'',startDate:b.startDate||'',requiredInputs:b.requiredInputs||'',deliverables:b.deliverables||'',clientFocal:b.clientFocal||'',doaFocal:b.doaFocal||'',projectManager:b.projectManager||'',site:b.site||'',sage:b.sage||'',nreStatus:b.nreStatus||'',remarks:b.remarks||'',pricing:type==='commercial'?{rom:b.rom||'',poStatus:b.poStatus||'',negotiationNotes:b.negotiationNotes||'',offerDetails:b.offerDetails||'',agreementDetails:b.agreementDetails||''}:undefined};
    const dateError=projectDateError(p);if(dateError)return send(res,422,{error:dateError});
    const leads=leadError(db,b);if(leads)return send(res,422,{error:leads});p.managerId=b.managerId||(ps.assignTasks?user.id:'');p.supervisorId=b.supervisorId||'';if(p.managerId)p.projectManager=db.users.find(u=>u.id===p.managerId)?.name||'';if(!b.workflowId)return send(res,422,{error:'Select an existing workflow before creating a project'});if(!p.managerId&&!p.supervisorId)return send(res,422,{error:'Assign a project manager or supervisor for mandatory parent sign-off'});const template=workflowTemplate(db,p,b.workflowId);if(!template)return send(res,422,{error:'Select a valid workflow'});
    if(['commercial','commercial-tracker'].includes(template.id)&&!b.status)p.status='Not Started';db.projects.unshift(p);attachWorkflow(db,p,template,user);workflowNotify(db,p,user,{}); audit(db,user,`Created ${type==='commercial'?'Commercial project':'Internal EER'} ${p.wbs}`,{entityType:'project',entityId:p.id,projectId:p.id});
    if(type==='internal_eer'&&!['Senior Management','System Administrator'].includes(profileOf(db,user)?.name))notify(db,`New Internal EER ${p.wbs} created by ${user.name}`,['LTSE','Senior Management','System Administrator']);
    write(db); return send(res,201,{ok:true,project:safeProject(p,ps)});
  }
  if(req.method==='PATCH'&&/^\/api\/projects\/[^/]+$/.test(u.pathname)){
    if(!ps.editProjects)return send(res,403,{error:'Edit Projects permission required'}); const pid=u.pathname.split('/').pop(), p=project(db,pid); if(!p)return send(res,404,{error:'Project not found'});
    if(p.type==='commercial'&&(!ps.viewCommercial||p.stage==='RFQ'&&!ps.viewRFQEngineering))return send(res,403,{error:'Commercial access required'}); const b=await body(req), before=structuredClone(p);
    if(Object.hasOwn(b,'owner')){const error=ownerError(db,b.owner,p.owner);if(error)return send(res,422,{error});}
    if(b.registerEdit){const c=db.settings.registerConfig||Register.defaults;if(Object.keys(b).some(k=>k!=='registerEdit'&&(!c.columns.includes(k)||!c.editable.includes(k))))return send(res,403,{error:'This field is read-only in the register'});}
    const permissionError=profilePermissionError(b.permissions);if(permissionError)return send(res,400,{error:permissionError}); if(p.type==='commercial'&&!ps.viewCommercialFields&&['rom','poStatus','negotiationNotes','offerDetails','agreementDetails','pricing','stage','status'].some(k=>Object.hasOwn(b,k)))return send(res,403,{error:'Commercial fields and handover require management permission'}); const fields=['managerId','supervisorId','client','title','aircraft','registration','releaseType','sector','owner','priority','stage','status','scope','edd','startDate','requiredInputs','deliverables','clientFocal','doaFocal','projectManager','site','sage','nreStatus','remarks','doaScope','customerSupport','programme','internalClient','projectTimeline','requestDate','completionDate','taskClassification','department','workshareStatus'];
    if(['managerId','supervisorId'].some(k=>Object.hasOwn(b,k))){if(!ps.assignTasks)return send(res,403,{error:'Task assignment permission required to appoint project leads'});const leads=leadError(db,b);if(leads)return send(res,422,{error:leads});}if(b.workflowId&&b.workflowId!==p.workflowId)return send(res,409,{error:'Existing workflow versions cannot be changed through project editing'});
    if((b.status==='Completed'||b.stage==='Completed')&&db.tasks.some(t=>t.projectId===p.id&&Number(t.level||3)>=3&&!['Completed','Not Required','Lost/Cancelled','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(t.status)))return send(res,409,{error:'Complete or cancel all applicable tasks before completing the project'});
    if(db.projectWorkflows[p.id]&&(b.status==='Completed'||b.stage==='Completed')&&db.projectWorkflows[p.id].nodes.some(n=>db.projectWorkflows[p.id].states[n.id].status!=='Completed'))return send(res,409,{error:'Complete and sign off all workflow objects before marking the project Completed'});
    const candidate={...p};for(const k of fields)if(Object.hasOwn(b,k))candidate[k]=b[k];const dateError=projectDateError(candidate);if(dateError)return send(res,422,{error:dateError});
    for(const k of fields)if(Object.hasOwn(b,k))p[k]=b[k]; if(p.type==='commercial'&&ps.viewCommercialFields){ p.pricing||={}; for(const k of ['rom','poStatus','negotiationNotes','offerDetails','agreementDetails'])if(Object.hasOwn(b,k))p.pricing[k]=b[k]; }
    if(Object.hasOwn(b,'managerId'))p.projectManager=db.users.find(u=>u.id===p.managerId)?.name||'';
    const changes=diff(before,p,fields.concat(['pricing'])); if(changes.length)audit(db,user,`Updated project ${p.wbs}: ${changes.map(c=>c.field).join(', ')}`,{entityType:'project',entityId:p.id,projectId:p.id,changes}); write(db); return send(res,200,{ok:true,project:safeProject(p,ps)});
  }
  if(req.method==='DELETE'&&/^\/api\/projects\/[^/]+$/.test(u.pathname)){
    if(!ps.deleteProjects)return send(res,403,{error:'Delete Projects permission required'}); const pid=u.pathname.split('/').pop(), p=project(db,pid); if(!p)return send(res,404,{error:'Project not found'});
    const tids=db.tasks.filter(t=>t.projectId===pid).map(t=>t.id); db.projects=db.projects.filter(x=>x.id!==pid); db.tasks=db.tasks.filter(t=>t.projectId!==pid); db.comments=db.comments.filter(c=>!tids.includes(c.taskId)); db.escalations=db.escalations.filter(e=>!tids.includes(e.taskId));
    delete db.projectWorkflows[pid];db.projectLinks=db.projectLinks.filter(l=>l.projectId!==pid&&l.linkedProjectId!==pid);
    audit(db,user,`Deleted project ${p.wbs} and ${tids.length} tasks`,{entityType:'project',entityId:pid,projectId:pid}); write(db); return send(res,200,{ok:true});
  }

  if(req.method==='POST'&&u.pathname==='/api/work-packages'){
    if(!ps.createTasks)return send(res,403,{error:'Create Tasks permission required'}); const b=await body(req), p=project(db,b.projectId); if(!p)return send(res,404,{error:'Project not found'});
    if(!canReadTask({},ps,p,db,user))return send(res,403,{error:'Project engineering access required'}); const wbs=nextWbs(db,p,p.wbs), t={id:id('wp'),projectId:p.id,wbs,parentWbs:p.wbs,level:2,title:b.title||'Work package',department:b.department||b.title||'Engineering',assignee:ps.assignTasks?(b.assignee||'Unassigned'):'Unassigned',priority:b.priority||'Normal',status:b.status||'In Progress',mhEstimate:Number(b.mhEstimate||0),mhActual:Number(b.mhActual||0),startDate:b.startDate||new Date().toISOString().slice(0,10),dueDate:b.dueDate||'',dependency:'',action:b.action||'',remarks:b.remarks||'',flag:'',flagReason:''};
    if(b.workflowNodeId){if(Number(t.level)===2)return send(res,422,{error:'Link individual tasks, not work package totals, to workflow objects'});const error=WF.editError(db,p,user,ps,b.workflowNodeId);if(error)return send(res,403,{error});t.workflowNodeId=b.workflowNodeId;}
    const validation=taskError(t);if(validation)return send(res,422,{error:validation});if(t.assignee!=='Unassigned'&&!db.users.some(u=>u.active&&u.name===t.assignee))return send(res,422,{error:'Assignee must be an active team member'});
    db.tasks.push(t);if(t.workflowNodeId)db.projectWorkflows[p.id].revision++; audit(db,user,`Created Level 2 work package ${wbs}`,{entityType:'task',entityId:t.id,workflowNodeId:t.workflowNodeId,projectId:p.id}); write(db); return send(res,201,{ok:true,task:safeTask(t,ps,p)});
  }
  if(req.method==='POST'&&u.pathname==='/api/tasks'){
    if(!ps.createTasks)return send(res,403,{error:'Create Tasks permission required'}); const b=await body(req), p=project(db,b.projectId); if(!p)return send(res,404,{error:'Project not found'});
    if(!b.workflowNodeId&&db.projectWorkflows[p.id]?.nodes.some(n=>n.id==='execution'))b.workflowNodeId='execution';
    if(!canReadTask({},ps,p,db,user))return send(res,403,{error:'Project engineering access required'}); const parent=b.parentWbs||p.wbs; if(parent!==p.wbs&&!db.tasks.some(t=>t.projectId===p.id&&t.wbs===parent&&Number(t.level)===2))return send(res,400,{error:'Invalid parent work package'}); const wbs=nextWbs(db,p,parent), t={id:id('t'),projectId:p.id,wbs,parentWbs:parent,level:3,title:b.title||'New task',department:b.department||'Engineering',assignee:ps.assignTasks?(b.assignee||'Unassigned'):'Unassigned',priority:b.priority||'Normal',status:b.assignee&&b.assignee!=='Unassigned'&&(!b.status||b.status==='To Do')?'Assigned':(b.status||'To Do'),mhEstimate:Number(b.mhEstimate||0),mhActual:Number(b.mhActual||0),startDate:b.startDate||new Date().toISOString().slice(0,10),dueDate:b.dueDate||'',dependency:b.dependency||'',action:b.action||'',remarks:b.remarks||'',flag:b.flag||'',flagReason:b.flagReason||''};
    if(b.workflowNodeId){if(Number(t.level)===2)return send(res,422,{error:'Link individual tasks, not work package totals, to workflow objects'});const error=WF.editError(db,p,user,ps,b.workflowNodeId);t.workflowNodeId=b.workflowNodeId;if(error&&!(WF.canPlanTask(db,p,user,ps,t)&&['Not Started','To Do','Assigned'].includes(t.status)&&!t.mhActual))return send(res,403,{error});}
    const validation=taskError(t);if(validation)return send(res,422,{error:validation}); if(t.assignee!=='Unassigned'&&!db.users.some(u=>u.active&&u.name===t.assignee))return send(res,422,{error:'Assignee must be an active team member'});
    if(t.mhActual>t.mhEstimate&&(!['Escalation','Bottleneck'].includes(t.flag)||!String(t.flagReason||'').trim()))return send(res,422,{error:'Actual MH exceeds estimate. Select Escalation or Bottleneck and enter a reason.'});
    if(t.flag)db.escalations.unshift({id:id('e'),taskId:t.id,projectId:t.projectId,type:t.flag,reason:t.flagReason,user:user.name,ts:now()}); db.tasks.push(t);if(t.workflowNodeId)db.projectWorkflows[p.id].revision++; audit(db,user,`Created task ${wbs} — ${t.title}`,{entityType:'task',entityId:t.id,workflowNodeId:t.workflowNodeId,projectId:p.id}); if(t.assignee!=='Unassigned')notify(db,`Task ${wbs} assigned to ${t.assignee}`,[t.assignee]); write(db); return send(res,201,{ok:true,task:safeTask(t,ps,p)});
  }
  if(req.method==='PATCH'&&/^\/api\/tasks\/[^/]+$/.test(u.pathname)){
    const tid=u.pathname.split('/').pop(), t=db.tasks.find(x=>x.id===tid); if(!t)return send(res,404,{error:'Task not found'}); const p=project(db,t.projectId), b=await body(req), before=structuredClone(t);
    if(!canReadTask(t,ps,p,db,user)||(!ps.assignTasks&&t.assignee!==user.name))return send(res,403,{error:'Only the assignee or a task lead can update this task'}); if(!ps.assignTasks&&['assignee','mhEstimate','title','projectId','startDate','dueDate'].some(k=>Object.hasOwn(b,k)&&b[k]!==t[k]))return send(res,403,{error:'Task assignment permission required'}); const allowed=['status','remarks','dependency']; if(ps.updateActualMH)allowed.push('mhActual'); if(ps.raiseEscalations)allowed.push('flag','flagReason'); if(ps.assignTasks)allowed.push('workflowNodeId','assignee','priority','mhEstimate','dueDate','department','startDate','action','title','plannedAllocations');
    const candidate={...t}; for(const k of allowed)if(Object.hasOwn(b,k))candidate[k]=['mhActual','mhEstimate'].includes(k)?Number(b[k]||0):b[k];
    if(['startDate','dueDate','mhEstimate'].some(k=>Object.hasOwn(b,k)&&b[k]!==t[k])&&!Object.hasOwn(b,'plannedAllocations'))delete candidate.plannedAllocations;
    if(Object.hasOwn(b,'plannedAllocations')) {
      if(!ps.assignTasks)return send(res,403,{error:'Task assignment permission required to change daily allocations'});
      const entries=b.plannedAllocations;
      if(entries===null)delete candidate.plannedAllocations;
      else {
        if(!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).length>366)return send(res,422,{error:'Use at most 366 daily allocations'});
        let sum=0;for(const [date,hours] of Object.entries(entries)) {
          if(!validDate(date)||!candidate.startDate||!candidate.dueDate||date<candidate.startDate||date>candidate.dueDate||typeof hours!=='number'||!Number.isFinite(hours)||hours<=0||hours>24)return send(res,422,{error:'Daily allocations need positive hours up to 24, within the planned start and finish'});
          sum+=hours;
        }
        if(Math.abs(sum-Number(candidate.mhEstimate))>0.0001)return send(res,422,{error:'Daily allocations must add up to the task estimate'});
        candidate.plannedAllocations=entries;
      }
    }
    const validation=taskError(candidate);if(validation)return send(res,422,{error:validation}); if(candidate.assignee!=='Unassigned'&&!db.users.some(u=>u.active&&u.name===candidate.assignee))return send(res,422,{error:'Assignee must be an active team member'}); if(before.assignee!==candidate.assignee&&candidate.assignee!=='Unassigned'&&candidate.status==='To Do')candidate.status='Assigned';
    if(Number(candidate.mhActual)>Number(candidate.mhEstimate)&&(!['Escalation','Bottleneck'].includes(candidate.flag)||!String(candidate.flagReason||'').trim()))return send(res,422,{error:'Actual MH exceeds estimate. Select Escalation or Bottleneck and enter a reason.'});
    const planningOnly=Object.keys(b).every(k=>['assignee','mhEstimate','startDate','dueDate','priority','title','department','plannedAllocations'].includes(k));
    if(t.timeEntries?.length && Object.hasOwn(b,'mhActual') && Number(b.mhActual)!==Number(t.mhActual))return send(res,409,{error:'Actual hours are calculated from time entries. Log time instead.'});
    if(t.workflowNodeId&&!WF.canUpdateTask(db,p,user,ps,t)&&!(planningOnly&&WF.canPlanTask(db,p,user,ps,t)))return send(res,403,{error:'Workflow object is locked for execution; only task planning is available'});if(Object.hasOwn(b,'workflowNodeId')){if(!ps.assignTasks)return send(res,403,{error:'Task assignment permission required'});if(b.workflowNodeId){if(Number(t.level)===2)return send(res,422,{error:'Link individual tasks, not work package totals, to workflow objects'});const error=WF.editError(db,p,user,ps,b.workflowNodeId);if(error)return send(res,403,{error});}candidate.workflowNodeId=b.workflowNodeId||'';}
    Object.assign(t,candidate);if(t.workflowNodeId||before.workflowNodeId)db.projectWorkflows[p.id].revision++; const changes=diff(before,t,allowed); if(changes.length){ audit(db,user,`Updated task ${t.wbs}: ${changes.map(c=>c.field).join(', ')}`,{entityType:'task',entityId:t.id,workflowNodeId:t.workflowNodeId,projectId:t.projectId,changes}); if(before.assignee!==t.assignee&&t.assignee)notify(db,`Task ${t.wbs} assigned to ${t.assignee}`,[t.assignee]); if(before.flag!==t.flag||before.flagReason!==t.flagReason){ db.escalations.unshift({id:id('e'),taskId:t.id,projectId:t.projectId,type:t.flag,reason:t.flagReason,user:user.name,ts:now()}); if(t.flag)notify(db,`${t.flag} flagged on ${t.wbs}`,['Senior Management','System Administrator']); } }
    write(db); return send(res,200,{ok:true,task:safeTask(t,ps,p)});
  }
  if(req.method==='POST'&&/^\/api\/tasks\/[^/]+\/time-entries$/.test(u.pathname)) {
    const t=db.tasks.find(t=>t.id===u.pathname.split('/')[3]), b=await body(req);
    if(!t)return send(res,404,{error:'Task not found'});
    const p=project(db,t.projectId);
    if(!ps.updateActualMH||!canReadTask(t,ps,p,db,user)||t.assignee!==user.name||Number(t.level||3)<3)return send(res,403,{error:'Only the assigned team member can log time on an individual task'});
    if(['Completed','Lost/Cancelled','Not Required','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(t.status)||!WF.canUpdateTask(db,p,user,ps,t))return send(res,403,{error:'Reopen completed work or wait for workflow prerequisites before logging time'});
    const hours=Number(b.hours), description=String(b.description||'').trim();
    if(planningDateError(b.date,b.date)||!b.date||b.date>new Date().toISOString().slice(0,10)||!Number.isFinite(hours)||hours<=0||hours>24||!description||description.length>2000)return send(res,422,{error:'Enter a valid date up to today, hours above zero and at most 24, and a description (maximum 2000 characters)'});
    const entryId=String(b.entryId||''); if(!/^[a-zA-Z0-9-]{8,100}$/.test(entryId))return send(res,422,{error:'A unique time entry reference is required'});
    if((t.timeEntries||[]).some(e=>e.id===entryId))return send(res,200,{ok:true,task:safeTask(t,ps,p)});
    const daily=db.tasks.flatMap(t=>t.timeEntries||[]).filter(e=>e.userId===user.id&&e.date===b.date).reduce((sum,e)=>sum+e.hours,0);
    if(daily+hours>24)return send(res,422,{error:'Daily logged time across tasks cannot exceed 24 hours'});
    const opening=t.actualOpeningBalance??Number(t.mhActual||0), actual=Math.round((opening+(t.timeEntries||[]).reduce((sum,e)=>sum+e.hours,0)+hours)*10000)/10000;
    if(actual>Number(t.mhEstimate||0)&&!String(b.overrunReason||t.flagReason||'').trim())return send(res,422,{error:'Actual hours exceed the estimate. An overrun reason is required'});
    t.actualOpeningBalance=opening; (t.timeEntries||=[]).push({id:entryId,date:b.date,hours,description,userId:user.id,user:user.name,createdAt:now()});t.mhActual=actual;
    if(actual>Number(t.mhEstimate||0)){t.flag='Escalation';t.flagReason=String(b.overrunReason||t.flagReason).trim();db.escalations.unshift({id:id('e'),taskId:t.id,projectId:p.id,type:t.flag,reason:t.flagReason,user:user.name,ts:now()});notify(db,`Hours exceeded estimate on ${t.wbs}`,['Senior Management','System Administrator']);}
    if(t.workflowNodeId)db.projectWorkflows[p.id].revision++;
    audit(db,user,`Logged ${hours} hours on ${t.wbs}`,{entityType:'task',entityId:t.id,projectId:p.id,workflowNodeId:t.workflowNodeId});write(db);return send(res,201,{ok:true,task:safeTask(t,ps,p)});
  }
  if(req.method==='DELETE'&&/^\/api\/tasks\/[^/]+$/.test(u.pathname)){
    if(!ps.createTasks)return send(res,403,{error:'Create Tasks permission required'}); const tid=u.pathname.split('/').pop(), t=db.tasks.find(x=>x.id===tid); if(!t)return send(res,404,{error:'Task not found'});
    if(t.workflowNodeId){const error=WF.editError(db,project(db,t.projectId),user,ps,t.workflowNodeId);if(error)return send(res,403,{error});}
    if(!canReadTask(t,ps,project(db,t.projectId),db,user))return send(res,403,{error:'Task access required'}); if(db.tasks.some(x=>x.projectId===t.projectId&&x.parentWbs===t.wbs))return send(res,409,{error:'Delete child tasks before deleting a work package'}); db.tasks=db.tasks.filter(x=>x.id!==tid); db.comments=db.comments.filter(c=>c.taskId!==tid); audit(db,user,`Deleted task ${t.wbs}`,{entityType:'task',entityId:tid,workflowNodeId:t.workflowNodeId,projectId:t.projectId}); write(db); return send(res,200,{ok:true});
  }
  if(req.method==='POST'&&/^\/api\/tasks\/[^/]+\/comments$/.test(u.pathname)){
    const tid=u.pathname.split('/')[3], t=db.tasks.find(x=>x.id===tid), b=await body(req); if(!t)return send(res,404,{error:'Task not found'}); if(!canReadTask(t,ps,project(db,t.projectId),db,user))return send(res,403,{error:'Task access required'}); if(t.workflowNodeId&&!WF.canUpdateTask(db,project(db,t.projectId),user,ps,t))return send(res,403,{error:'Workflow object is locked or read-only'});if(!String(b.text||'').trim())return send(res,400,{error:'Comment is required'});
    const c={id:id('c'),taskId:tid,projectId:t.projectId,text:String(b.text).trim(),user:user.name,ts:now()}; db.comments.unshift(c); audit(db,user,`Commented on task ${t.wbs}`,{entityType:'comment',entityId:c.id,projectId:t.projectId}); write(db); return send(res,201,{ok:true,comment:c});
  }

  if(req.method==='GET'&&u.pathname==='/api/capacity'){
    if(!ps.viewCapacity)return send(res,403,{error:'View Capacity permission required'});
    const start=u.searchParams.get('start')||new Date().toISOString().slice(0,10), days=Math.min(90,Math.max(1,Number(u.searchParams.get('days')||14))), standard=Number(db.settings.standardHoursPerDay||8);
    if(!validDate(start)||!Number.isFinite(days))return send(res,400,{error:'Invalid capacity date or day count'});
    const dates=[]; let d=new Date(`${start}T00:00:00Z`); for(let i=0;i<days;i++){dates.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}
    const rows=db.users.filter(x=>x.active).map(person=>{ const booked={},allocations={}; for(const t of db.tasks.filter(t=>t.assignee===person.name&&Number(t.level||3)>=3&&!['Completed','Lost/Cancelled','Not Required','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(t.status)&&canReadTask(t,ps,project(db,t.projectId),db,user))){ const spread=t.plannedAllocations||spreadHours(t.startDate,Number(t.mhEstimate||0),standard,t.dueDate); for(const [dt,h] of Object.entries(spread)){booked[dt]=(booked[dt]||0)+h;(allocations[dt]||=[]).push({taskId:t.id,hours:h});} } const cells=dates.map(date=>{ const leave=db.leave.find(l=>l.user===person.name&&l.date===date); const weekend=[0,6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()); const cap=weekend||leave?0:Number(person.capacity||standard); const used=Number(booked[date]||0); return {date,booked:used,capacity:cap,free:Math.max(0,cap-used),leave:leave?.type||'',allocations:allocations[date]||[]}; }); return {user:person.name,position:person.position,capacity:Number(person.capacity||standard),cells}; });
    return send(res,200,{start,days,rows});
  }
  if(req.method==='POST'&&u.pathname==='/api/leave'){
    if(!ps.manageLeave)return send(res,403,{error:'Manage Leave permission required'}); const b=await body(req); if(!b.user||!b.date)return send(res,400,{error:'User and date are required'});
    if(!b.date||planningDateError(b.date,'')||!db.users.some(u=>u.active&&u.name===b.user))return send(res,422,{error:'An active team member and a valid date between 1900 and 2100 are required'}); if(db.leave.some(l=>l.user===b.user&&l.date===b.date))return send(res,409,{error:'Leave already recorded for this day'});
    const l={id:id('l'),user:b.user,date:b.date,type:b.type||'Leave',note:b.note||''}; db.leave.push(l); audit(db,user,`Marked ${l.type} for ${l.user} on ${l.date}`,{entityType:'leave',entityId:l.id}); write(db); return send(res,201,{ok:true,id:l.id});
  }
  if(req.method==='DELETE'&&/^\/api\/leave\/[^/]+$/.test(u.pathname)){
    if(!ps.manageLeave)return send(res,403,{error:'Manage Leave permission required'}); const lid=u.pathname.split('/').pop(), l=db.leave.find(x=>x.id===lid); if(!l)return send(res,404,{error:'Leave record not found'});
    db.leave=db.leave.filter(x=>x.id!==lid); audit(db,user,`Removed ${l.type} for ${l.user} on ${l.date}`,{entityType:'leave',entityId:lid}); write(db); return send(res,200,{ok:true});
  }

  if(req.method==='POST'&&u.pathname==='/api/users'){
    if(!ps.manageTeam)return send(res,403,{error:'Manage Team permission required'}); const b=await body(req); if(!String(b.name||'').trim())return send(res,400,{error:'Name is required'});
    const nu={id:id('u'),name:String(b.name).trim(),username:String(b.username||b.name).trim(),userId:String(b.userId||Math.floor(Math.random()*900000+100000)),email:String(b.email||'').trim(),position:String(b.position||'').trim(),capacity:Number(b.capacity||8),profileId:b.profileId&&profileExists(db,b.profileId)?b.profileId:'prof-tse',active:b.active!==false};
    if(protectedUser(user,null,nu.profileId))return send(res,403,{error:'Only System Administrators can assign System Administrator access'});
    if(uniqueUserConflict(db,null,nu.username,nu.userId))return send(res,409,{error:'Username or User ID already exists'}); db.users.push(nu); audit(db,user,`Added team member ${nu.name}`,{entityType:'user',entityId:nu.id}); write(db); return send(res,201,{ok:true,id:nu.id});
  }
  if(req.method==='PATCH'&&/^\/api\/users\/[^/]+$/.test(u.pathname)){
    if(!ps.manageTeam)return send(res,403,{error:'Manage Team permission required'}); const uid=u.pathname.split('/').pop(), target=db.users.find(x=>x.id===uid); if(!target)return send(res,404,{error:'User not found'}); const b=await body(req),before=structuredClone(target);if(Object.hasOwn(b,'capacity')&&(!Number.isFinite(Number(b.capacity))||Number(b.capacity)<=0||Number(b.capacity)>24))return send(res,422,{error:'Daily capacity must be greater than zero and at most 24'});
    if(protectedUser(user,target))return send(res,403,{error:'Only System Administrators can manage System Administrator accounts'});
    if(target.id===user.id&&b.active===false)return send(res,400,{error:'You cannot deactivate your own account'});
    if(isSystemAdmin(target)&&b.active===false&&db.users.filter(x=>x.active&&isSystemAdmin(x)).length<=1)return send(res,400,{error:'At least one active System Administrator must remain'});
    for(const k of ['name','email','position'])if(Object.hasOwn(b,k))target[k]=String(b[k]).trim(); if(Object.hasOwn(b,'capacity'))target.capacity=Number(b.capacity); if(Object.hasOwn(b,'active'))target.active=!!b.active;
    const changes=diff(before,target,['name','email','position','capacity','active']); if(changes.length)audit(db,user,`Updated team member ${target.name}`,{entityType:'user',entityId:uid,changes}); write(db); return send(res,200,{ok:true});
  }
  if(req.method==='DELETE'&&/^\/api\/users\/[^/]+$/.test(u.pathname)){
    if(!ps.manageTeam)return send(res,403,{error:'Manage Team permission required'}); const uid=u.pathname.split('/').pop(), target=db.users.find(x=>x.id===uid); if(!target)return send(res,404,{error:'User not found'}); if(target.id===user.id)return send(res,400,{error:'You cannot deactivate your own account'});
    if(protectedUser(user,target))return send(res,403,{error:'Only System Administrators can manage System Administrator accounts'});
    if(isSystemAdmin(target)&&db.users.filter(x=>x.active&&isSystemAdmin(x)).length<=1)return send(res,400,{error:'At least one active System Administrator must remain'});
    target.active=false; for(const[token,s]of sessions)if(s.userId===uid)sessions.delete(token); audit(db,user,`Deactivated team member ${target.name}`,{entityType:'user',entityId:uid}); write(db); return send(res,200,{ok:true});
  }

  if(req.method==='POST'&&u.pathname==='/api/import'){
    if(!ps.importData)return send(res,403,{error:'Import permission required'}); if(!ps.createCommercial||!ps.createTasks)return send(res,403,{error:'Commercial creation and task permissions required for tracker import'}); const b=await body(req); const rows=Array.isArray(b.rows)?b.rows:[]; if(!rows.length)return send(res,400,{error:'No rows supplied'});
    if(rows.length>10000)return send(res,422,{error:'Import limit is 10000 rows'});
    const knownRoots=new Set(db.projects.map(p=>String(p.wbs)));const incoming=new Set();
    for(const [i,row] of rows.entries()){const wbs=String(row.WBS??row.wbs??'').trim(),level=Number(row.Level??row.level??0);if(!wbs||![1,2,3].includes(level)||incoming.has(wbs))return send(res,422,{error:'Invalid or duplicate WBS / Level on row '+(i+2)});incoming.add(wbs);if(level===1)knownRoots.add(wbs);for(const k of ['MH Estimations','Actual MH','mhEstimate','mhActual'])if(Object.hasOwn(row,k)&&(!Number.isFinite(Number(row[k]))||Number(row[k])<0))return send(res,422,{error:'Invalid man-hours on row '+(i+2)});}
    for(const [i,row]of rows.entries()){const wbs=String(row.WBS??row.wbs).trim();if(Number(row.Level??row.level)>1&&!knownRoots.has(wbs.split('.')[0]))return send(res,422,{error:'Unknown project WBS on row '+(i+2)});}
    for(const [i,row]of rows.entries()){const level=Number(row.Level??row.level);const dateError=planningDateError(row['Start Date']??new Date().toISOString().slice(0,10),level===1?row['Expected Delivery Date']||'':row['Due Date']||'',level===1?'Expected delivery date':'Due date');if(dateError)return send(res,422,{error:dateError+' on row '+(i+2)});}
    const sourceRows=structuredClone(rows);
    rows.sort((a,b)=>Number(a.Level??a.level)-Number(b.Level??b.level));
    const createdProjects=new Map(); let projectsAdded=0,tasksAdded=0;
    for(const row of rows){ const wbs=String(row.WBS??row.wbs??'').trim(), level=Number(row.Level??row.level??0); if(!wbs)continue;
      if(level===1){ const existing=db.projects.find(p=>String(p.wbs)===wbs); if(existing){createdProjects.set(wbs,existing);continue;} const p={id:id('p'),wbs,type:'commercial',client:String(row.CLIENT??row.Client??''),title:String(row.Project??row.project??row.Details??'Imported project'),aircraft:String(row.Aircraft??''),registration:String(row['A/C Reg']??''),releaseType:String(row['MRO Release']??''),sector:String(row['ETS Sub-Dept']??''),owner:String(row.Owner??''),priority:String(row.Priority??'Normal'),stage:String(row.Stage??row.Status??'RFQ'),status:String(row.Status??'RFQ'),scope:String(row['DOA Scope']??''),edd:String(row['Expected Delivery Date']??''),startDate:String(row['Start Date']??new Date().toISOString().slice(0,10)),remarks:String(row.Remarks??''),pricing:{}}; db.projects.push(p); createdProjects.set(wbs,p); projectsAdded++; }
      else if(level>=2){ const root=wbs.split('.')[0], p=createdProjects.get(root)||db.projects.find(x=>String(x.wbs)===root); if(!p)continue; if(db.tasks.some(t=>String(t.wbs)===wbs&&t.projectId===p.id))continue; const t={id:id(level===2?'wp':'t'),projectId:p.id,wbs,parentWbs:wbs.split('.').slice(0,-1).join('.'),level,title:String(row.Details??row.Task??row.Project??'Imported task'),department:String(row['ETS Sub-Dept']??row.Department??'Engineering'),assignee:String(row.Owner??row.Assignee??'Unassigned'),priority:String(row.Priority??'Normal'),status:String(row.Status??'To Do'),mhEstimate:Number(row['MH Estimations']??row.mhEstimate??0),mhActual:Number(row['Actual MH']??row.mhActual??0),startDate:String(row['Start Date']??new Date().toISOString().slice(0,10)),dueDate:String(row['Due Date']??''),dependency:String(row.Dependency??''),action:String(row.Action??''),remarks:String(row.Remarks??''),flag:String(row.Escalation??''),flagReason:String(row['Escalation Reason']??'')}; db.tasks.push(t); tasksAdded++; }
    }
    db.importHistory||=[];const importId=id('import');db.importHistory.push({id:importId,createdAt:now(),createdById:user.id,sourceRows,records:sourceRows.map(row=>{const wbs=String(row.WBS??row.wbs).trim();const record=Number(row.Level??row.level)===1?db.projects.find(p=>String(p.wbs)===wbs):db.tasks.find(t=>String(t.wbs)===wbs);return {wbs,entityId:record?.id||null,entityType:Number(row.Level??row.level)===1?'project':'task'};})});
    audit(db,user,`Imported tracker data: ${projectsAdded} projects, ${tasksAdded} child records`,{entityType:'import',entityId:importId}); write(db); return send(res,200,{ok:true,projectsAdded,tasksAdded,importId});
  }

  if(req.method==='PATCH'&&u.pathname==='/api/settings'){
    if(!ps.manageSettings)return send(res,403,{error:'Manage Settings permission required'}); const b=await body(req),before=structuredClone(db.settings);if(b.registerConfig&&Register.error(b.registerConfig))return send(res,422,{error:Register.error(b.registerConfig)}); if(Object.hasOwn(b,'standardHoursPerDay')&&(!Number.isFinite(Number(b.standardHoursPerDay))||Number(b.standardHoursPerDay)<=0||Number(b.standardHoursPerDay)>24))return send(res,422,{error:'Standard hours must be greater than zero and at most 24'}); db.settings={...db.settings,...b}; audit(db,user,'Updated system settings',{entityType:'settings',changes:diff(before,db.settings,Object.keys(b))}); write(db); return send(res,200,{ok:true,settings:db.settings});
  }
  if(req.method==='POST'&&u.pathname==='/api/notifications/read'){
    const b=await body(req),ids=b.ids||db.notifications.map(n=>n.id); db.notifications.forEach(n=>{n.readBy||=[];if(ids.includes(n.id)&&!n.readBy.includes(user.name))n.readBy.push(user.name)}); write(db); return send(res,200,{ok:true});
  }
  if(req.method==='GET'&&u.pathname==='/api/export.json'){
    if(!ps.exportData)return send(res,403,{error:'Export permission required'});
    const projects=db.projects.filter(p=>p.type!=='commercial'||ps.viewCommercial), ids=new Set(projects.map(p=>p.id));
    const tasks=db.tasks.filter(t=>ids.has(t.projectId)&&canReadTask(t,ps,project(db,t.projectId),db,user)), tids=new Set(tasks.map(t=>t.id));
    return send(res,200,{projects:projects.map(p=>safeProject(p,ps)),tasks:tasks.map(t=>safeTask(t,ps,project(db,t.projectId))),comments:db.comments.filter(c=>tids.has(c.taskId)),escalations:ps.viewReports?db.escalations.filter(e=>tids.has(e.taskId)):[],leave:ps.manageLeave?db.leave:[],audit:ps.viewAudit?db.audit.filter(a=>workflowAuditVisible(db,a,user,ps)).map(a=>safeAudit(a,ps)):[],workflows:projects.filter(p=>canReadTask({},ps,p,db,user)).map(p=>({projectId:p.id,workflow:WF.view(db,p,user,ps)})),users:db.users.map(({id,name,position,capacity,active})=>({id,name,position,capacity,active}))},'application/json',{'Content-Disposition':'attachment; filename="ets-ipm-data.json"'});
  }
  if(req.method==='GET'&&u.pathname==='/api/export.csv'){
    if(!ps.exportData)return send(res,403,{error:'Export permission required'}); const pmap=Object.fromEntries(db.projects.map(p=>[p.id,p])),head=['WBS','Project','Client','Type','Stage','Task','Assignee','Status','MH Estimate','MH Actual','Flag'],lines=[head.map(csv).join(',')];
    for(const t of db.tasks){const p=pmap[t.projectId];if(p?.type==='commercial'&&!ps.viewCommercial)continue;if(!canReadTask(t,ps,p,db,user))continue;const st=safeTask(t,ps,p);lines.push([t.wbs,p?.title,p?.client,p?.type,p?.stage,t.title,t.assignee,t.status,st.mhEstimate??'',st.mhActual??'',t.flag].map(csv).join(','));}
    return send(res,200,lines.join('\n'),'text/csv',{'Content-Disposition':'attachment; filename="ETS_Work_Tracker_export.csv"'});
  }
  if(req.method==='GET'&&u.pathname.startsWith('/api/reports/')){
    if(!ps.viewReports)return send(res,403,{error:'View Reports permission required'}); let lines;
    if(u.pathname.endsWith('mh.csv'))lines=[['WBS','Task','Estimate','Actual','Variance'].map(csv).join(','),...db.tasks.filter(t=>Number(t.level||3)>=3&&canReadTask(t,ps,project(db,t.projectId),db,user)).map(t=>[t.wbs,t.title,t.mhEstimate,t.mhActual,Number(t.mhActual||0)-Number(t.mhEstimate||0)].map(csv).join(','))];
    else if(u.pathname.endsWith('escalations.csv'))lines=[['Timestamp','Task','Type','User','Reason'].map(csv).join(','),...db.escalations.filter(e=>canReadTask(db.tasks.find(t=>t.id===e.taskId),ps,project(db,e.projectId),db,user)).map(e=>{const t=db.tasks.find(x=>x.id===e.taskId);return[e.ts,t?.wbs||e.taskId,e.type,e.user,e.reason].map(csv).join(',')})];
    else{const counts={};db.tasks.filter(t=>Number(t.level||3)>=3&&canReadTask(t,ps,project(db,t.projectId),db,user)).forEach(t=>counts[t.status]=(counts[t.status]||0)+1);lines=['Status,Count',...Object.entries(counts).map(([s,c])=>`${csv(s)},${c}`)];}
    return send(res,200,lines.join('\n'),'text/csv');
  }
  if(req.method==='POST'&&u.pathname==='/api/demo/clear-records'){
    if(!isSystemAdmin(user))return send(res,403,{error:'System Administrator access required'});
    fs.copyFileSync(DB,DB+'.backup-'+Date.now());
    require('./demo-maintenance').clearProjects(db);
    audit(db,user,'Cleared project register and linked work records',{entityType:'maintenance'});
    write(db);return send(res,200,{ok:true,cleared:true});
  }
  if(req.method==='POST'&&u.pathname==='/api/reset'){
    return send(res,410,{error:'Seed reset is disabled. Use the local demo setup command to clear project records without replacing accounts.'});
  }

  if(u.pathname.startsWith('/api/'))return send(res,404,{error:'API route not found. Update and restart the backend on port 5174 to match the demo.'});
  const file=u.pathname==='/'?path.join(ROOT,'public','index.html'):path.join(ROOT,'public',u.pathname.replace(/^\//,''));
  if(!file.startsWith(path.join(ROOT,'public')))return send(res,403,'Forbidden','text/plain');
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-store'});return fs.createReadStream(file).pipe(res);}
  return send(res,404,'Not found','text/plain');
}catch(e){console.error(e);return send(res,e instanceof SyntaxError?400:500,{error:e instanceof SyntaxError?'Invalid JSON request body':e.message||'Server error'});}finally{release?.()}});

server.listen(PORT,'0.0.0.0',()=>console.log(`ETS IPM running on port ${PORT}`));

