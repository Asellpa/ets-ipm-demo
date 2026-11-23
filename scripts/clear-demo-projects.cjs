// Does not create accounts, change passwords or rewrite workflow templates.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {clearProjects,clearDemoHistory}=require('../demo-maintenance');
async function main(){
 if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL||process.env.DATABASE_URL_FILE)throw Error('This command is only for the local JSON demo');
 const dir=process.env.ETS_DATA_DIR?path.resolve(process.env.ETS_DATA_DIR):path.resolve(__dirname,'../data'),file=path.join(dir,'db.json');
 if(!process.argv.includes('--confirm-clear-projects'))throw Error('Stop the backend, then run npm run demo:clear -- --confirm-clear-projects. A private backup is created first.');
 const running=await new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port:Number(process.env.PORT||5174)});s.setTimeout(1000);s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>resolve(false));s.once('timeout',()=>{s.destroy();resolve(false)})});if(running)throw Error('Stop the backend before clearing demo projects');
 const original=fs.readFileSync(file,'utf8'),db=JSON.parse(original),includeHistory=process.argv.includes('--include-history'),backup=file+'.before-project-clear-'+Date.now();
 const protectedKeys=['users','profiles','clients','workflowConfig','settings','checklistTemplates','maintenance','checklistDefaultsCreated','checklistAccessPolicyVersion'];
 const preserved=Object.fromEntries(protectedKeys.map(key=>[key,JSON.stringify(db[key])]));
 if(includeHistory)clearDemoHistory(db);else clearProjects(db);
 for(const key of protectedKeys)if(JSON.stringify(db[key])!==preserved[key])throw Error('Preservation check failed for '+key);
 if(!includeHistory){db.settings||={};db.settings.taskCompletionRequiresTime??=true;db.settings.workCalendar||={timeZone:'Asia/Dubai',workingDays:[1,2,3,4,5],reserveHours:1,holidays:[]};}
 if(fs.readFileSync(file,'utf8')!==original)throw Error('Database changed during maintenance');
 fs.writeFileSync(backup,original,{mode:0o600,flag:'wx'});const temp=file+'.clear-'+process.pid;fs.writeFileSync(temp,JSON.stringify(db,null,2),{mode:0o600,flag:'wx'});fs.renameSync(temp,file);
 console.log(includeHistory?'Demo projects, audit, feedback, checklist activity, leave bookings and work history cleared. Project numbering restarted. Accounts, clients, templates and settings preserved.':'Demo projects cleared. Accounts and workflows preserved.');
 console.log('Private backup: '+backup);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
