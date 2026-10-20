const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('isolated API smoke test: authentication, permissions, project and task lifecycle',async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'ets-ipm-qa-'));
 fs.copyFileSync(path.join(ROOT,'data','seed.json'),path.join(data,'seed.json'));
 const port=51000+Math.floor(Math.random()*1000);
 const base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,[path.join(ROOT,'server.js')],{env:{...process.env,PORT:String(port),ETS_DATA_DIR:data},stdio:'pipe'});
 let log='';server.stderr.on('data',b=>log+=String(b));
 try{
  let ready=false;
  for(let n=0;n<70;n++){if(server.exitCode!==null)break;try{await fetch(base+'/');ready=true;break}catch{await wait(100)}}
  assert.ok(ready,'Server did not start: '+log);
  const unauth=await fetch(base+'/api/bootstrap');assert.equal(unauth.status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'Stephan',id:'123',password:'Testing'})});
  assert.equal(login.status,200,'Seed administrator login failed');
  const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'No session cookie');
  const call=async(route,method='GET',body)=>{const r=await fetch(base+'/api'+route,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
  assert.equal((await call('/missing-route')).status,404);assert.equal((await call('/workflow-templates')).data.protocolVersion,2);assert.equal((await call('/projects','POST',{title:'No workflow',type:'internal_eer'})).status,422);
  let b=await call('/bootstrap');assert.equal(b.status,200);assert.equal(b.data.permissions.manageUsers,true);
  assert.ok(Array.isArray(b.data.projects));
  const users=await call('/admin/users');assert.equal(users.status,200);assert.ok(users.data.users.length>0);
  const created=await call('/projects','POST',{workflowId:'eer',type:'internal_eer',title:'QA isolated project'});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const projectId=created.data.project?.id;assert.ok(projectId);
  const task=await call('/tasks','POST',{projectId,title:'QA isolated task',mhEstimate:3});
  assert.equal(task.status,201,JSON.stringify(task.data));
  const taskId=task.data.task?.id;assert.ok(taskId);
  const invalid=await call('/tasks/'+taskId,'PATCH',{mhActual:5});
  assert.equal(invalid.status,422,'MH overrun must require escalation reason');
  const flagged=await call('/tasks/'+taskId,'PATCH',{mhActual:5,flag:'Escalation',flagReason:'QA overrun'});
  assert.equal(flagged.status,200);
  b=await call('/bootstrap');
  assert.ok(b.data.tasks.some(t=>t.id===taskId&&t.flag==='Escalation'));
  assert.ok(b.data.audit.some(a=>a.text?.includes('Updated task')));
  const exported=await fetch(base+'/api/export.csv',{headers:{Cookie:cookie}});assert.equal(exported.status,200);
  assert.match(await exported.text(),/QA isolated task/);
  const deleted=await call('/projects/'+projectId,'DELETE');assert.equal(deleted.status,200);
  b=await call('/bootstrap');assert.ok(!b.data.projects.some(p=>p.id===projectId));
 }finally{server.kill();fs.rmSync(data,{recursive:true,force:true})}
});

