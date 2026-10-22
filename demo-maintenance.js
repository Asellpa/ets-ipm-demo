const crypto=require('node:crypto');
const {DEFAULT_PROFILES}=require('./auth-profiles');
function clearProjects(db){
  // Keep users, configuration, feedback, leave and existing audit history.
  for(const key of ['projects','tasks','comments','escalations','projectLinks','importHistory'])db[key]=[];
  db.projectWorkflows={};
  // Legacy notifications are free text and cannot reliably be detached from deleted work.
  db.notifications=[];
}
function prepareDemo(db,password){
  db.maintenance ||= {};
  if(db.maintenance.sysadmin1309Setup)return false;
  if(typeof password!=='string'||password.length<10)throw Error('Use a password of at least 10 characters');
  db.users ||= [];
  if(db.users.some(u=>String(u.username||u.name).toLowerCase()==='sysadmin'||String(u.userId)==='1309'))throw Error('Username sysadmin or ID 1309 already exists. No changes made; review the existing account first.');
  const stephans=db.users.filter(u=>String(u.username||u.name).toLowerCase()==='stephan');
  if(stephans.length!==1)throw Error('Expected exactly one Stephan account. No changes made.');
  db.profiles ||= [];
  for(const id of ['prof-admin','prof-app-admin']){
    const profile=structuredClone(DEFAULT_PROFILES.find(p=>p.id===id));
    const index=db.profiles.findIndex(p=>p.id===id);
    if(index<0)db.profiles.push(profile);else db.profiles[index]=profile;
  }
  const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex');
  if(!crypto.timingSafeEqual(Buffer.from(hash,'hex'),crypto.scryptSync(password,salt,64)))throw Error('Password verification failed');
  const at=new Date().toISOString();
  db.users.push({id:'u-'+crypto.randomUUID(),name:'Sysadmin',username:'sysadmin',userId:'1309',profileId:'prof-admin',active:true,capacity:8,position:'System Administrator',email:'',passwordSalt:salt,passwordHash:hash,createdAt:at});
  stephans[0].profileId='prof-app-admin';
  const removed=(db.projects||[]).length;
  clearProjects(db);
  db.audit ||= [];
  db.audit.push({id:'a-'+crypto.randomUUID(),ts:at,user:'Local setup',text:`Created System Administrator, changed Stephan to Admin and cleared ${removed} projects`,entityType:'maintenance'});
  db.maintenance.sysadmin1309Setup={at,removedProjects:removed};
  return true;
}
module.exports={clearProjects,prepareDemo};
