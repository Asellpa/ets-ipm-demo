import type {Task} from './api';
export const departments=['Method & Industrialization','Projects & Support','Certification'];
export const taskStatuses=['Not Started','To Do','Assigned','Ongoing','In Progress','On Hold (Client)','On Hold (DOA)','On Hold (UAD)','TL - Review','DOA - Review','Anticipating','No-Go (Client)','No-Go (DOA)','Lost (DOA)','Lost/Cancelled','Completed','Not Required'];
export const projectStatuses=['Not Started','Ongoing','On Hold (Client)','On Hold (DOA)','On Hold (UAD)','TL - Review','DOA - Review','Anticipating','Lost/Cancelled','Completed','Not Required'];
export function progress(tasks:Task[]){const applicable=tasks.filter(t=>Number(t.level||3)>=3&&!['Lost/Cancelled','Not Required','No-Go (Client)','No-Go (DOA)','Lost (DOA)'].includes(t.status||''));const done=applicable.filter(t=>t.status==='Completed').length;return {done,total:applicable.length,percent:applicable.length?Math.round(done/applicable.length*100):0};}
export function departmentName(s:string){return /^(M&I|Method|Methods)/i.test(s)?departments[0]:/^(P&S|Projects.*Support)/i.test(s)?departments[1]:/^Cert/i.test(s)?departments[2]:s;}
