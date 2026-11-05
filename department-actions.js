const canonical=name=>{const s=String(name||'').trim().toLowerCase().replace(/\s+/g,' '),key=s.replace(/[^a-z]/g,'');return ['mi','methodindustrialization','methodsindustrialization','methodandindustrialization','methodsandindustrialization'].includes(key)?'method-industrialization':['ps','projectssupport','projectsandsupport'].includes(key)?'projects-support':s};
async function handleDepartmentRemoval(ctx){
 const {req,res,url,db,user,ps,WF,body,send,project,canReadTask,audit,write}=ctx;
 const match=url.pathname.match(/^\/api\/work-packages\/([^/]+)$/);if(!match)return false;
 if(req.method!=='DELETE'){send(res,405,{error:'Use DELETE to remove a department'});return true;}
 if(!ps.createTasks||!ps.assignTasks){send(res,403,{error:'Task creation and assignment permissions required'});return true;}
 const dept=db.tasks.find(t=>t.id===decodeURIComponent(match[1])&&Number(t.level)===2),p=dept&&project(db,dept.projectId);
 if(!dept||!canReadTask(dept,ps,p,db,user)){send(res,404,{error:'Department not found or access restricted'});return true;}
 const children=db.tasks.filter(t=>t.projectId===p.id&&String(t.wbs).startsWith(dept.wbs+'.'));
 const b=await body(req),target=b.moveToId&&db.tasks.find(t=>t.id===b.moveToId&&t.projectId===p.id&&Number(t.level)===2&&t.id!==dept.id);
 if(children.length&&!Object.hasOwn(b,'moveToId')){send(res,409,{error:'Choose where to move the department tasks before removing it'});return true;}
 if(b.moveToId&&(!target||!canReadTask(target,ps,p,db,user))){send(res,422,{error:'Choose an accessible department in this project'});return true;}
 if(children.some(t=>!canReadTask(t,ps,p,db,user)||!WF.canPlanTask(db,p,user,ps,t))){send(res,403,{error:'All department tasks must be visible and unlocked for planning before moving them'});return true;}
 const destination=target?.wbs||p.wbs,moved=new Map(),roots=children.filter(t=>t.parentWbs===dept.wbs),used=new Set(db.tasks.filter(t=>t.projectId===p.id&&!children.includes(t)).map(t=>t.wbs));
 let next=1;for(const root of roots){while(used.has(destination+'.'+next))next++;const wbs=destination+'.'+next++;used.add(wbs);for(const t of children.filter(t=>t.wbs===root.wbs||t.wbs.startsWith(root.wbs+'.')))moved.set(t.wbs,wbs+t.wbs.slice(root.wbs.length));}
 if(moved.size!==children.length){send(res,409,{error:'Department hierarchy needs repair before it can be removed'});return true;}
 const revisions=new Set();for(const t of children){const old=t.wbs;t.wbs=moved.get(old);t.parentWbs=t.parentWbs===dept.wbs?destination:moved.get(t.parentWbs)||t.parentWbs;t.department=target?.title||'';if(t.workflowNodeId)revisions.add(t.projectId);}
 for(const t of db.tasks.filter(t=>t.projectId===p.id))if(moved.has(t.dependency))t.dependency=moved.get(t.dependency);
 db.tasks=db.tasks.filter(t=>t.id!==dept.id);db.comments=db.comments.filter(c=>c.taskId!==dept.id);db.escalations=db.escalations.filter(e=>e.taskId!==dept.id);
 for(const pid of revisions)if(db.projectWorkflows[pid])db.projectWorkflows[pid].revision++;
 audit(db,user,`Removed department ${dept.title}; preserved and moved ${children.length} task records`,{entityType:'task',entityId:dept.id,projectId:p.id});write(db);send(res,200,{ok:true,moved:children.length});return true;
}
module.exports={handleDepartmentRemoval,canonical};
