const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const Pg=require('../production/postgres-store.cjs'),{canonical}=require('../production/scripts/database.cjs');
// Destructive only to a dedicated synthetic CI database, never DATABASE_URL supplied by an operator.
const url=process.env.ETS_TEST_DATABASE_URL;
test('PostgreSQL migration, rollback, unique/FK constraints, concurrent writes and shared security survive reload',{skip:!url},async()=>{
 const old=process.env.DATABASE_URL;process.env.DATABASE_URL=url;const pool=Pg.pool();let store,other;
 try{
 const parsed=new URL(url);assert.match(parsed.pathname,/ipm_test$/,'Refuse a database without the ipm_test suffix');
 await pool.query('DROP TABLE IF EXISTS ipm_tasks,ipm_workflows,ipm_projects,ipm_users,ipm_profiles,ipm_collections,ipm_meta,ipm_security,ipm_schema CASCADE');
 await pool.query(fs.readFileSync(path.join(__dirname,'../production/migrations/001.sql'),'utf8'));
 const db={profiles:[{id:'prof-admin'}],users:[{id:'u',username:'qa',userId:'1',profileId:'prof-admin',email:'qa@example.test',active:true}],projects:[{id:'p',wbs:'1',title:'Private'}],tasks:[],projectWorkflows:{p:{nodes:[],states:{}}},settings:{standardHoursPerDay:8},audit:[],notifications:[]};
 await pool.query('BEGIN');await Pg.save(pool,db);await pool.query('COMMIT');assert.equal(canonical(await Pg.load(pool)),canonical(db));
 store=Pg.create();other=Pg.create();await store.check();
 const sessions=Pg.securityMap('sessions'),response=()=>({_pendingResponse:{code:200}});
 await store.run(response(),async()=>{store.read().projects[0].title='Must roll back';store.write(store.read());throw Error('Injected failure');}).then(()=>assert.fail('Expected rollback'),()=>{});
 assert.equal((await Pg.load(pool)).projects[0].title,'Private');
 await assert.rejects(store.run(response(),async()=>{store.read().projects.push({id:'duplicate',wbs:'1'});store.write(store.read());}),/unique/);
 await assert.rejects(store.run(response(),async()=>{store.read().tasks.push({id:'orphan',wbs:'2.1',projectId:'missing',mhActual:0});store.write(store.read());}),/foreign key/);
 await Promise.all(Array.from({length:12},(_,i)=>(i%2?store:other).run(response(),async()=>{const current=(i%2?store:other);const db=current.read();db.tasks.push({id:'t'+i,wbs:'1.'+(db.tasks.length+1),projectId:'p',mhEstimate:1,mhActual:0});current.write(db);sessions.set('hashed-test-token',{userId:'u',createdAt:Date.now()});})));
 const after=await Pg.load(pool);assert.equal(after.tasks.length,12);assert.equal(new Set(after.tasks.map(t=>t.wbs)).size,12);
 await store.close();store=Pg.create();await store.run(response(),()=>{assert.equal(sessions.get('hashed-test-token').userId,'u');});
 // A rejected API operation cannot commit domain mutations.
 await store.run({_pendingResponse:{code:403}},()=>{store.read().projects[0].title='Denied';store.write(store.read());});assert.equal((await Pg.load(pool)).projects[0].title,'Private');
 }finally{if(store)await store.close();if(other)await other.close();await pool.end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;}
});
test('PostgreSQL-backed API persists authorised writes and revokes local sessions across server restart',{skip:!url},async()=>{
 const old=process.env.DATABASE_URL;process.env.DATABASE_URL=url;const pool=Pg.pool(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-pg-api-'));let child;
 const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/seed.json'))),crypto=require('node:crypto');
 // Use isolated known credentials only; never create these on production.
 seed.profiles=require('../auth-profiles').DEFAULT_PROFILES;seed.users.forEach((u,i)=>{u.id||='qa-u'+i;u.username=u.name;u.userId=String(i+1);u.profileId='prof-admin';u.active=true;u.email='qa-'+i+'@example.test';u.passwordSalt='qa-salt';u.passwordHash=crypto.scryptSync('QA-only-password',u.passwordSalt,64).toString('hex');});
 async function start(mode='local'){child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,DATABASE_URL:url,PORT:'5194',ETS_DATA_DIR:temp,AUTH_MODE:mode,NODE_ENV:mode==='proxy'?'production':'test',IDENTITY_PROXY_SECRET:'x'.repeat(32),APP_ORIGINS:'https://ipm.example.test',ETS_FILE_DIR:temp,CLAMD_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('API exited before readiness');try{if((await fetch('http://127.0.0.1:5194/health/ready')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('API readiness timeout');}
 async function stop(){if(!child||child.exitCode!==null)return;await new Promise(r=>{child.once('exit',r);child.kill();});}
 try{
 await pool.query('TRUNCATE ipm_tasks,ipm_workflows,ipm_projects,ipm_users,ipm_profiles,ipm_collections,ipm_meta,ipm_security CASCADE');await Pg.save(pool,seed);await pool.query('INSERT INTO ipm_security(id,data) VALUES(true,$1)',[{sessions:{},failures:{}}]);
 await start();const login=await fetch('http://127.0.0.1:5194/api/login',{method:'POST',body:JSON.stringify({user:seed.users[0].name,id:'1',password:'QA-only-password'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const read=()=>fetch('http://127.0.0.1:5194/api/bootstrap',{headers:{cookie}});assert.equal((await read()).status,200);await stop();await start();assert.equal((await read()).status,200);
 assert.equal((await fetch('http://127.0.0.1:5194/api/logout',{method:'POST',headers:{cookie},body:'{}'})).status,200);assert.equal((await read()).status,401);await stop();await start();assert.equal((await read()).status,401);await stop();await start('proxy');
 const headers={'x-ipm-proxy-secret':'x'.repeat(32),'x-forwarded-email':seed.users[0].email};
 assert.equal((await fetch('http://127.0.0.1:5194/api/bootstrap',{headers:{'x-forwarded-email':seed.users[0].email}})).status,401);
 assert.equal((await fetch('http://127.0.0.1:5194/api/bootstrap',{headers})).status,200);
 assert.equal((await fetch('http://127.0.0.1:5194/api/login',{method:'POST',headers,body:'{}'})).status,405);
 const create=await fetch('http://127.0.0.1:5194/api/admin/users',{method:'POST',headers,body:JSON.stringify({name:'Identity user',username:'identity-user',userId:'identity-user',profileId:'prof-tse',email:'new@example.test'})});assert.equal(create.status,201,await create.text());
 assert.equal((await fetch('http://127.0.0.1:5194/api/demo/clear-records',{method:'POST',headers,body:'{}'})).status,410);
 }finally{await stop();await pool.end();fs.rmSync(temp,{recursive:true,force:true});if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;}
});

test('source-preserving migration CLI and real PostgreSQL dump/restore reconcile records and private files',{skip:!url},async()=>{
 const {spawnSync}=require('node:child_process');const container=process.env.ETS_TEST_POSTGRES_CONTAINER;if(!container)throw Error('CI must supply isolated PostgreSQL container for restore verification');
 const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=url;const pool=Pg.pool(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ipm-migration-'));let scanner;
 try{
 await pool.query('TRUNCATE ipm_tasks,ipm_workflows,ipm_projects,ipm_users,ipm_profiles,ipm_collections,ipm_meta CASCADE');
 const net=require('node:net');scanner=net.createServer(socket=>{let buf=Buffer.alloc(0),header=false;socket.on('data',chunk=>{buf=Buffer.concat([buf,chunk]);if(!header){if(buf.length<10)return;buf=buf.subarray(10);header=true;}while(buf.length>=4){const n=buf.readUInt32BE(0);if(buf.length<4+n)return;buf=buf.subarray(4+n);if(!n){socket.end('stream: OK\0');return;}}});});await new Promise(r=>scanner.listen(0,'127.0.0.1',r));
 const source={profiles:[{id:'prof-admin'}],users:[{id:'u',username:'qa',userId:'1',email:'qa@example.test',profileId:'prof-admin',active:true,passwordHash:'discard-me'}],projects:[{id:'p',wbs:'1'}],tasks:[{id:'t',wbs:'1.1',projectId:'p',mhEstimate:2,mhActual:1}],projectWorkflows:{p:{nodes:[{id:'overview'}]}},audit:[],objectAttachments:[{id:'file',projectId:'p',nodeId:'overview',name:'scope.txt',size:5,data:Buffer.from('scope').toString('base64')}],feedback:[]};
 const input=path.join(tmp,'source.json');fs.writeFileSync(input,JSON.stringify(source));const sourceBefore=fs.readFileSync(input);const env={...process.env,DATABASE_URL:url,ETS_FILE_DIR:path.join(tmp,'files'),CLAMD_HOST:'127.0.0.1',CLAMD_PORT:String(scanner.address().port)};
 // Async child permits the protocol test scanner to process requests.
 async function cli(...args){return await new Promise(resolve=>{const c=spawn(process.execPath,['production/scripts/database.cjs',...args],{cwd:path.join(__dirname,'..'),env,stdio:['ignore','pipe','pipe']});let out='';c.stdout.on('data',x=>out+=x);c.stderr.on('data',x=>out+=x);c.on('exit',status=>resolve({status,out}));});}
 assert.equal((await cli('import',input)).status,0);assert.equal((await pool.query('SELECT 1 FROM ipm_meta')).rowCount,0);
 const imported=await cli('import',input,'--apply');assert.equal(imported.status,0,imported.out);assert.equal((await cli('verify',input)).status,0);assert.deepEqual(fs.readFileSync(input),sourceBefore);assert.notEqual((await cli('import',input,'--apply')).status,0);
 const db=await Pg.load(pool);assert.equal(db.users[0].passwordHash,undefined);assert.equal(db.objectAttachments[0].data,undefined);assert.equal(db.objectAttachments[0].scanStatus,'clean');
 const dump=spawnSync('docker',['exec',container,'pg_dump','-U','ipm_test','-d','ipm_test','-Fc'],{maxBuffer:10*1024*1024});assert.equal(dump.status,0,dump.stderr.toString());
 await pool.query('DROP DATABASE IF EXISTS ipm_restore_test');await pool.query('CREATE DATABASE ipm_restore_test');
 const restore=spawnSync('docker',['exec','-i',container,'pg_restore','-U','ipm_test','--dbname','ipm_restore_test','--single-transaction','--exit-on-error','--no-owner','--no-acl'],{input:dump.stdout,maxBuffer:10*1024*1024});assert.equal(restore.status,0,restore.stderr.toString());
 const {Pool}=require('pg'),restoredPool=new Pool({connectionString:url.replace(/ipm_test$/,'ipm_restore_test')});try{assert.equal(canonical(await Pg.load(restoredPool)),canonical(db));}finally{await restoredPool.end();}
 const restoredFiles=path.join(tmp,'restored-files');fs.cpSync(env.ETS_FILE_DIR,restoredFiles,{recursive:true});const file=db.objectAttachments[0];assert.equal(require('../production/files.cjs').digest(fs.readFileSync(path.join(restoredFiles,file.storageKey.slice(0,2),file.storageKey))),file.sha256);
 }finally{if(scanner)await new Promise(r=>scanner.close(r));await pool.end();fs.rmSync(tmp,{recursive:true,force:true});if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
