const{workToday}=require('./work-date');
const defaults={morning:['Review assigned work and priorities','Review handover notes and outstanding issues','Confirm today’s availability and planned work','Check required inputs and report blockers'],end:['Record today’s work and actual time in the relevant tasks','Update task statuses and flag unresolved blockers','Save relevant documents in the correct project object','Prepare handover notes and tomorrow’s priorities']};
function normalize(db){if(!db.checklistAccessPolicyVersion){const senior=db.profiles.find(p=>p.id==='prof-senior');if(senior){senior.permissions.manageChecklists=false;senior.permissions.reviewChecklists=false;}db.checklistAccessPolicyVersion=1;}db.checklistTemplates||=[];db.checklistRuns||=[];if(!db.checklistDefaultsCreated){for(const role of db.profiles.filter(p=>p.id!=='prof-admin'))for(const shift of ['morning','end']){const extra=role.permissions.manageSettings?(shift==='morning'?'Review application feedback and access requests':'Review unresolved support and access issues'):role.permissions.assignTasks?(shift==='morning'?'Confirm team priorities, assignments and blockers':'Review team handovers and unresolved approvals'):(shift==='morning'?'Confirm your assigned task inputs and instructions':'Escalate unfinished assigned work to your lead');db.checklistTemplates.push({id:'shift-default-'+role.id+'-'+shift,name:role.name+' · '+(shift==='morning'?'Start of shift':'End of day'),shift,roleIds:[role.id],active:true,revision:1,items:[...defaults[shift],extra].map((text,i)=>({id:shift+'-'+i,text,required:true}))});}db.checklistDefaultsCreated=true;}}
function isCurrent(run,at=new Date()){try{return run.date===workToday(run.timeZone,at)}catch{return false;}}
function present(run,user,at=new Date()){const own=run.userId===user.id,current=isCurrent(run,at);return {...run,canEdit:own&&current&&run.status==='Draft',canReopen:own&&current&&run.status==='Submitted'};}
function listing(db,user,ps,url,at=new Date()){
 const scope=url.searchParams.get('scope')||'all',manage=!!ps.manageChecklists,review=!!ps.reviewChecklists;
 if(!['all','mine','history','review','templates'].includes(scope))return {status:422,error:'Choose a valid checklist view'};
 if(scope==='review'&&!review)return {status:403,error:'Review Shift Checklists permission required'};
 if(scope==='templates'&&!manage)return {status:403,error:'Manage Shift Checklists permission required'};
 const zone=url.searchParams.get('timeZone')||'UTC',today=workToday(zone,at),ownOnly=['mine','history'].includes(scope);
 const templates=['review','history'].includes(scope)?[]:db.checklistTemplates.filter(t=>!ownOnly&&manage||t.active&&t.roleIds.includes(user.profileId)).map(t=>({...t,assigned:t.roleIds.includes(user.profileId)}));
 let history=['mine','templates'].includes(scope)?[]:db.checklistRuns.filter(r=>r.userId===user.id||!ownOnly&&review);
 const people=scope==='review'?Array.from(new Map(history.map(r=>[r.userId,{id:r.userId,name:r.user}])).values()).sort((a,b)=>a.name.localeCompare(b.name)):[];
 const status=url.searchParams.get('status')||'all',date=url.searchParams.get('date')||'',person=url.searchParams.get('userId')||'all';
 if(!['all','Draft','Submitted'].includes(status)||date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))return {status:422,error:'Choose a valid date and checklist status'};
 if(ownOnly&&person!=='all'&&person!==user.id)return {status:403,error:'You can only read your own checklist history'};
 history=history.filter(r=>(status==='all'||r.status===status)&&(!date||r.date===date)&&(person==='all'||r.userId===person)).sort((a,b)=>b.date.localeCompare(a.date)||String(b.updatedAt||b.submittedAt||b.id).localeCompare(String(a.updatedAt||a.submittedAt||a.id)));
 const page=Number(url.searchParams.get('page')||1),pageSize=Number(url.searchParams.get('limit')||(scope==='all'?100:25));if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)return {status:422,error:'Use a positive page and a page size from 1 to 100'};
 const total=history.length,offset=(page-1)*pageSize;
 return {today,scope,templates,runs:['history','review','templates'].includes(scope)?[]:db.checklistRuns.filter(r=>r.userId===user.id?isCurrent(r,at):!ownOnly&&review&&r.date===today).map(r=>present(r,user,at)),history:history.slice(offset,offset+pageSize).map(r=>present(r,user,at)),pagination:{page,pageSize,total,hasPrevious:page>1,hasNext:offset+pageSize<total},people,profiles:!ownOnly&&scope!=='review'&&manage?db.profiles.map(p=>({id:p.id,name:p.name})):[],canManage:manage,canReview:review,userId:user.id};
}
async function handle(ctx){const{req,res,url,db,user,ps,body,send,audit,write,id,now}=ctx;if(!url.pathname.startsWith('/api/checklists'))return false;
 const admin=!!ps.manageChecklists;let today;try{today=workToday(url.searchParams.get('timeZone')||'UTC')}catch(e){send(res,422,{error:e.message});return true;}
 if(url.pathname==='/api/checklists'&&req.method==='GET'){try{const result=listing(db,user,ps,url);send(res,result.error?result.status:200,result.error?{error:result.error}:result);}catch(e){send(res,422,{error:e.message});}return true;}
 if(url.pathname==='/api/checklists/templates'&&req.method==='POST'||/^\/api\/checklists\/templates\/[^/]+$/.test(url.pathname)&&req.method==='PATCH'){
  if(!admin){send(res,403,{error:'Manage Shift Checklists permission required'});return true;}
  const b=await body(req),tid=url.pathname.split('/')[4],old=tid&&db.checklistTemplates.find(t=>t.id===tid);if(tid&&!old){send(res,404,{error:'Template not found'});return true;}
  if(old&&b.expectedRevision!==old.revision){send(res,409,{error:'Template changed. Reload before saving.'});return true;}
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>160||!['morning','end'].includes(b.shift)||!Array.isArray(b.roleIds)||!b.roleIds.length||new Set(b.roleIds).size!==b.roleIds.length||b.roleIds.some(r=>!db.profiles.some(p=>p.id===r))||!Array.isArray(b.items)||!b.items.length||b.items.length>50||b.items.some(i=>!i||typeof i!=='object'||typeof i.text!=='string'||!i.text.trim()||i.text.length>500||typeof i.required!=='boolean')||typeof b.active!=='boolean'){send(res,422,{error:'Choose a name, shift, existing roles and 1–50 checklist items; each item needs text and a required flag'});return true;}
  if(new Set(b.items.map(i=>i.text.trim().toLowerCase())).size!==b.items.length){send(res,422,{error:'Remove repeated checklist items'});return true;}
 const t={id:old?.id||id('checklist'),name:b.name.trim(),shift:b.shift,roleIds:b.roleIds,active:b.active,revision:(old?.revision||0)+1,items:b.items.map((i,index)=>({id:'item-'+index,text:i.text.trim(),required:i.required})),updatedBy:user.id,updatedAt:now()};if(old)Object.assign(old,t);else db.checklistTemplates.push(t);
  audit(db,user,'Saved shift checklist template '+t.name,{entityType:'checklist-template',entityId:t.id});write(db);send(res,old?200:201,{template:t});return true;
 }
 if(url.pathname==='/api/checklists/runs'&&req.method==='POST'){
  const b=await body(req),template=db.checklistTemplates.find(t=>t.id===b.templateId&&t.active&&t.roleIds.includes(user.profileId));if(!template){send(res,403,{error:'No active checklist assigned to your role'});return true;}
  let run=db.checklistRuns.find(r=>r.templateId===template.id&&r.userId===user.id&&r.date===today);if(!run){run={id:id('checkrun'),templateId:template.id,templateRevision:template.revision,name:template.name,shift:template.shift,userId:user.id,user:user.name,roleId:user.profileId,date:today,timeZone:url.searchParams.get('timeZone')||'UTC',items:structuredClone(template.items),answers:{},notes:'',status:'Draft',revision:1,history:[]};db.checklistRuns.push(run);audit(db,user,'Started shift checklist '+run.name,{entityType:'checklist',entityId:run.id});write(db);}send(res,200,{run:present(run,user)});return true;
 }
 if(/^\/api\/checklists\/runs\/[^/]+$/.test(url.pathname)&&req.method==='PATCH'){
  const run=db.checklistRuns.find(r=>r.id===url.pathname.split('/')[4]);if(!run||run.userId!==user.id){send(res,404,{error:'Checklist not found'});return true;}
  if(!isCurrent(run)){send(res,409,{error:'Past checklists are read-only'});return true;}const b=await body(req);if(b.expectedRevision!==run.revision){send(res,409,{error:'Checklist changed. Reload before saving.'});return true;}
  if(!['save','submit','reopen'].includes(b.action)){send(res,422,{error:'Choose a valid checklist action'});return true;}
  if(b.action==='reopen'){if(run.status!=='Submitted'||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000){send(res,422,{error:'Add a reason to reopen a submitted checklist'});return true;}run.history.push({action:'Reopened',at:now(),user:user.name,reason:b.reason.trim(),answers:structuredClone(run.answers),notes:run.notes,submittedAt:run.submittedAt});run.status='Draft';delete run.submittedAt;}
  else{if(run.status==='Submitted'){send(res,409,{error:'Reopen the submitted checklist before changing it'});return true;}if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers)||Object.entries(b.answers).some(([key,value])=>!run.items.some(i=>i.id===key)||typeof value!=='boolean')||typeof b.notes!=='string'||b.notes.length>3000){send(res,422,{error:'Use valid checkbox answers and notes up to 3000 characters'});return true;}
   if(b.action==='submit'&&run.items.some(i=>i.required&&!b.answers[i.id])){send(res,422,{error:'Complete every required item before submitting'});return true;}
   run.answers=b.answers;run.notes=b.notes;if(b.action==='submit'){run.status='Submitted';run.submittedAt=now();run.history.push({action:'Submitted',at:run.submittedAt,user:user.name});}}
  run.revision++;run.updatedAt=now();audit(db,user,'Checklist '+b.action+': '+run.name,{entityType:'checklist',entityId:run.id});write(db);send(res,200,{run:present(run,user)});return true;
 }
 send(res,405,{error:'Unsupported checklist action'});return true;
}
module.exports={normalize,handle,listing,isCurrent,present};
