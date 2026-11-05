const fs=require('node:fs'),path=require('node:path');
require('../config.cjs');const Pg=require('../postgres-store.cjs'),Files=require('../files.cjs');
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
function validate(db){
 const errors=[];
 for(const kind of ['profiles','users','projects','tasks']){if(!Array.isArray(db[kind])){errors.push(kind+' collection is missing');continue;}const ids=new Set();for(const r of db[kind]){if(!r.id||ids.has(r.id))errors.push('Missing/duplicate ID in '+kind);ids.add(r.id);}}
 const unique=(list,key,label)=>{const seen=new Set();for(const r of list||[]){const v=key(r);if(!v||seen.has(v))errors.push('Missing/duplicate '+label);seen.add(v);}};
 unique(db.projects,p=>String(p.wbs||''),'project WBS');unique(db.tasks,t=>t.projectId+'\0'+t.wbs,'task WBS');unique(db.users,u=>String(u.username||'').trim().toLowerCase(),'username');unique(db.users,u=>String(u.userId||''),'user code');
 const projects=new Set((db.projects||[]).map(p=>p.id)),profiles=new Set((db.profiles||[]).map(p=>p.id));
 const users=new Set((db.users||[]).map(u=>u.id));
 for(const t of db.tasks||[])if(t.assigneeId&&!users.has(t.assigneeId))errors.push('Invalid task owner reference');
 for(const t of db.tasks||[])if(!projects.has(t.projectId)||[t.mhActual,t.mhEstimate].some(n=>n!=null&&(!Number.isFinite(Number(n))||Number(n)<0)))errors.push('Invalid task reference/hours');
 for(const u of db.users||[])if(!profiles.has(u.profileId))errors.push('Unknown user profile');
 for(const id of Object.keys(db.projectWorkflows||{}))if(!projects.has(id))errors.push('Orphan workflow');
 const active=(db.users||[]).filter(u=>u.active!==false);unique(active,u=>String(u.email||'').trim().toLowerCase(),'active account email (required for identity mapping)');
 if(!active.some(u=>u.profileId==='prof-admin'))errors.push('An active System Administrator is required');
 for(const f of db.objectAttachments||[])if(!projects.has(f.projectId)||!db.projectWorkflows?.[f.projectId]?.nodes.some(n=>n.id===f.nodeId))errors.push('Orphan attachment');
 return [...new Set(errors)];
}
async function main(){const command=process.argv[2],source=process.argv[3];const pool=Pg.pool();try{
 if(command==='migrate'){const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1)',[Pg.LOCK]);await client.query(fs.readFileSync(path.join(__dirname,'../migrations/001.sql'),'utf8'));await client.query('COMMIT');console.log('Schema version 1 applied.');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}return;}
 if(!['import','verify'].includes(command)||!source)throw Error('Usage: database.cjs migrate | import SOURCE.json [--apply] | verify SOURCE.json');
 const bytes=fs.readFileSync(source),db=JSON.parse(bytes.toString()),errors=validate(db);if(errors.length)throw Error('Preflight blocked: '+errors.join('; '));
 console.log(JSON.stringify({sourceSha256:Files.digest(bytes),counts:Object.fromEntries(Object.entries(db).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))}));
 if(command==='import'&&!process.argv.includes('--apply')){console.log('Preflight only. Source unchanged. Use --apply only against an empty staging database.');return;}
 if(!process.env.ETS_FILE_DIR||!process.env.CLAMD_HOST)throw Error('Private file directory and malware scanner are required for migration/verification');
 const target=structuredClone(db);for(const u of target.users){delete u.password;delete u.passwordHash;delete u.passwordSalt;}await Files.migrate(target);
 const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1)',[Pg.LOCK]);
 if(command==='import'){if((await client.query('SELECT 1 FROM ipm_meta')).rowCount)throw Error('Target is not empty. Import refuses to overwrite existing data.');await Pg.save(client,target);}
 const restored=await Pg.load(client);if(canonical(restored)!==canonical(target))throw Error('Full record reconciliation failed; transaction rolled back');
 for(const f of restored.objectAttachments||[])Files.bytes(f);for(const f of restored.feedback||[])if(f.screenshot)Files.bytes(f.screenshot);
 await client.query('COMMIT');console.log('Reconciliation passed: records, relationships and file hashes. Local password hashes excluded; identity mapping required.');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }finally{await pool.end();}}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={validate,canonical};
