const {isResource}=require('./resource-policy');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function named(db,name){return (db.users||[]).filter(u=>u.name===name);}
function uniqueId(db,name){const users=named(db,name);return users.length===1?users[0].id:null;}
function owns(db,task,user){return !!user&&!!task&&(own(task,'assigneeId')?!!task.assigneeId&&task.assigneeId===user.id:uniqueId(db,task.assignee)===user.id);}
function assign(db,task,requestedId,before){
 if(requestedId!==undefined&&typeof requestedId!=='string'&&requestedId!==null)return 'Choose an existing task owner';
 if(requestedId===null||requestedId===''||requestedId===undefined&&task.assignee==='Unassigned'){task.assigneeId=null;task.assignee='Unassigned';return '';}
 let person;
 if(requestedId)person=db.users.find(u=>u.id===requestedId);
 else if(before?.assigneeId&&task.assignee===before.assignee)person=db.users.find(u=>u.id===before.assigneeId);
 else{const matches=named(db,task.assignee);if(matches.length>1)return 'Several accounts share this display name. Use distinct display names before assigning work, or select an explicit user ID.';person=matches[0];}
 if(!person?.active||!isResource(person))return 'Assignee must be an active team member';
 task.assigneeId=person.id;task.assignee=person.name;return '';
}
function notice(db,n){
 if(!own(n,'recipientUserIds')){
  n.recipientUserIds=[];n.recipientProfileIds=[];n.broadcast=false;
  for(const r of n.recipients||[]){if(r&&typeof r==='object'&&r.all){n.broadcast=true;continue;}if(r&&typeof r==='object'&&r.userId){if(db.users.some(u=>u.id===r.userId))n.recipientUserIds.push(r.userId);continue;}if(r==='All'){if(!named(db,'All').length)n.broadcast=true;continue;}const role=db.profiles.find(p=>p.name===r);if(role)n.recipientProfileIds.push(role.id);else{const id=uniqueId(db,r);if(id)n.recipientUserIds.push(id);}}
 }
 if(!own(n,'readByIds'))n.readByIds=(n.readBy||[]).map(name=>uniqueId(db,name)).filter(Boolean);
 return n;
}
function canReadNotice(n,user){return !!(n.broadcast||n.recipientUserIds?.includes(user.id)||n.recipientProfileIds?.includes(user.profileId));}
function normalize(db){
 for(const task of db.tasks||[])if(!own(task,'assigneeId'))task.assigneeId=task.assignee==='Unassigned'?null:uniqueId(db,task.assignee);
 for(const leave of db.leave||[])if(!own(leave,'userId'))leave.userId=uniqueId(db,leave.user);
 for(const n of db.notifications||[])notice(db,n);
}
function renamed(db,user){for(const t of db.tasks||[])if(t.assigneeId===user.id)t.assignee=user.name;for(const leave of db.leave||[])if(leave.userId===user.id)leave.user=user.name;}
module.exports={owns,assign,normalize,notice,canReadNotice,renamed};
