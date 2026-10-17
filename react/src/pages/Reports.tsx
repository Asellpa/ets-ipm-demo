import {useMemo,useState} from 'react';
import type {Session} from '../api';

export default function Reports({data}:{data:Session}){
 const[projectId,setProjectId]=useState('all');
 const[status,setStatus]=useState('all');
 const[assignee,setAssignee]=useState('all');
 const statuses=useMemo(()=>[...new Set(data.tasks.map(t=>t.status||'Unknown'))].sort(),[data.tasks]);
 const assignees=useMemo(()=>[...new Set(data.tasks.map(t=>t.assignee||'Unassigned'))].sort(),[data.tasks]);
 const tasks=data.tasks.filter(t=>(projectId==='all'||t.projectId===projectId)&&(status==='all'||(t.status||'Unknown')===status)&&(assignee==='all'||(t.assignee||'Unassigned')===assignee));
 const done=tasks.filter(t=>t.status==='Completed').length;
 const estimated=tasks.reduce((n,t)=>n+Number(t.mhEstimate||0),0);
 const actual=tasks.reduce((n,t)=>n+Number(t.mhActual||0),0);
 const projectName=(id:string)=>data.projects.find(p=>p.id===id)?.title||id;
 function downloadFiltered(){
  const header=['Project','WBS','Task','Assignee','Status','Estimated MH','Actual MH'];
  const quote=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  const lines=[header,...tasks.map(t=>[projectName(t.projectId),t.wbs,t.title,t.assignee,t.status,t.mhEstimate,t.mhActual])].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([lines],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='ets-ipm-filtered-tasks.csv';link.click();URL.revokeObjectURL(url);
 }
 return <>
  <div className="panel"><h2>Reports and filters</h2><div className="toolbar">
   <label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="all">All projects</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
   <label>Task status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Assignee<select value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="all">All assignees</option>{assignees.map(a=><option key={a}>{a}</option>)}</select></label>
  </div></div>
  <div className="stats"><div className="stat"><small>Matching projects</small><strong>{new Set(tasks.map(t=>t.projectId)).size}</strong></div><div className="stat"><small>Tasks completed</small><strong>{done}/{tasks.length}</strong></div><div className="stat"><small>Estimated MH</small><strong>{estimated}</strong></div><div className="stat"><small>Actual MH</small><strong>{actual}</strong></div></div>
  <div className="panel"><div className="toolbar"><h2>Task report</h2>{data.permissions.exportData&&<><button type="button" onClick={downloadFiltered}>Export filtered CSV</button><a className="export-link" href="/api/export.csv" download>Export full tracker CSV</a></>}</div>
  {tasks.length===0?<p>No tasks match these filters.</p>:<table><thead><tr><th>Project</th><th>Task</th><th>Assignee</th><th>Status</th><th>Estimated MH</th><th>Actual MH</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{projectName(t.projectId)}</td><td>{t.title}</td><td>{t.assignee||'Unassigned'}</td><td>{t.status||'Unknown'}</td><td>{t.mhEstimate??0}</td><td>{t.mhActual??0}</td></tr>)}</tbody></table>}</div>
 </>;
}
