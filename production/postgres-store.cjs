const {AsyncLocalStorage}=require('node:async_hooks');
const {Pool}=require('pg');
const context=new AsyncLocalStorage();
const core=['profiles','users','projects','tasks'];
const LOCK=7351309;
function pool(){return new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,statement_timeout:30000,application_name:'ets-ipm'});}
async function load(client){
 const meta=await client.query('SELECT data FROM ipm_meta WHERE id=true');
 if(!meta.rows.length)throw Error('Database is empty. Run the reviewed JSON import before starting.');
 const db=structuredClone(meta.rows[0].data);
 for(const kind of core)db[kind]=(await client.query(`SELECT data FROM ipm_${kind} ORDER BY position`)).rows.map(r=>r.data);
 db.projectWorkflows=Object.fromEntries((await client.query('SELECT project_id,data FROM ipm_workflows')).rows.map(r=>[r.project_id,r.data]));
 for(const row of (await client.query('SELECT kind,data FROM ipm_collections ORDER BY kind,position')).rows)(db[row.kind]||=[]).push(row.data);
 return db;
}
function records(db){
 const result=new Map();
 for(const kind of core)for(const [position,data]of (db[kind]||[]).entries())result.set(kind+'\0'+data.id,{table:'ipm_'+kind,key:data.id,position,data});
 for(const [key,data]of Object.entries(db.projectWorkflows||{}))result.set('workflow\0'+key,{table:'ipm_workflows',key,data});
 for(const [kind,items]of Object.entries(db))if(Array.isArray(items)&&!core.includes(kind))for(const[position,data]of items.entries()){
  const key=String(data?.id??position),id=kind+'\0'+key;if(result.has(id))throw Error('Duplicate record in '+kind);
  result.set(id,{table:'ipm_collections',kind,key,position,data});
 }
 return result;
}
async function save(client,db,before={}){
 const next=records(db),previous=records(before);
 for(const [key,r]of previous)if(!next.has(key)){
  if(r.table==='ipm_workflows')await client.query('DELETE FROM ipm_workflows WHERE project_id=$1',[r.key]);
  else if(r.kind)await client.query('DELETE FROM ipm_collections WHERE kind=$1 AND id=$2',[r.kind,r.key]);
  else await client.query(`DELETE FROM ${r.table} WHERE id=$1`,[r.key]);
 }
 for(const [key,r]of next){if(JSON.stringify(r)===JSON.stringify(previous.get(key)))continue;
  if(r.table==='ipm_workflows')await client.query('INSERT INTO ipm_workflows(project_id,data) VALUES($1,$2) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data',[r.key,r.data]);
  else if(r.kind)await client.query('INSERT INTO ipm_collections(kind,id,position,data) VALUES($1,$2,$3,$4) ON CONFLICT(kind,id) DO UPDATE SET position=excluded.position,data=excluded.data',[r.kind,r.key,r.position,JSON.stringify(r.data)]);
  else await client.query(`INSERT INTO ${r.table}(id,position,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET position=excluded.position,data=excluded.data`,[r.key,r.position,r.data]);
 }
 const meta=Object.fromEntries(Object.entries(db).filter(([k,v])=>!Array.isArray(v)&&k!=='projectWorkflows'));
 // Empty collections need metadata so they survive a round trip.
 for(const[k,v]of Object.entries(db))if(Array.isArray(v)&&!core.includes(k))meta[k]=[];
 await client.query('INSERT INTO ipm_meta(id,data) VALUES(true,$1) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[meta]);
}
function create(){
 const connection=pool();
 return {
 async check(){const r=await connection.query('SELECT version FROM ipm_schema ORDER BY version DESC LIMIT 1');if(r.rows[0]?.version!==1)throw Error('Unsupported database schema; run reviewed migrations');},
 async run(res,handler){const client=await connection.connect();try{
  await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='10s'");await client.query('SELECT pg_advisory_xact_lock($1)',[LOCK]);
  const db=await load(client),before=structuredClone(db),security=(await client.query('SELECT data FROM ipm_security WHERE id=true')).rows[0].data,old=JSON.stringify(security);
  await context.run({db,security,dirty:false},async()=>{await handler();if(context.getStore().dirty&&(res._pendingResponse?.code||500)<400)await save(client,db,before);});
  if(JSON.stringify(security)!==old)await client.query('UPDATE ipm_security SET data=$1 WHERE id=true',[security]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}},
 read(){const c=context.getStore();if(!c)throw Error('Database context missing');return c.db;},
 write(db){const c=context.getStore();if(!c||db!==c.db)throw Error('Database context mismatch');c.dirty=true;},
 close:()=>connection.end()
 };
}
function securityMap(name,fallback=new Map()){
 return {get(k){return context.getStore()?.security[name]?.[k]??(!context.getStore()?fallback.get(k):undefined)},set(k,v){const c=context.getStore();if(c)c.security[name][k]=v;else fallback.set(k,v);return this;},delete(k){const c=context.getStore();if(c)delete c.security[name][k];else fallback.delete(k);},*[Symbol.iterator](){const c=context.getStore();yield* c?Object.entries(c.security[name]):fallback.entries();}};
}
module.exports={create,pool,load,save,LOCK,securityMap};
