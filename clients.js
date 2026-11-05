const F=require('./field-access');
function normalize(db){db.clients||=[];}
function options(db,ps){return (ps.viewClients||ps.createCommercial||ps.editProjects&&ps.viewCommercial&&ps.viewRFQEngineering)?db.clients.filter(c=>c.active).map(c=>({id:c.id,name:c.name})):[];}
function link(db,p){const match=db.clients.find(c=>c.active&&c.name.toLowerCase()===String(p.client||'').trim().toLowerCase());if(match){p.clientId=match.id;p.client=match.name}else if(p.clientId&&db.clients.find(c=>c.id===p.clientId)?.name!==p.client)delete p.clientId;}
function summary(db,c,user,ps,WF,safeProject){
 const projects=db.projects.filter(p=>p.clientId===c.id&&(p.type!=='commercial'||ps.viewCommercial)&&(!F.mappedAccess(db,p,user,ps,WF).client||F.mappedAccess(db,p,user,ps,WF).client!=='hidden'));
 const readable=projects.filter(p=>p.type!=='commercial'||p.stage!=='RFQ'||ps.viewRFQEngineering);
 const tasks=db.tasks.filter(t=>readable.some(p=>p.id===t.projectId)&&Number(t.level||3)>=3&&(!t.workflowNodeId||WF.canRead(db,readable.find(p=>p.id===t.projectId),user,ps,t.workflowNodeId)));
 return{...c,projectCount:projects.length,estimatedHours:tasks.reduce((n,t)=>n+Number(t.mhEstimate||0),0),actualHours:tasks.reduce((n,t)=>n+Number(t.mhActual||0),0),projects:projects.map(p=>safeProject(p,ps,db,user))};
}
async function handle(ctx){const{req,res,url,db,user,ps,WF,body,send,audit,write,id,now,safeProject}=ctx;
 if(req.method==='POST'&&/^\/api\/clients\/[^/]+\/link-project$/.test(url.pathname)){
  if(!ps.viewClients||!ps.manageClients||!ps.editProjects){send(res,403,{error:'Client management and project editing permissions required'});return true;}
  const b=await body(req),c=db.clients.find(c=>c.id===url.pathname.split('/')[3]&&c.active),p=db.projects.find(p=>p.id===b.projectId);if(!c||!p||p.type==='commercial'&&(!ps.viewCommercial||p.stage==='RFQ'&&!ps.viewRFQEngineering)){send(res,404,{error:'Client or accessible project not found'});return true;}
  if(p.clientId||String(p.client||'').toLowerCase()!==c.name.toLowerCase()||['hidden','view'].includes(F.mappedAccess(db,p,user,ps,WF).client)){send(res,409,{error:'Choose an unlinked project with a matching editable client field'});return true;}
  p.clientId=c.id;audit(db,user,'Linked existing project to client profile',{entityType:'project',entityId:p.id,projectId:p.id});write(db);send(res,200,{ok:true});return true;
 }
 if(!/^\/api\/clients(?:\/[^/]+)?$/.test(url.pathname))return false;
 if(!ps.viewClients){send(res,403,{error:'View Client Profiles permission required'});return true;}
 const cid=url.pathname.split('/')[3],client=cid&&db.clients.find(c=>c.id===cid);
 if(cid&&!client){send(res,404,{error:'Client not found'});return true;}
 if(req.method==='GET'){send(res,200,{clients:(client?[client]:db.clients).map(c=>summary(db,c,user,ps,WF,safeProject)),canManage:!!ps.manageClients,unlinkedProjects:db.projects.filter(p=>!p.clientId&&p.client&&p.type==='commercial'&&ps.viewCommercial&&F.mappedAccess(db,p,user,ps,WF).client!=='hidden').map(p=>({id:p.id,wbs:p.wbs,client:p.client}))});return true;}
 if(!ps.manageClients){send(res,403,{error:'Manage Client Profiles permission required'});return true;}
 if(!['POST','PATCH'].includes(req.method)||req.method==='POST'&&cid||req.method==='PATCH'&&!cid){send(res,405,{error:'Unsupported client action'});return true;}
 const b=await body(req);if(b.name!==undefined&&typeof b.name!=='string'){send(res,422,{error:'Client name must be text'});return true;}const name=String(b.name??client?.name??'').trim();if(!name||name.length>160){send(res,422,{error:'Client name must be 1–160 characters'});return true;}
 if(db.clients.some(c=>c.id!==cid&&c.name.toLowerCase()===name.toLowerCase())){send(res,409,{error:'A client with that name already exists'});return true;}
 if(b.active!==undefined&&typeof b.active!=='boolean'){send(res,422,{error:'Client active must be true or false'});return true;}
 const fields=['contact','email','phone','address','notes'];for(const k of fields)if(b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>2000)){send(res,422,{error:'Client details must be text up to 2000 characters'});return true;}
 if(b.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)){send(res,422,{error:'Enter a valid email address'});return true;}
 const target=client||{id:id('client'),active:true,createdAt:now(),createdBy:user.id};if(client&&b.expectedRevision!==client.revision){send(res,409,{error:'Client changed. Reload before saving.'});return true;}
 // Stable client ID keeps historical project links intact when contact details or names change.
 Object.assign(target,{name,...Object.fromEntries(fields.filter(k=>b[k]!==undefined).map(k=>[k,b[k].trim()])),...(b.active!==undefined?{active:b.active}:{}),revision:(target.revision||0)+1,updatedAt:now()});if(!client)db.clients.push(target);
 audit(db,user,(client?'Updated':'Created')+' client profile '+name,{entityType:'client',entityId:target.id});write(db);send(res,client?200:201,{client:summary(db,target,user,ps,WF,safeProject)});return true;
}
module.exports={normalize,options,link,handle};
