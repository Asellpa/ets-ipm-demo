const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {prepareDemo}=require('../demo-maintenance');
test('one-time demo setup, private credential hash, owner validation and Admin privilege boundaries',async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-admin-')),file=path.join(dir,'db.json');
 const db=JSON.parse(fs.readFileSync(path.join(root,'data/seed.json'),'utf8'));
 db.feedback=[{id:'keep-feedback'}];db.leave=[{id:'keep-leave'}];db.projectLinks=[{projectId:'old'}];
 const password=crypto.randomBytes(18).toString('hex');
 assert.equal(prepareDemo(db,password),true);assert.equal(db.projects.length,0);assert.equal(db.tasks.length,0);assert.equal(db.projectLinks.length,0);assert.equal(db.feedback[0].id,'keep-feedback');assert.equal(db.leave[0].id,'keep-leave');
 const sysadmin=db.users.find(u=>u.username==='sysadmin');assert.equal(sysadmin.userId,'1309');assert.equal(sysadmin.profileId,'prof-admin');assert.ok(sysadmin.passwordSalt);assert.ok(!JSON.stringify(db).includes(password));
 db.projects.push({id:'new-after-setup'});assert.equal(prepareDemo(db,'ignored-on-repeat'),false);assert.equal(db.projects.length,1,'Rerunning setup must preserve subsequent projects');db.projects=[];
 fs.writeFileSync(file,JSON.stringify(db));const port=58000+Math.floor(Math.random()*900),server=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,PORT:String(port),ETS_DATA_DIR:dir},stdio:'ignore'});
 try{
  for(let i=0;i<70;i++){try{await fetch(`http://127.0.0.1:${port}/`);break}catch{await new Promise(r=>setTimeout(r,100))}}
  const call=async(cookie,route,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}/api${route}`,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
  const login=await call('','/login','POST',{user:'sysadmin',id:'1309',password});assert.equal(login.status,200);const system=login.cookie,admin=(await call('','/login','POST',{user:'Stephan',id:'123',password:'Testing'})).cookie;assert.ok(admin);
  const bootstrap=(await call(admin,'/bootstrap')).data;assert.equal(bootstrap.permissions.manageUsers,true);assert.equal(bootstrap.permissions.manageRoles,false);assert.equal(bootstrap.projects.length,0);
  const stephan=db.users.find(u=>(u.username||u.name)==='Stephan');
  for(const [route,method,body] of [
   ['/admin/users','POST',{name:'Escalation',username:'evil',userId:'evil',password:'Testing',profileId:'prof-admin'}],
   ['/users','POST',{name:'Escalation',profileId:'prof-admin'}],
   ['/admin/users/'+stephan.id,'PATCH',{profileId:'prof-admin'}],
   ['/admin/users/'+sysadmin.id,'PATCH',{active:false}],
   ['/admin/users/'+sysadmin.id+'/password','POST',{password:'Testing'}],
   ['/admin/users/'+sysadmin.id+'/offboard','POST',{}],
   ['/users/'+sysadmin.id,'PATCH',{active:false}],
   ['/users/'+sysadmin.id,'DELETE'],
   ['/admin/profiles','POST',{name:'Escalation',permissions:{manageRoles:true}}],
   ['/demo/clear-records','POST',{}]
  ])assert.equal((await call(admin,route,method,body)).status,403,route);
  assert.equal((await call(system,'/users/'+sysadmin.id,'PATCH',{active:false})).status,400,'Last System Administrator must remain');
  assert.equal((await call(admin,'/projects','POST',{workflowId:'commercial',type:'commercial',owner:'Nonexistent'})).status,422);
  const created=await call(admin,'/projects','POST',{workflowId:'commercial',type:'commercial',title:'Owner dropdown',owner:'Stephan'});assert.equal(created.status,201);const p=created.data.project;
  assert.equal((await call(admin,'/projects/'+p.id,'PATCH',{owner:'Nonexistent'})).status,422);
  let flow=(await call(admin,'/projects/'+p.id+'/workflow')).data.workflow;
  const owner=flow.nodes.find(n=>n.id==='overview').fields.find(f=>f.projectField==='owner');assert.ok(owner);
  assert.equal((await call(admin,'/projects/'+p.id+'/workflow/nodes/overview','PATCH',{action:'save',expectedRevision:flow.revision,values:{[owner.id]:'Nonexistent'}})).status,422);
  assert.equal((await call(admin,'/projects/'+p.id+'/workflow/nodes/overview','PATCH',{action:'save',expectedRevision:flow.revision,values:{[owner.id]:'Stephan'}})).status,200);
  assert.equal((await call(system,'/demo/clear-records','POST',{})).status,200);assert.equal((await call(system,'/bootstrap')).data.projects.length,0);const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.users.find(u=>u.username==='sysadmin').passwordHash,sysadmin.passwordHash);assert.equal(saved.feedback[0].id,'keep-feedback');assert.equal(saved.leave[0].id,'keep-leave');assert.ok(fs.readdirSync(dir).some(n=>n.startsWith('db.json.backup-')));
 }finally{server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(dir,{recursive:true,force:true})}
});
