const crypto=require('node:crypto');
const kinds=['commercial','internal_eer'];
function types(db){return db.settings.projectTypes||db.workflowConfig.projectTypes.map(t=>({...t,kind:t.id,active:true}));}
function resolveType(db,b){return types(db).find(t=>t.id===(b.projectTypeId||b.type)&&t.active!==false);}
function calendar(db){return {timeZone:'Asia/Dubai',workingDays:[1,2,3,4,5],reserveHours:0,holidays:[],...db.settings.workCalendar};}
function fields(db){return db.settings.userFields||[];}
function profileError(db,values){if(!values||typeof values!=='object'||Array.isArray(values))return 'Profile details must be an object';for(const[k,v]of Object.entries(values)){const field=fields(db).find(f=>f.id===k);if(!field||typeof v!=='string'||v.length>2000)return 'Use configured profile fields with values up to 2000 characters';if(field.type==='date'&&v&&!validDate(v))return 'Enter valid profile dates';}return '';}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function urlError(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return true;return false}catch{return true}}
function canAdmin(user,ps){return user.profileId==='prof-admin'||user.profileId==='prof-app-admin'||ps.manageBusinessRoles;}
function configVersion(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function syncFocals(db,p){const contacts=db.clients.find(c=>c.id===p.clientId)?.contacts||[];p.clientFocal=(p.clientContactIds||[]).map(id=>contacts.find(c=>c.id===id)?.name).filter(Boolean).join('; ');const instance=db.projectWorkflows?.[p.id];if(instance){for(const node of instance.nodes)for(const field of require('./workflow-fields').fieldsFor(node))if(field.projectField==='clientFocal'){instance.states[node.id].values||={};instance.states[node.id].values[field.id]=p.clientFocal;}instance.revision++;}}
async function handle(ctx){const{req,res,url,db,user,ps,body,send,audit,write,id,now,project,canReadTask,WF}=ctx;const path=url.pathname;
 if(path==='/api/project-types'){
  if(req.method==='GET'){send(res,200,{types:types(db),version:configVersion(types(db))});return true}
  if(req.method!=='PUT'){send(res,405,{error:'Use GET or PUT'});return true}if(!ps.manageSettings){send(res,403,{error:'Manage Settings permission required'});return true}
  const b=await body(req),list=b.types;if(b.expectedVersion!==configVersion(types(db))){send(res,409,{error:'Project types changed. Reload before saving.'});return true}
  if(!Array.isArray(list)||list.length<2||list.length>50||list.some(t=>!t||typeof t!=='object')||new Set(list.map(t=>t.id)).size!==list.length||new Set(list.map(t=>String(t.name).trim().toLowerCase())).size!==list.length||list.some(t=>!t||typeof t.id!=='string'||!/^[-_a-zA-Z0-9]{1,80}$/.test(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>80||!kinds.includes(t.kind)||typeof t.active!=='boolean'||!db.workflowConfig.workflows.some(w=>w.id===t.workflowId&&(!w.projectType||w.projectType===t.kind)))){send(res,422,{error:'Use unique types with a name, access category and compatible workflow'});return true}
  if(types(db).some(t=>!list.some(n=>n.id===t.id))||list.some(t=>types(db).some(old=>old.id===t.id&&old.kind!==t.kind))){send(res,422,{error:'Archive types instead of deleting them; existing access categories cannot change'});return true}
  const before=types(db);db.settings.projectTypes=list.map(({id,name,kind,workflowId,active})=>({id,name:name.trim(),kind,workflowId,active}));audit(db,user,'Updated project types',{entityType:'settings',changes:[{field:'projectTypes',from:before,to:db.settings.projectTypes}]});write(db);send(res,200,{ok:true});return true
 }
 if(path==='/api/user-fields'){
  if(!ps.manageUsers){send(res,403,{error:'Manage Users permission required'});return true}if(req.method==='GET'){send(res,200,{fields:fields(db),version:configVersion(fields(db))});return true}
  if(req.method!=='PUT'){send(res,405,{error:'Use GET or PUT'});return true}const b=await body(req);if(b.expectedVersion!==configVersion(fields(db))){send(res,409,{error:'Profile field configuration changed. Reload.'});return true}
  if(!Array.isArray(b.fields)||b.fields.length>40||b.fields.some(f=>!f||typeof f!=='object')||new Set(b.fields.map(f=>f.id)).size!==b.fields.length||b.fields.some(f=>!/^field-[a-zA-Z0-9-]{1,70}$/.test(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>80||!['text','date'].includes(f.type)||typeof f.active!=='boolean')||fields(db).some(f=>!b.fields.some(n=>n.id===f.id&&n.type===f.type))){send(res,422,{error:'Use unique text/date profile fields; archive existing fields instead of deleting or changing their type'});return true}
  db.settings.userFields=b.fields.map(f=>({id:f.id,label:f.label.trim(),type:f.type,active:f.active}));audit(db,user,'Updated user profile field configuration',{entityType:'settings'});write(db);send(res,200,{ok:true});return true
 }
 if(path==='/api/work-calendar'){
  if(req.method==='GET'){send(res,200,{calendar:calendar(db),version:configVersion(calendar(db))});return true}if(req.method!=='PUT'){send(res,405,{error:'Use GET or PUT'});return true}if(!ps.manageCalendar){send(res,403,{error:'Manage working calendar permission required'});return true}
  const b=await body(req),c=b.calendar;try{if(!c||typeof c.timeZone!=='string'||!c.timeZone)throw Error();new Intl.DateTimeFormat('en',{timeZone:c.timeZone}).format()}catch{send(res,422,{error:'Choose a valid time zone'});return true}
  if(b.expectedVersion!==configVersion(calendar(db))){send(res,409,{error:'Calendar changed. Reload.'});return true}
  if(!Array.isArray(c.workingDays)||!c.workingDays.length||c.workingDays.some(x=>!Number.isInteger(x)||x<0||x>6)||new Set(c.workingDays).size!==c.workingDays.length||!Number.isFinite(c.reserveHours)||c.reserveHours<0||c.reserveHours>=24||!Array.isArray(c.holidays)||c.holidays.length>500||c.holidays.some(d=>!validDate(d))){send(res,422,{error:'Choose working days, a reserve of 0–23 hours, and valid holiday dates'});return true}
  const before=calendar(db);db.settings.workCalendar={timeZone:c.timeZone,workingDays:c.workingDays,reserveHours:c.reserveHours,holidays:[...new Set(c.holidays)]};audit(db,user,'Updated working calendar',{entityType:'settings',changes:[{field:'workCalendar',from:before,to:db.settings.workCalendar}]});write(db);send(res,200,{ok:true});return true
 }
 const match=path.match(/^\/api\/projects\/([^/]+)\/(document-links|focal-contacts)$/);
 if(match){const p=project(db,match[1]);if(!p||!canReadTask({},ps,p,db,user)){send(res,404,{error:'Project not found'});return true}const key=match[2]==='document-links'?'documentLinks':'clientContactIds';
  const access=require('./field-access').mappedAccess(db,p,user,ps,WF);const focalAccess=access.client==='hidden'?'hidden':access.clientFocal||'edit';
  if(key==='clientContactIds'&&focalAccess==='hidden'){send(res,403,{error:'Client focal access required'});return true}
  if(req.method==='GET'){send(res,200,{[key]:p[key]||[],version:configVersion(p[key]||[]),canEdit:!!ps.editProjects&&(key==='documentLinks'||focalAccess==='edit')});return true}
  if(req.method!=='PUT'){send(res,405,{error:'Use GET or PUT'});return true}if(!ps.editProjects||(key==='clientContactIds'&&focalAccess!=='edit')){send(res,403,{error:'Project editing and field access required'});return true}
  const b=await body(req);if(b.expectedVersion!==configVersion(p[key]||[])){send(res,409,{error:'Project details changed. Reload before saving.'});return true}
  let value=b[key];if(!Array.isArray(value)||value.length>50){send(res,422,{error:'Choose up to 50 entries'});return true}
  if(key==='documentLinks'){if(value.some(l=>!l||typeof l.label!=='string'||!l.label.trim()||l.label.length>120||typeof l.url!=='string'||l.url.length>2048||urlError(l.url))){send(res,422,{error:'Use a label and HTTPS URL without embedded credentials'});return true}value=value.map(l=>({label:l.label.trim(),url:l.url}));}
  else{const client=db.clients.find(c=>c.id===p.clientId);if(!client||value.some(v=>!client.contacts?.some(c=>c.id===v&&(c.active||(p.clientContactIds||[]).includes(v))))){send(res,422,{error:'Select active focal contacts belonging to this project’s client'});return true}value=[...new Set(value)];}
  const before=p[key]||[];p[key]=value;if(key==='clientContactIds')syncFocals(db,p);audit(db,user,'Updated project '+match[2],{entityType:'project',entityId:p.id,projectId:p.id,changes:[{field:key==='clientContactIds'?'clientFocal':'documentLinks',from:before,to:value}]});write(db);send(res,200,{ok:true});return true
 }
 const contact=path.match(/^\/api\/clients\/([^/]+)\/contacts(?:\/([^/]+))?$/);
 if(contact){if(!ps.viewClients){send(res,403,{error:'View Clients permission required'});return true}const c=db.clients.find(c=>c.id===contact[1]);if(!c){send(res,404,{error:'Client not found'});return true}const contactList=c.contacts||=[];
  if(req.method==='GET'){send(res,200,{contacts:contactList,canManage:!!ps.manageClients});return true}if(!ps.manageClients){send(res,403,{error:'Manage Clients permission required'});return true}if(!['POST','PATCH'].includes(req.method)){send(res,405,{error:'Use POST or PATCH'});return true}
  const b=await body(req),target=contact[2]?c.contacts.find(x=>x.id===contact[2]):{id:id('contact'),active:true,revision:0};if(!target){send(res,404,{error:'Contact not found'});return true}if(contact[2]&&b.expectedRevision!==target.revision){send(res,409,{error:'Contact changed. Reload before saving.'});return true}
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>160||['email','phone','position'].some(k=>b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>200))||b.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||b.active!==undefined&&typeof b.active!=='boolean'){send(res,422,{error:'Enter a contact name and valid contact details'});return true}
  Object.assign(target,{name:b.name.trim(),email:b.email||'',phone:b.phone||'',position:b.position||'',active:b.active!==false,revision:target.revision+1});if(!contact[2])c.contacts.push(target);c.revision=(c.revision||0)+1;audit(db,user,'Saved client focal contact '+target.name,{entityType:'client',entityId:c.id});write(db);send(res,contact[2]?200:201,{contact:target});return true
 }
 return false;
}
module.exports={types,resolveType,calendar,fields,profileError,canAdmin,configVersion,syncFocals,handle};
