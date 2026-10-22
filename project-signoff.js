// Final closure is a separate, audited transition; project field editing cannot bypass it.
function readiness(db,p,user,ps,WF){
 const instance=db.projectWorkflows[p.id];
 if(![p.managerId,p.supervisorId].includes(user.id)||!ps.assignTasks||!ps.editProjects)return {status:403,error:'Only the assigned project manager or supervisor with project editing and assignment permissions can sign off this project'};
 if(!instance)return {status:409,error:'Attach and complete a project workflow before sign-off'};
 if(instance.nodes.filter(n=>!n.parent).some(n=>WF.access(instance,n,p,user,ps)!=='approve'))return {status:403,error:'Approve access is required for every parent object'};
 if(instance.nodes.some(n=>instance.states[n.id].status!=='Completed'))return {status:409,error:'Complete and sign off all workflow objects before signing off the project'};
 if(db.tasks.some(t=>t.projectId===p.id&&Number(t.level||3)>=3&&!['Completed','Not Required','Lost/Cancelled','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(t.status)))return {status:409,error:'Complete or cancel all applicable tasks before signing off the project'};
 return null;
}
async function handle({req,res,url,db,user,ps,WF,body,send,project,canReadTask,audit,write,now}){
 if(req.method!=='POST'||!/^\/api\/projects\/[^/]+\/signoff$/.test(url.pathname))return false;
 const p=project(db,url.pathname.split('/')[3]);if(!p||!canReadTask({},ps,p,db,user)){send(res,404,{error:'Project not found'});return true;}
 const error=readiness(db,p,user,ps,WF);if(error){send(res,error.status,{error:error.error});return true;}
 const b=await body(req),instance=db.projectWorkflows[p.id];
 if(b.expectedRevision!==instance.revision){send(res,409,{error:'Workflow changed. Review the project and retry sign-off.'});return true;}
 if(p.signedOffBy&&p.status==='Completed'){send(res,409,{error:'Project is already signed off'});return true;}
 const comment=String(b.comment||'').trim();if(!comment||comment.length>3000){send(res,422,{error:'Add a project sign-off comment up to 3000 characters'});return true;}
 p.status='Completed';p.signedOffBy=user.name;p.signedOffAt=now();p.signoffComment=comment;
 audit(db,user,'Signed off project '+p.wbs,{entityType:'project',entityId:p.id,projectId:p.id,comment});write(db);send(res,200,{ok:true});return true;
}
function withdrawIfWorkReopened(db){
 for(const p of db.projects||[])if(p.signedOffBy){const instance=db.projectWorkflows?.[p.id],openObjects=instance?.nodes.some(n=>instance.states[n.id]?.status!=='Completed'),openTasks=(db.tasks||[]).some(t=>t.projectId===p.id&&Number(t.level||3)>=3&&!['Completed','Not Required','Lost/Cancelled','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(t.status));if(p.status!=='Completed'||openObjects||openTasks){delete p.signedOffBy;delete p.signedOffAt;delete p.signoffComment;if(p.status==='Completed')p.status='In Progress';}}
}
module.exports={handle,readiness,withdrawIfWorkReopened};
