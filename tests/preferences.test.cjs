const {backendPort,stopBackend}=require('./backend-lifecycle.cjs');
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
test('appearance preferences are authenticated, account-scoped, validated and durable across restart',async()=>{
 const root=path.join(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-preferences-'));let port;fs.copyFileSync(path.join(root,'tests/fixtures/legacy-seed.json'),path.join(dir,'seed.json'));let server;
 async function start(){server=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,PORT:'0',ETS_DATA_DIR:dir},stdio:'pipe'});port=await backendPort(server);}
 async function stop(){if(server?.exitCode===null){await stopBackend(server)}}
 async function call(cookie,route,method='GET',body){const r=await fetch('http://127.0.0.1:'+port+'/api'+route,{method,headers:{cookie:cookie||'','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const login=async(name='Stephan',id='123')=>(await call('','/login','POST',{user:name,id,password:'Testing'})).cookie;
 try{await start();assert.equal((await call('','/preferences')).status,401);let admin=await login();assert.equal((await call(admin,'/preferences')).data.appearance,'system');const created=await call(admin,'/admin/users','POST',{name:'Theme Staff',username:'theme-staff',userId:'theme-staff',password:'Testing',profileId:'prof-tse'});assert.equal(created.status,201);const staff=await login('theme-staff','theme-staff');
 for(const bad of [null,[],{}, {appearance:'invalid'},{appearance:'dark',userId:created.data.id}])assert.equal((await call(admin,'/preferences','PATCH',bad)).status,!bad||Array.isArray(bad)?400:422);
 assert.equal((await call(admin,'/preferences','PATCH',{appearance:'dark'})).status,200);assert.equal((await call(admin,'/bootstrap')).data.preferences.appearance,'dark');assert.equal((await call(staff,'/preferences')).data.appearance,'system');assert.equal((await call(staff,'/preferences','PATCH',{appearance:'light'})).status,200);assert.equal((await call(admin,'/preferences')).data.appearance,'dark');assert.equal((await call(staff,'/bootstrap')).data.preferences.appearance,'light');
 await stop();await start();admin=await login();assert.equal((await call(admin,'/preferences')).data.appearance,'dark');assert.equal((await call(await login('theme-staff','theme-staff'),'/preferences')).data.appearance,'light');assert.equal((await call(admin,'/preferences','PATCH',{appearance:'system'})).status,200);
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true})}
});
