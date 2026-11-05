const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
test('QA regressions: audit scope, deleted-project classification, WBS uniqueness, status/body validation and request security',async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-fixes-')),port=58000+Math.floor(Math.random()*500);fs.copyFileSync(path.join(root,'data/seed.json'),path.join(dir,'seed.json'));const server=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,PORT:String(port),ETS_DATA_DIR:dir,APP_ORIGINS:'https://approved.example',SESSION_COOKIE_SECURE:'true'},stdio:'ignore'});
 try{for(let i=0;i<70;i++){try{await fetch('http://127.0.0.1:'+port);break}catch{await new Promise(r=>setTimeout(r,100))}}
 const call=async(cookie,route,method='GET',body,headers={})=>{const r=await fetch('http://127.0.0.1:'+port+'/api'+route,{method,headers:{Cookie:cookie||'','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie'),retry:r.headers.get('retry-after')}};
 const login=await call('','/login','POST',{user:'Stephan',id:'123',password:'Testing'}),admin=login.cookie.split(';')[0];assert.match(login.cookie,/; Secure/);
 const make=async(title,type='internal_eer',extra={})=>(await call(admin,'/projects','POST',{title,type,workflowId:type==='commercial'?'commercial':'eer',...extra})).data.project;
 const a=await make('First'),b=await make('Second');await call(admin,'/projects/'+a.id,'DELETE');const c=await make('Third');assert.notEqual(b.wbs,c.wbs);await call(admin,'/projects/'+c.id,'DELETE');assert.notEqual((await make('Fourth')).wbs,c.wbs);
 assert.equal((await call(admin,'/projects','POST',{title:'Duplicate',type:'internal_eer',workflowId:'eer',wbs:b.wbs})).status,422);
 for(const invalid of [null,[],true,'text'])assert.equal((await call(admin,'/projects','POST',invalid)).status,400);
 assert.equal((await call(admin,'/tasks','POST',{projectId:b.id,workflowNodeId:'phase-0',title:'Invalid',status:'invalid'})).status,422);
 const t=(await call(admin,'/tasks','POST',{projectId:b.id,workflowNodeId:'phase-0',title:'Valid'})).data.task;assert.equal((await call(admin,'/tasks/'+t.id,'PATCH',{status:'invalid'})).status,422);assert.equal((await call(admin,'/projects/'+b.id,'PATCH',{status:'invalid'})).status,422);
 const commercial=await make('Private','commercial');const marker='PRIVATE_AUDIT_MARKER';await call(admin,'/projects/'+commercial.id,'PATCH',{title:marker,client:marker});
 const role=(await call(admin,'/admin/profiles','POST',{name:'Audit only',permissions:{viewAudit:true,exportData:true}})).data.id;await call(admin,'/admin/users','POST',{name:'QA restricted',username:'qa-restricted',userId:'qa-restricted',password:'Testing123',profileId:role});const restricted=(await call('','/login','POST',{user:'qa-restricted',id:'qa-restricted',password:'Testing123'})).cookie.split(';')[0];
 for(const route of ['/bootstrap','/export.json']){assert.ok(JSON.stringify((await call(admin,route)).data.audit).includes(marker));assert.ok(!JSON.stringify((await call(restricted,route)).data).includes(marker));}
 await call(admin,'/projects/'+commercial.id,'DELETE');assert.ok(!(await call(restricted,'/bootstrap')).data.audit.some(a=>a.projectId===commercial.id));
 assert.equal((await call(admin,'/projects/'+b.id,'PATCH',{title:'Cross-site'},{Origin:'https://foreign.example'})).status,403);
 assert.equal((await call(admin,'/projects/'+b.id,'PATCH',{title:'Approved'},{Origin:'https://approved.example'})).status,200);
 assert.equal((await call(admin,'/projects/'+b.id,'PATCH',{title:'Cross-site'},{'Sec-Fetch-Site':'cross-site'})).status,403);
 for(let i=0;i<10;i++)assert.equal((await call('','/login','POST',{user:'throttle-test',id:'none',password:'wrong'})).status,401);const throttled=await call('','/login','POST',{user:'throttle-test',id:'none',password:'wrong'});assert.equal(throttled.status,429);assert.equal(throttled.retry,'900');
 }finally{if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}fs.rmSync(dir,{recursive:true,force:true})}
});
