const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
test('final project sign-off requires named approver, completed work, revision and comment; reopening withdraws it',async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-signoff-')),port=57000+Math.floor(Math.random()*300);fs.copyFileSync(path.join(root,'data/seed.json'),path.join(dir,'seed.json'));const server=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,PORT:String(port),ETS_DATA_DIR:dir},stdio:'ignore'});
 try{for(let n=0;n<70;n++){try{await fetch(`http://127.0.0.1:${port}/`);break}catch{await new Promise(r=>setTimeout(r,100))}}
 const call=async(cookie,url,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}/api${url}`,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 const admin=(await call('','/login','POST',{user:'Stephan',id:'123',password:'Testing'})).cookie,boot=(await call(admin,'/bootstrap')).data;
 const {config}=(await call(admin,'/workflow-config')).data;config.workflows.push({id:'closure-test',name:'Closure',stages:['Overview'],objects:[],nodes:[{id:'overview',name:'Overview',type:'stage',parent:'',completion:'manual',permissions:{},fields:[]}]});assert.equal((await call(admin,'/workflow-config','PUT',{config})).status,200);
 assert.equal((await call(admin,'/projects','POST',{type:'internal_eer',workflowId:'closure-test',title:'Bypass',status:'Completed'})).status,422);
 const p=(await call(admin,'/projects','POST',{type:'internal_eer',workflowId:'closure-test',title:'Sign-off test'})).data.project;
 assert.equal((await call(admin,'/projects/'+p.id+'/signoff','POST',{comment:'Too soon'})).status,409);
 let flow=(await call(admin,'/projects/'+p.id+'/workflow')).data.workflow;
 assert.equal((await call(admin,'/projects/'+p.id+'/workflow/nodes/overview','PATCH',{action:'signoff',comment:'Parent reviewed',expectedRevision:flow.revision})).status,200);
 flow=(await call(admin,'/projects/'+p.id+'/workflow')).data.workflow;
 assert.equal((await call(admin,'/projects/'+p.id,'PATCH',{status:'Completed'})).status,422,'Status editing cannot bypass final sign-off');
 assert.equal((await call(admin,'/projects/'+p.id+'/signoff','POST',{expectedRevision:flow.revision-1,comment:'Stale'})).status,409);
 assert.equal((await call(admin,'/projects/'+p.id+'/signoff','POST',{expectedRevision:flow.revision})).status,422);
 // A non-resource system administrator cannot approve merely because of system access.
 await call(admin,'/admin/users','POST',{name:'Closure system',username:'closure-system',userId:'closure-system',password:'Testing',profileId:'prof-admin',resourceEnabled:false});const system=(await call('','/login','POST',{user:'closure-system',id:'closure-system',password:'Testing'})).cookie;
 assert.equal((await call(system,'/projects/'+p.id+'/signoff','POST',{expectedRevision:flow.revision,comment:'Unassigned'})).status,403);
 assert.equal((await call(admin,'/projects/'+p.id+'/signoff','POST',{expectedRevision:flow.revision,comment:'Delivery accepted'})).status,200);
 let record=(await call(admin,'/bootstrap')).data.projects.find(x=>x.id===p.id);assert.equal(record.status,'Completed');assert.equal(record.signedOffBy,'Stephan');assert.equal(record.signoffComment,'Delivery accepted');assert.ok(record.signedOffAt);
 assert.equal((await call(admin,'/projects/'+p.id+'/signoff','POST',{expectedRevision:flow.revision,comment:'Duplicate'})).status,409);
 assert.equal((await call(admin,'/projects/'+p.id+'/workflow/nodes/overview','PATCH',{action:'reopen',comment:'Follow-up work',expectedRevision:flow.revision})).status,200);
 record=(await call(admin,'/bootstrap')).data.projects.find(x=>x.id===p.id);assert.equal(record.status,'In Progress');assert.equal(record.signedOffBy,undefined);
 const c=(await call(admin,'/register-config')).data.config;assert.deepEqual(c.projectTypeOrder,['all','commercial','eer']);assert.equal((await call(admin,'/register-config','PUT',{...c,projectTypeOrder:['all','all','eer']})).status,422);assert.equal((await call(admin,'/register-config','PUT',{...c,projectTypeOrder:['eer','all','commercial']})).status,200);assert.deepEqual((await call(admin,'/register-config')).data.config.projectTypeOrder,['eer','all','commercial']);
 }finally{if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}fs.rmSync(dir,{recursive:true,force:true})}
});
