const taskStatuses=new Set(['Not Started','To Do','Assigned','Ongoing','In Progress','On Hold (Client)','On Hold (DOA)','On Hold (UAD)','TL - Review','DOA - Review','Anticipating','No-Go (Client)','No-Go (DOA)','Lost (DOA)','Lost/Cancelled','Completed','Not Required']);
const projectStatuses=new Set([...taskStatuses,'RFQ','Awarded','Escalated','Raised','Review','Planning','Sign-off']);
function nextProjectWbs(db,type){db.projectSequences||={};const internal=type==='internal_eer';const nums=db.projects.map(p=>String(p.wbs||'')).filter(w=>internal?/^EER-\d+$/.test(w):/^\d+$/.test(w)).map(w=>Number(internal?w.slice(4):w));const n=Math.max(db.projectSequences[type]||0,0,...nums)+1;db.projectSequences[type]=n;return internal?'EER-'+String(n).padStart(3,'0'):String(n)}
function statusError(value,type='task'){return typeof value==='string'&&(type==='task'?taskStatuses:projectStatuses).has(value)?'':'Choose a valid '+type+' status';}
module.exports={nextProjectWbs,statusError};
