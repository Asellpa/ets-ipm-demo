import {useMemo,useState} from 'react';
import ImportTracker from './ImportTracker';
import type {Session} from '../api';

export default function Reports({data,onRefresh}:{data:Session;onRefresh:()=>Promise<void>}){
 const[client,setClient]=useState('');const[sector,setSector]=useState('');const[release,setRelease]=useState('');const[from,setFrom]=useState('');const[to,setTo]=useState('');const[flagged,setFlagged]=useState(false);const[rate,setRate]=useState(0);const[projectId,setProjectId]=useState('all');
 const[status,setStatus]=useState('all');
 const[assignee,setAssignee]=useState('all');
 const statuses=useMemo(()=>[...new Set(data.tasks.map(t=>t.status||'Unknown'))].sort(),[data.tasks]);
 const assignees=useMemo(()=>[...new Set(data.tasks.map(t=>t.assignee||'Unassigned'))].sort(),[data.tasks]);
 const projects=data.projects.filter(p=>(!client||p.client===client)&&(!sector||p.sector===sector)&&(!release||p.releaseType===release));const ids=new Set(projects.map(p=>p.id));
 const tasks=data.tasks.filter(t=>Number(t.level||3)>=3&&ids.has(t.projectId)&&(!from||(t.startDate||'')>=from)&&(!to||(t.startDate||'')<=to)&&(!flagged||Boolean(t.flag))&&(projectId==='all'||t.projectId===projectId)&&(status==='all'||(t.status||'Unknown')===status)&&(assignee==='all'||(t.assignee||'Unassigned')===assignee));
 const done=tasks.filter(t=>t.status==='Completed').length;
 const estimated=tasks.reduce((n,t)=>n+Number(t.mhEstimate||0),0);
 const actual=tasks.reduce((n,t)=>n+Number(t.mhActual||0),0);
 const projectName=(id:string)=>data.projects.find(p=>p.id===id)?.title||id;
 function downloadFiltered(){
  const header=['Project','WBS','Task','Assignee','Status','Estimated MH','Actual MH'];
  const quote=(v:unknown)=>'"'+String(typeof v==='string'&&/^[=+@\t\r-]/.test(v)?"'"+v:v??'').replaceAll('"','""')+'"';
  const lines=[header,...tasks.map(t=>[projectName(t.projectId),t.wbs,t.title,t.assignee,t.status,t.mhEstimate,t.mhActual])].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([lines],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='ets-ipm-filtered-tasks.csv';link.click();URL.revokeObjectURL(url);
 }
 return <>
  <div className="panel"><h2>Reports and filters</h2><div className="toolbar">
   <label>From date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To date<input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label>{([{label:'Client',value:client,set:setClient,key:'client'},{label:'Sector',value:sector,set:setSector,key:'sector'},{label:'Release type',value:release,set:setRelease,key:'releaseType'}] as const).map(f=><label key={f.key}>{f.label}<select value={f.value} onChange={e=>f.set(e.target.value)}><option value="">All</option>{[...new Set(data.projects.map(p=>p[f.key]).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select></label>)}<label><input type="checkbox" checked={flagged} onChange={e=>setFlagged(e.target.checked)}/> Escalated / bottleneck only</label><label>Project<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="all">All projects</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
   <label>Task status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Assignee<select value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="all">All assignees</option>{assignees.map(a=><option key={a}>{a}</option>)}</select></label>
  </div></div>
  <div className="stats"><div className="stat"><small>Matching projects</small><strong>{new Set(tasks.map(t=>t.projectId)).size}</strong></div><div className="stat"><small>Tasks completed</small><strong>{done}/{tasks.length}</strong></div><div className="stat"><small>Estimated MH</small><strong>{estimated}</strong></div><div className="stat"><small>Actual MH</small><strong>{actual}</strong></div></div>
  <div className="panel"><div className="toolbar"><h2>Task report</h2>{data.permissions.exportData&&<><button type="button" onClick={downloadFiltered}>Export filtered CSV</button><a href="/api/export.json" download>Export complete data JSON</a><a className="export-link" href="/api/export.csv" download>Export full tracker CSV</a></>}</div>
  {tasks.length===0?<p>No tasks match these filters.</p>:<table><thead><tr><th>Project</th><th>Task</th><th>Assignee</th><th>Status</th><th>Estimated MH</th><th>Actual MH</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{projectName(t.projectId)}</td><td>{t.title}</td><td>{t.assignee||'Unassigned'}</td><td>{t.status||'Unknown'}</td><td>{t.mhEstimate??0}</td><td>{t.mhActual??0}</td></tr>)}</tbody></table>}</div>
 {data.permissions.viewCommercialFields&&<section className="panel"><h2>Management profitability</h2><p>Enter an hourly cost in the same currency as numeric project pricing. Text quotes are excluded from margin calculations.</p><label>Hourly labour cost<input type="number" min="0" value={rate} onChange={e=>setRate(Number(e.target.value))}/></label><table><thead><tr><th>Project</th><th>Quoted price</th><th>Actual MH</th><th>Labour cost</th><th>Margin before other costs</th></tr></thead><tbody>{projects.filter(p=>p.type==='commercial'&&(projectId==='all'||p.id===projectId)).map(p=>{const hours=tasks.filter(t=>t.projectId===p.id).reduce((sum,t)=>sum+Number(t.mhActual||0),0);const raw=p.pricing?.rom||'';const price=raw.trim()&&Number.isFinite(Number(raw))?Number(raw):null;return <tr key={p.id}><td>{p.title}</td><td>{raw||'Not quoted'}</td><td>{hours}</td><td>{rate?(hours*rate).toFixed(2):'Set hourly cost'}</td><td>{price!==null&&rate?(price-hours*rate).toFixed(2):'Unavailable'}</td></tr>})}</tbody></table></section>}
 {data.permissions.importData&&<ImportTracker onImported={onRefresh}/>}
 </>;
}

