const {workToday}=require('./work-date');
async function handleTimeCorrections(ctx){
 const {req,res,url,db,user,ps,WF,body,send,project,canReadTask,safeTask,audit,write,id,now,notify}=ctx;
 const match=url.pathname.match(/^\/api\/tasks\/([^/]+)\/time-entries\/([^/]+)$/);
 if(!match)return false;
 if(req.method!=='PATCH'){send(res,405,{error:'Use PATCH to correct a time entry'});return true;}
 const task=db.tasks.find(t=>t.id===decodeURIComponent(match[1])),p=task&&project(db,task.projectId),entry=task?.timeEntries?.find(e=>e.id===decodeURIComponent(match[2]));
 if(!entry||!canReadTask(task,ps,p,db,user)){send(res,404,{error:'Time entry not found or access restricted'});return true;}
 const lead=ps.assignTasks&&[p.managerId,p.supervisorId].includes(user.id);
 if(!ps.updateActualMH||(entry.userId!==user.id&&!lead&&user.profileId!=='prof-admin')){send(res,403,{error:'Only the entry author, assigned project lead or System Administrator can correct time'});return true;}
 if(['Completed','Lost/Cancelled','Not Required','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(task.status)||!WF.canUpdateTask(db,p,user,ps,task)){send(res,403,{error:'Reopen completed work or wait for workflow prerequisites before correcting time'});return true;}
 const b=await body(req);let today;try{today=workToday(b.timeZone||'UTC')}catch(e){send(res,422,{error:e.message});return true;}const reason=String(b.reason||'').trim(),description=String(b.description||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||b.date<'1900-01-01'||b.date>'2100-12-31'||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date||b.date>today||typeof b.hours!=='number'||!Number.isFinite(b.hours)||b.hours<0||b.hours>24||!description||description.length>2000||!reason||reason.length>2000){send(res,422,{error:'Enter a valid work date up to today, 0–24 hours, a description and a correction reason (maximum 2000 characters each)'});return true;}
 if(!/^[a-zA-Z0-9-]{8,100}$/.test(b.correctionId||'')){send(res,422,{error:'A unique correction reference is required'});return true;}
 const to={date:b.date,hours:b.hours,description},previous=entry.corrections?.find(c=>c.id===b.correctionId);
 if(previous){send(res,JSON.stringify(previous.to)===JSON.stringify(to)&&previous.reason===reason?200:409,{ok:true,task:safeTask(task,ps,p),...(JSON.stringify(previous.to)!==JSON.stringify(to)||previous.reason!==reason?{error:'Correction reference has already been used'}:{})});return true;}
 if(b.expectedRevision!==(entry.revision||1)){send(res,409,{error:'This entry changed. Refresh and review it before correcting.'});return true;}
 const from={date:entry.date,hours:entry.hours,description:entry.description};
 if(JSON.stringify(from)===JSON.stringify(to)){send(res,422,{error:'Change the date, hours or description before saving a correction'});return true;}
 const daily=db.tasks.flatMap(t=>t.timeEntries||[]).filter(e=>e!==entry&&e.userId===entry.userId&&e.date===b.date).reduce((sum,e)=>sum+e.hours,0);
 if(daily+b.hours>24){send(res,422,{error:'Daily logged time across tasks cannot exceed 24 hours'});return true;}
 const actual=Math.round(((task.actualOpeningBalance||0)+task.timeEntries.reduce((n,e)=>n+(e===entry?b.hours:e.hours),0))*10000)/10000;
 const correction={id:b.correctionId,from,to,reason,user:user.name,userId:user.id,at:now()};
 (entry.corrections||=[]).push(correction);Object.assign(entry,to,{revision:(entry.revision||1)+1});task.mhActual=actual;
 if(actual>Number(task.mhEstimate||0)){task.flag='Escalation';task.flagReason=reason;db.escalations.unshift({id:id('e'),taskId:task.id,projectId:p.id,type:task.flag,reason,user:user.name,ts:now()});}
 if(task.workflowNodeId)db.projectWorkflows[p.id].revision++;
 audit(db,user,`Corrected time on ${task.wbs}: ${from.hours} → ${to.hours} h`,{entityType:'task',entityId:task.id,projectId:p.id,workflowNodeId:task.workflowNodeId,changes:[{field:'timeEntry',from,to}],comment:reason});
 if(entry.userId!==user.id)notify(db,`Time entry corrected on ${task.wbs} by ${user.name}`,[entry.user]);write(db);send(res,200,{ok:true,task:safeTask(task,ps,p)});return true;
}
module.exports={handleTimeCorrections};
