import {useEffect,useState,type FormEvent} from 'react';
import {request,type Session} from '../api';
import WorkflowDesigner,{defaultConfig,serializeConfig,type Config,type Workflow} from './WorkflowDesigner';
export default function Configuration({data,onRefresh}:{data:Session;onRefresh:()=>Promise<void>}){
 const[config,setConfig]=useState<Config|null>(null);const[settings,setSettings]=useState<Record<string,unknown>>(data.settings as Record<string,unknown>);
 const[error,setError]=useState('');const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);
 useEffect(()=>{request<{config:Config|null}>('/workflow-config').then(r=>setConfig(r.config||structuredClone(defaultConfig))).catch(e=>setError((e as Error).message))},[]);
 async function saveSettings(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{await request('/settings',{method:'PATCH',body:JSON.stringify(settings)});await onRefresh();setMessage('Settings saved')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function saveWorkflow(){if(!config)return;setBusy(true);setError('');setMessage('');try{await request('/workflow-config',{method:'PUT',body:JSON.stringify({config:serializeConfig(config)})});setMessage('Workflow configuration saved')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function changeWorkflow(id:string,change:Partial<Workflow>){if(!config)return;setConfig({...config,workflows:config.workflows.map(w=>w.id===id?{...w,...change}:w)})}
 return <><div className="panel"><h2>System settings</h2>{error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <form onSubmit={e=>void saveSettings(e)}><label>Standard hours per day<input type="number" min="1" max="24" value={Number(settings.standardHoursPerDay||8)} onChange={e=>setSettings({...settings,standardHoursPerDay:Number(e.target.value)})}/></label>
 <label>Departments (comma-separated)<input value={Array.isArray(settings.departments)?settings.departments.join(', '):''} onChange={e=>setSettings({...settings,departments:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label>
 <button disabled={busy}>Save settings</button></form></div>
 <div className="panel"><div className="toolbar"><h2>Workflow configuration</h2><button disabled={busy||!config} onClick={()=>void saveWorkflow()}>Save workflows</button></div>
 {!config?<p>No workflow configuration returned from the server.</p>:<><button onClick={()=>setConfig({...config,workflows:[...config.workflows,{id:crypto.randomUUID(),name:'New workflow',stages:['Raised','Completed'],objects:[]}]})}>Add workflow</button>{config.projectTypes.map(t=><label key={t.id}>{t.name} workflow<select value={t.workflowId} onChange={e=>setConfig({...config,projectTypes:config.projectTypes.map(p=>p.id===t.id?{...p,workflowId:e.target.value}:p)})}>{config.workflows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>)}{config.workflows.map(w=><div key={w.id}><h3>{w.name}</h3><label>Workflow name<input value={w.name} onChange={e=>changeWorkflow(w.id,{name:e.target.value})}/></label>
 <label>Stages (comma-separated)<input value={w.stages.join(', ')} onChange={e=>changeWorkflow(w.id,{stages:e.target.value.split(',').map(x=>x.trim()).filter(Boolean),nodes:undefined})}/></label>
 <WorkflowDesigner workflow={w} onChange={next=>changeWorkflow(w.id,next)}/><table><thead><tr><th>Object</th><th>Stage</th><th>Parent object</th></tr></thead><tbody>{w.objects.map(o=><tr key={o.id}><td>{o.name}</td><td>{o.stage}</td><td>{o.parent||'—'}</td></tr>)}</tbody></table></div>)}</>}
 </div></>
}

