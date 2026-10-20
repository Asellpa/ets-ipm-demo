const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');const {once}=require('node:events');
const ROOT=path.resolve(__dirname,'..');
test('FRD permissions, ownership, notifications, capacity, workflow, export and persistence',async()=>{
 const working=path.join(ROOT,'data/db.json');const original=fs.existsSync(working)?fs.readFileSync(working):null;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ets-frd-'));fs.copyFileSync(path.join(ROOT,'data/seed.json'),path.join(dir,'seed.json'));const port=53000+Math.floor(Math.random()*1000);let server;
 const start=async()=>{server=spawn(process.execPath,[path.join(ROOT,'server.js')],{env:{...process.env,PORT:String(port),ETS_DATA_DIR:dir,TZ:'Asia/Colombo'},stdio:'pipe'});for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}/`);return}catch{await new Promise(r=>setTimeout(r,50))}}throw Error('Server failed to start')};
 const call=async(cookie,route,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}/api${route}`,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 const login=async(name,id)=>{const r=await call('','/login','POST',{user:name,id,password:'Testing'});assert.equal(r.status,200);return r.cookie};
 try{await start();let admin=await login('Stephan','123');
 const tzCapacity=await call(admin,'/capacity?start=2026-10-19&days=7');assert.equal(tzCapacity.data.rows[0].cells[0].date,'2026-10-19');assert.equal(tzCapacity.data.rows[0].cells[6].date,'2026-10-25');

 for(const permissions of [{manageRoles:'false'},{manageUsers:1},{unknownPermission:true},[],null]){
  assert.equal((await call(admin,'/admin/profiles','POST',{name:'Invalid profile',permissions})).status,400);
  assert.equal((await call(admin,'/admin/profiles/prof-senior','PATCH',{permissions})).status,400);
 }
 const custom=await call(admin,'/admin/profiles','POST',{name:'Permission validation',permissions:{manageRoles:false,viewReports:true}});assert.equal(custom.status,201);
 let profiles=(await call(admin,'/admin/profiles')).data.profiles;assert.equal(profiles.find(p=>p.id===custom.data.id).permissions.manageRoles,false);
 assert.equal((await call(admin,'/admin/profiles/prof-admin','PATCH',{permissions:{manageRoles:false}})).status,400);
 assert.equal((await call(admin,'/admin/profiles/'+custom.data.id,'DELETE')).status,200);

 for(const [name,profileId] of [['Lead','prof-ltse'],['Engineer','prof-tse'],['Other','prof-tse'],['Manager','prof-senior']]){const r=await call(admin,'/admin/users','POST',{name,username:name,userId:name,password:'Testing',profileId});assert.equal(r.status,201,JSON.stringify(r.data))}
 const lead=await login('Lead','Lead'),engineer=await login('Engineer','Engineer'),other=await login('Other','Other'),manager=await login('Manager','Manager');
 const feedback=await call(engineer,'/feedback','POST',{type:'Bug',description:'Feedback persistence regression',expected:'Useful saved feedback',page:'Overview',screenshot:{mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ioAAAAASUVORK5CYII='}});assert.equal(feedback.status,201);const feedbackId=feedback.data.id;
 assert.equal((await call(engineer,'/feedback')).data.feedback.length,1);assert.equal((await call(other,'/feedback')).data.feedback.length,0);assert.equal((await call(other,'/feedback/'+feedbackId+'/screenshot')).status,404);
 assert.equal((await call(engineer,'/feedback/'+feedbackId,'PATCH',{status:'Resolved'})).status,403);
 assert.equal((await call(admin,'/feedback/'+feedbackId,'PATCH',{status:'Fake'})).status,422);assert.equal((await call(admin,'/feedback/'+feedbackId,'PATCH',{description:'tamper'})).status,422);
 assert.equal((await call(admin,'/feedback/'+feedbackId,'PATCH',{status:'In progress',adminNote:'Reviewing this issue'})).status,200);const ownFeedback=(await call(engineer,'/feedback')).data.feedback[0];assert.equal(ownFeedback.status,'In progress');assert.equal(ownFeedback.adminNote,'Reviewing this issue');assert.equal(ownFeedback.screenshot,undefined);assert.equal(ownFeedback.hasScreenshot,true);assert.equal(ownFeedback.createdById,(await call(admin,'/admin/users')).data.users.find(u=>u.name==='Engineer').id);
 assert.equal((await call(engineer,'/feedback','POST',{type:'Other',description:'Invalid feedback type'})).status,422);assert.equal((await call(engineer,'/feedback','POST',{type:'Bug',description:'Valid text',screenshot:{mime:'image/png',data:'PHNjcmlwdD4='}})).status,422);
 for(const dates of [{startDate:'3001-02-03'},{startDate:'2026-10-20',edd:'2026-10-19'},{startDate:'2026-02-30'}])assert.equal((await call(admin,'/projects','POST',{title:'Invalid dates',type:'internal_eer',...dates})).status,422);
 assert.equal((await call(admin,'/import','POST',{rows:[{WBS:'INVALID-DATE',Level:1,'Start Date':'3001-01-01'}]})).status,422);
 const project=await call(admin,'/projects','POST',{title:'FRD RFQ',type:'commercial',rom:'SECRET_PRICE',stage:'RFQ'});const pid=project.data.project.id;
 assert.equal((await call(admin,'/projects/'+pid,'PATCH',{startDate:'3001-01-01'})).status,422);
 for(const route of ['/tasks','/work-packages'])for(const dates of [{startDate:'3001-01-01'},{startDate:'2026-10-20',dueDate:'2026-10-19'}])assert.equal((await call(admin,route,'POST',{projectId:pid,title:'Invalid schedule',...dates})).status,422);
 assert.equal((await call(engineer,'/projects','POST',{title:'Forbidden',type:'commercial'})).status,403);
 assert.equal((await call(lead,'/projects/'+pid,'PATCH',{rom:'tamper'})).status,403);
 const t=await call(lead,'/tasks','POST',{projectId:pid,title:'RFQ estimate',assignee:'Engineer',mhEstimate:6,startDate:'2026-10-19'});assert.equal(t.status,201,JSON.stringify(t.data));const tid=t.data.task.id;
 assert.equal(t.data.task.status,'Assigned');assert.equal(t.data.task.level,3);
 let eb=(await call(engineer,'/bootstrap')).data;assert.ok(!eb.tasks.some(t=>t.id===tid));assert.ok(!JSON.stringify(eb).includes('SECRET_PRICE'));
 assert.equal((await call(engineer,'/tasks/'+tid,'PATCH',{mhActual:1})).status,403);
 assert.equal((await call(admin,'/projects/'+pid,'PATCH',{stage:'Awarded'})).status,200);
 assert.equal((await call(other,'/tasks/'+tid,'PATCH',{status:'Completed'})).status,403);
 assert.equal((await call(engineer,'/tasks/'+tid,'PATCH',{assignee:'Other'})).status,403);
 assert.equal((await call(engineer,'/tasks/'+tid,'PATCH',{mhActual:-1})).status,422);
 assert.equal((await call(engineer,'/tasks/'+tid,'PATCH',{mhActual:7})).status,422);
 assert.equal((await call(engineer,'/tasks/'+tid,'PATCH',{mhActual:7,flag:'Escalation',flagReason:'Missing client data',status:'In Progress'})).status,200);
 assert.equal((await call(engineer,'/tasks/'+tid+'/comments','POST',{text:'Requested client input'})).status,201);
 eb=(await call(engineer,'/bootstrap')).data;assert.ok(eb.notifications.some(n=>n.text.includes('assigned')));assert.ok(eb.tasks.some(t=>t.id===tid&&t.mhActual===7));
 const mb=(await call(manager,'/bootstrap')).data;assert.ok(mb.escalations.some(e=>e.taskId===tid&&e.reason==='Missing client data'));assert.ok(mb.audit.some(a=>a.entityId===tid&&a.changes?.some(c=>c.field==='mhActual')));
 const eer=await call(engineer,'/projects','POST',{title:'Engineering request',type:'internal_eer'});assert.equal(eer.status,201);assert.ok((await call(lead,'/bootstrap')).data.notifications.some(n=>n.text.includes('New Internal EER')));
 assert.equal((await call(admin,'/projects/'+eer.data.project.id,'PATCH',{startDate:'2026-10-20'})).status,200);
 const beforeImport=(await call(admin,'/bootstrap')).data.projects.length;
 assert.equal((await call(admin,'/import','POST',{rows:[{WBS:'IMPORT-X',Level:1,Project:'Import project'},{WBS:'UNKNOWN.1',Level:3,Details:'Bad parent'}]})).status,422);
 assert.equal((await call(admin,'/bootstrap')).data.projects.length,beforeImport,'Invalid import must not partially write');
 const imported=await call(admin,'/import','POST',{rows:[{WBS:'IMPORT-X',Level:1,Project:'Import project'},{WBS:'IMPORT-X.1',Level:2,Details:'Package'},{WBS:'IMPORT-X.1.1',Level:3,Details:'Task','MH Estimations':'4'}]});assert.equal(imported.status,200);assert.equal(imported.data.projectsAdded,1);assert.equal(imported.data.tasksAdded,2);const importHistory=JSON.parse(fs.readFileSync(path.join(dir,'db.json'),'utf8')).importHistory;const source=importHistory.find(h=>h.id===imported.data.importId);assert.equal(source.sourceRows[2]['MH Estimations'],'4');assert.equal(source.records.length,3);assert.ok(source.records.every(r=>r.entityId));assert.equal((await call(admin,'/bootstrap')).data.importHistory,undefined,'Source data must not leak through bootstrap');
 const concurrent=await Promise.all(['Parallel A','Parallel B'].map(title=>call(admin,'/projects','POST',{title,type:'internal_eer'})));assert.ok(concurrent.every(r=>r.status===201));const afterConcurrent=(await call(admin,'/bootstrap')).data;for(const title of ['Parallel A','Parallel B'])assert.ok(afterConcurrent.projects.some(p=>p.title===title),'Concurrent write lost '+title);
 const wp=await call(admin,'/work-packages','POST',{projectId:pid,title:'Engineering package',assignee:'Engineer',mhEstimate:100,startDate:'2026-10-19'});assert.equal(wp.status,201);
 let cap=(await call(admin,'/capacity?start=2026-10-19&days=7')).data.rows.find(r=>r.user==='Engineer');assert.equal(cap.cells[0].booked,6,'Package totals must not double-count task allocation');assert.equal(cap.cells[5].capacity,0);
 assert.equal((await call(engineer,'/leave','POST',{user:'Engineer',date:'2026-10-19'})).status,403);
 assert.equal((await call(admin,'/leave','POST',{user:'Engineer',date:'bad'})).status,422);
 assert.equal((await call(admin,'/leave','POST',{user:'Engineer',date:'3001-01-01'})).status,422);
 const leave=await call(admin,'/leave','POST',{user:'Engineer',date:'2026-10-19',type:'Training'});assert.equal(leave.status,201);assert.equal((await call(admin,'/leave','POST',{user:'Engineer',date:'2026-10-19'})).status,409);
 cap=(await call(admin,'/capacity?start=2026-10-19&days=7')).data.rows.find(r=>r.user==='Engineer');assert.equal(cap.cells[0].capacity,0);assert.equal(cap.cells[0].free,0);assert.equal(cap.cells[0].leave,'Training');
 assert.equal((await call(admin,'/leave/'+leave.data.id,'DELETE')).status,200);
 const cfg={workflows:[{id:'wf',name:'Test',stages:['Raised'],objects:[],nodes:[{id:'a',name:'Raised',type:'stage',parent:'',completion:'manual',permissions:{LTSE:'view'}}]}],projectTypes:[{id:'internal_eer',name:'Internal',workflowId:'wf'}],register:{},resource:{}};
 assert.equal((await call(admin,'/workflow-config','PUT',{config:cfg})).status,200);assert.equal((await call(lead,'/workflow-config','PUT',{config:cfg})).status,403);
 const savedWorkflow=(await call(admin,'/workflow-config')).data;assert.equal(savedWorkflow.runtimeEnforced,true);assert.ok(savedWorkflow.profiles.some(p=>p.id==='prof-ltse'));assert.equal(savedWorkflow.config.workflows[0].nodes[0].permissions['prof-ltse'],'view');assert.equal(savedWorkflow.config.workflows[0].nodes[0].permissions.LTSE,undefined);
 for(const permissions of [{LTSE:'administrator'},{LTSE:true},{'unknown-profile':'view'},[]]){const bad=structuredClone(cfg);bad.workflows[0].nodes[0].permissions=permissions;assert.equal((await call(admin,'/workflow-config','PUT',{config:bad})).status,400)}
 const role=await call(admin,'/admin/profiles','POST',{name:'Workflow custom',permissions:{}});assert.equal(role.status,201);const withCustom=structuredClone(cfg);withCustom.workflows[0].nodes[0].permissions['Workflow custom']='complete';assert.equal((await call(admin,'/workflow-config','PUT',{config:withCustom})).status,200);
 assert.equal((await call(admin,'/admin/profiles/'+role.data.id,'PATCH',{name:'Renamed workflow role'})).status,200);let customConfig=(await call(admin,'/workflow-config')).data;assert.equal(customConfig.config.workflows[0].nodes[0].permissions[role.data.id],'complete');assert.ok(customConfig.profiles.some(p=>p.name==='Renamed workflow role'));
 assert.equal((await call(admin,'/admin/profiles/'+role.data.id,'DELETE')).status,200);customConfig=(await call(admin,'/workflow-config')).data;assert.equal(customConfig.config.workflows[0].nodes[0].permissions[role.data.id],undefined);
 const cyclic=structuredClone(cfg);cyclic.workflows[0].nodes[0].parent='a';assert.equal((await call(admin,'/workflow-config','PUT',{config:cyclic})).status,400);
 assert.equal((await call(engineer,'/export.json')).status,403);const full=await call(admin,'/export.json');assert.equal(full.status,200);assert.ok(full.data.projects.some(p=>p.id===eer.data.project.id));assert.ok(JSON.stringify(full.data).includes('SECRET_PRICE'));assert.ok(!JSON.stringify(full.data).includes('passwordHash'));
 assert.equal((await call(admin,'/settings','PATCH',{standardHoursPerDay:0})).status,422);
 await new Promise(resolve=>{server.once('exit',resolve);server.kill()});await start();admin=await login('Stephan','123');assert.ok((await call(admin,'/feedback')).data.feedback.some(f=>f.id===feedbackId&&f.status==='In progress'));const persisted=(await call(admin,'/bootstrap')).data;assert.ok(persisted.tasks.some(t=>t.id===tid&&t.mhActual===7));assert.equal((await call(admin,'/workflow-config')).data.config.workflows[0].name,'Test');
 }finally{if(server?.exitCode===null){const exit=once(server,'exit');server.kill();await exit}fs.rmSync(dir,{recursive:true,force:true});assert.deepEqual(fs.existsSync(working)?fs.readFileSync(working):null,original,'Working database must remain untouched')}
});
