const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');
test('workflow planning, dated capacity and append-only time logging',async()=>{
 const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-hours-')),port=53000+Math.floor(Math.random()*1000);
 fs.copyFileSync(path.join(root,'data/seed.json'),path.join(data,'seed.json'));
 const server=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,PORT:String(port),ETS_DATA_DIR:data},stdio:'ignore'});
 try{
  for(let i=0;i<70;i++){try{await fetch(`http://127.0.0.1:${port}/`);break}catch{await new Promise(r=>setTimeout(r,100))}}
  const login=await fetch(`http://127.0.0.1:${port}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'Stephan',id:'123',password:'Testing'})});const cookie=login.headers.get('set-cookie').split(';')[0];
  const call=async(route,method='GET',body)=>{const res=await fetch(`http://127.0.0.1:${port}/api${route}`,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()}};
  const commercial=await call('/projects','POST',{type:'commercial',workflowId:'commercial-tracker',title:'Commercial template QA'});assert.equal(commercial.status,201,JSON.stringify(commercial));assert.equal(commercial.data.project.status,'Not Started');
  assert.equal((await call('/projects/'+commercial.data.project.id,'PATCH',{status:'Completed'})).status,409);
  assert.equal((await call('/projects','POST',{type:'internal_eer',workflowId:'commercial-tracker',title:'Wrong type'})).status,422);
  const created=await call('/projects','POST',{type:'internal_eer',workflowId:'eer',title:'Resource QA'});assert.equal(created.status,201);const pid=created.data.project.id;
  let flow=(await call('/projects/'+pid+'/workflow')).data; const inst=flow.workflow||flow; const nodes=inst.nodes;assert.ok(nodes?.length,JSON.stringify(flow));const pending=nodes.find(n=>n.status==='Pending');assert.ok(pending);
  const made=await call('/tasks','POST',{projectId:pid,title:'Future work',workflowNodeId:pending.id,assignee:'Stephan',mhEstimate:20,startDate:'2026-10-19',dueDate:'2026-10-23'});assert.equal(made.status,201,JSON.stringify(made));const tid=made.data.task.id;
  assert.equal((await call('/tasks/'+tid,'PATCH',{mhEstimate:25})).status,200);
  assert.equal((await call('/tasks/'+tid,'PATCH',{status:'In Progress'})).status,403);
  assert.equal((await call('/tasks/'+tid+'/time-entries','POST',{entryId:'pending-123',date:'2026-10-20',hours:1,description:'Blocked'})).status,403);
  const cap=(await call('/capacity?start=2026-10-19&days=7')).data;const row=cap.rows.find(r=>r.user==='Stephan');for(const c of row.cells.filter(c=>c.date<='2026-10-23'))assert.equal(c.allocations.find(a=>a.taskId===tid)?.hours,5);
  assert.equal((await call('/tasks/'+tid,'PATCH',{plannedAllocations:{'2026-10-19':10}})).status,422);
  assert.equal((await call('/tasks/'+tid,'PATCH',{plannedAllocations:{'2026-10-18':25}})).status,422);
  assert.equal((await call('/tasks/'+tid,'PATCH',{plannedAllocations:{'2026-10-19':10,'2026-10-20':15}})).status,200);
  const adjusted=(await call('/capacity?start=2026-10-19&days=7')).data.rows.find(r=>r.user==='Stephan');assert.equal(adjusted.cells[0].allocations.find(a=>a.taskId===tid).hours,10);assert.equal(adjusted.cells[1].allocations.find(a=>a.taskId===tid).hours,15);
  const worker='Hours worker';
  assert.equal((await call('/admin/users','POST',{name:worker,username:worker,userId:'hours-worker',password:'Testing',profileId:'prof-tse'})).status,201);
  assert.equal((await call('/tasks/'+tid,'PATCH',{assignee:worker})).status,200);
  const workerLogin=await fetch(`http://127.0.0.1:${port}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:worker,id:'hours-worker',password:'Testing'})});assert.equal(workerLogin.status,200);
  const restricted=await fetch(`http://127.0.0.1:${port}/api/tasks/${tid}`,{method:'PATCH',headers:{Cookie:workerLogin.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'},body:JSON.stringify({plannedAllocations:{'2026-10-19':10,'2026-10-20':15}})});assert.equal(restricted.status,403);
  const active=nodes.find(n=>n.status==='In progress');const work=await call('/tasks','POST',{projectId:pid,title:'Active work',workflowNodeId:active.id,assignee:'Stephan',mhEstimate:3,mhActual:1});assert.equal(work.status,201);const id=work.data.task.id;
  const entry={entryId:'time-entry-123',date:'2026-10-20',hours:2,description:'Prepared technical details'};
  let logged=await call('/tasks/'+id+'/time-entries','POST',entry);assert.equal(logged.status,201,JSON.stringify(logged));assert.equal(logged.data.task.mhActual,3);assert.equal(logged.data.task.actualOpeningBalance,1);
  logged=await call('/tasks/'+id+'/time-entries','POST',entry);assert.equal(logged.status,200);assert.equal(logged.data.task.mhActual,3);assert.equal(logged.data.task.timeEntries.length,1);
  assert.equal((await call('/tasks/'+id,'PATCH',{mhActual:0})).status,409);
  assert.equal((await call('/tasks/'+id+'/time-entries','POST',{...entry,entryId:'time-entry-456',hours:1})).status,422);
  logged=await call('/tasks/'+id+'/time-entries','POST',{...entry,entryId:'time-entry-456',hours:1,overrunReason:'Additional review'});assert.equal(logged.status,201);assert.equal(logged.data.task.mhActual,4);assert.equal(logged.data.task.flag,'Escalation');
  assert.equal((await call('/tasks/'+id+'/time-entries','POST',{...entry,entryId:'time-entry-789',date:'3001-01-01'})).status,422);
  flow=(await call('/projects/'+pid+'/workflow')).data;assert.equal((flow.workflow||flow).nodes.find(n=>n.id===active.id).hours.actual,4);
 }finally{server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(data,{recursive:true,force:true})}
});
