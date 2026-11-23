const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {backendPort,stopBackend}=require('./backend-lifecycle.cjs');
const {clearProjects,clearDemoHistory}=require('../demo-maintenance');
const records=['projects','tasks','comments','escalations','projectLinks','capacityWarnings','importHistory','objectAttachments','notifications','audit','feedback','checklistRuns','leave'];
test('clean demo handover clears activity and numbering while preserving configuration and identity',()=>{
 const db=Object.fromEntries(records.map(key=>[key,[{id:key+'-test'}]]));
 Object.assign(db,{users:[{id:'u',passwordHash:'preserved-hash',active:false}],profiles:[{id:'custom-role'}],clients:[{id:'client',contacts:[{id:'contact'}]}],settings:{custom:'keep'},workflowConfig:{workflows:[{id:'configured'}]},checklistTemplates:[{id:'template'}],maintenance:{sysadmin1309Setup:{at:'keep'}},checklistDefaultsCreated:true,checklistAccessPolicyVersion:1,projectWorkflows:{p:{revision:9}},projectSequences:{commercial:99,internal_eer:80}});
 const before=structuredClone(db),legacy=structuredClone(db);clearProjects(legacy);
 for(const key of ['audit','feedback','checklistRuns','leave','projectSequences'])assert.deepEqual(legacy[key],before[key],'Project-only cleanup retains '+key);
 clearDemoHistory(db);
 for(const key of records)assert.deepEqual(db[key],[],key+' must be empty');
 assert.deepEqual(db.projectWorkflows,{});assert.deepEqual(db.projectSequences,{});
 for(const key of Object.keys(before).filter(key=>!records.includes(key)&&!['projectWorkflows','projectSequences'].includes(key)))assert.deepEqual(db[key],before[key],key+' must be preserved');
 const once=structuredClone(db);clearDemoHistory(db);assert.deepEqual(db,once,'Cleanup is idempotent');
});
test('local handover refuses unsafe targets, makes an exact backup and restarts with empty registers and valid accounts',async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-handover-')),file=path.join(dir,'db.json');
 fs.copyFileSync(path.join(root,'data/seed.json'),path.join(dir,'seed.json'));
 let child,port;
 const start=async()=>{child=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,ETS_DATA_DIR:dir,PORT:'0'},stdio:'pipe'});port=await backendPort(child)};
 const run=(args=[],extra={})=>spawnSync(process.execPath,[path.join(root,'scripts/clear-demo-projects.cjs'),...args],{cwd:root,env:{...process.env,ETS_DATA_DIR:dir,PORT:String(port),...extra},encoding:'utf8'});
 const call=async(cookie,route,method='GET',body)=>{const res=await fetch('http://127.0.0.1:'+port+'/api'+route,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}};
 const login=async()=>(await call('','/login','POST',{user:'Stephan',id:'123',password:'Testing'}));
 const args=['--confirm-clear-projects','--include-history'];
 try{
  await start();let auth=await login();assert.equal(auth.status,200);
  const made=await call(auth.cookie,'/projects','POST',{type:'internal_eer',workflowId:'eer',title:'Demo project to remove'});assert.equal(made.status,201);
  const live=fs.readFileSync(file);const blocked=run(args);assert.notEqual(blocked.status,0);assert.match(blocked.stderr,/Stop the backend/);assert.deepEqual(fs.readFileSync(file),live);
  await stopBackend(child);
  const db=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const key of records.filter(key=>!['projects','audit'].includes(key)))db[key]=[{id:'old-'+key}];
  db.clients=[{id:'client-keep',name:'Retained client',active:true,contacts:[{id:'contact-keep',name:'Retained contact',active:true}]}];
  db.settings.customHandoverSetting='keep';db.maintenance={sysadmin1309Setup:{at:'keep-setup-marker'}};db.projectSequences={commercial:55,internal_eer:40};
  const original=JSON.stringify(db,null,2);fs.writeFileSync(file,original);
  for(const [flags,extra]of [[['--include-history'],{}],[args,{NODE_ENV:'production'}],[args,{DATABASE_URL:'postgresql://synthetic/blocked'}],[args,{DATABASE_URL_FILE:'/synthetic/secret-file'}]]){
   const result=run(flags,extra);assert.notEqual(result.status,0);assert.equal(fs.readFileSync(file,'utf8'),original);
  }
  assert.equal(fs.readdirSync(dir).filter(name=>name.includes('.before-project-clear-')).length,0,'Rejected operations cannot create a misleading backup');
  const result=run(args);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/history cleared/);
  const backups=fs.readdirSync(dir).filter(name=>name.startsWith('db.json.before-project-clear-'));assert.equal(backups.length,1);
  assert.equal(fs.readFileSync(path.join(dir,backups[0]),'utf8'),original,'Backup must match every original byte');
  if(process.platform!=='win32')assert.equal(fs.statSync(path.join(dir,backups[0])).mode&0o077,0);
  const after=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const key of records)assert.deepEqual(after[key],[],key);
  for(const key of ['users','profiles','clients','workflowConfig','settings','checklistTemplates','maintenance','checklistDefaultsCreated','checklistAccessPolicyVersion'])assert.deepEqual(after[key],db[key],key);
  assert.deepEqual(after.projectWorkflows,{});assert.deepEqual(after.projectSequences,{});
  await start();auth=await login();assert.equal(auth.status,200,'Existing credentials still work');
  const boot=(await call(auth.cookie,'/bootstrap')).data;
  for(const key of ['projects','tasks','audit','notifications','comments','escalations','leave'])assert.deepEqual(boot[key],[],key+' remains empty after restart');
  assert.deepEqual(boot.workflowSummaries,{});assert.deepEqual((await call(auth.cookie,'/feedback')).data.feedback,[]);
  const checklists=(await call(auth.cookie,'/checklists?scope=history')).data;assert.deepEqual(checklists.history,[]);
  for(const[type,workflowId,wbs]of [['commercial','commercial','1'],['internal_eer','eer','EER-001']]){
   const created=await call(auth.cookie,'/projects','POST',{type,workflowId,title:'New '+type});assert.equal(created.status,201);assert.equal(created.data.project.wbs,wbs);
  }
 }finally{await stopBackend(child);fs.rmSync(dir,{recursive:true,force:true})}
});
