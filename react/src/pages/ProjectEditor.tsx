import {useEffect,useState,type FormEvent} from 'react';
import {request,type Project} from '../api';

type Field={key:string;label:string;kind?:'date'|'textarea'};
const fields:Field[]=[
 {key:'client',label:'Client / department'},
 {key:'owner',label:'Project owner'},
 {key:'aircraft',label:'Aircraft'},
 {key:'registration',label:'Registration'},
 {key:'releaseType',label:'Release type'},
 {key:'sector',label:'Sector'},
 {key:'priority',label:'Priority'},
 {key:'status',label:'Status'},
 {key:'scope',label:'Scope',kind:'textarea'},
 {key:'startDate',label:'Start date',kind:'date'},
 {key:'edd',label:'Expected delivery date',kind:'date'},
 {key:'requiredInputs',label:'Required inputs',kind:'textarea'},
 {key:'deliverables',label:'Deliverables',kind:'textarea'},
 {key:'clientFocal',label:'Client focal point'},
 {key:'doaFocal',label:'DOA focal point'},
 {key:'site',label:'Site'},
 {key:'sage',label:'SAGE reference'},
 {key:'nreStatus',label:'NRE status'},
 {key:'remarks',label:'Remarks',kind:'textarea'}
];
const pricingFields=[
 {key:'rom',label:'ROM / pricing'},
 {key:'poStatus',label:'PO status'},
 {key:'negotiationNotes',label:'Negotiation notes'},
 {key:'offerDetails',label:'Offer details'},
 {key:'agreementDetails',label:'Agreement details'}
] as const;
export default function ProjectEditor({project,canCommercial,canEer,canViewCommercialFields,onSaved,onCancel}:{project?:Project;canCommercial:boolean;canEer:boolean;canViewCommercialFields?:boolean;onSaved:()=>Promise<void>;onCancel:()=>void}){
 const[catalog,setCatalog]=useState<{workflows:{id:string;name:string}[];managers:{id:string;name:string}[]}>({workflows:[],managers:[]});const[workflowId,setWorkflowId]=useState(project?.workflowId||'');const[managerId,setManagerId]=useState(project?.managerId||'');const[supervisorId,setSupervisorId]=useState(project?.supervisorId||'');
 useEffect(()=>{let active=true;request<typeof catalog>('/workflow-templates').then(result=>{if(active)setCatalog(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
 const[type,setType]=useState(project?.type||(canCommercial?'commercial':'internal_eer'));
 const[values,setValues]=useState<Record<string,string>>(()=>{
  const initial:Record<string,string>={title:project?.title||'',stage:project?.stage||''};
  for(const field of fields)initial[field.key]=String((project as unknown as Record<string,unknown>|undefined)?.[field.key]??'');
  if(!project)initial.startDate=new Date().toISOString().slice(0,10);
  for(const field of pricingFields)initial[field.key]=String((project as unknown as {pricing?:Record<string,string>}|undefined)?.pricing?.[field.key]??'');
  return initial;
 });
 const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 const set=(key:string,value:string)=>setValues(current=>({...current,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  try{
   if(values.startDate&&values.edd&&values.edd<values.startDate)throw new Error('Expected delivery date cannot precede start date');
   const payload:Record<string,string>={type,title:values.title.trim(),...(!project?{workflowId,managerId,supervisorId}:{...(managerId!==project.managerId?{managerId}:{}),...(supervisorId!==project.supervisorId?{supervisorId}:{})})};
   if(canViewCommercialFields||type!=='commercial')payload.stage=values.stage;
   for(const field of fields)if(field.key!=='status'||canViewCommercialFields||type!=='commercial')payload[field.key]=values[field.key]||'';
   if(type==='commercial'&&canViewCommercialFields)for(const field of pricingFields)payload[field.key]=values[field.key]||'';
   await request(project?'/projects/'+encodeURIComponent(project.id):'/projects',{method:project?'PATCH':'POST',body:JSON.stringify(payload)});
   await onSaved();
  }catch(err){setError((err as Error).message)}finally{setBusy(false)}
 }
 return <form className="panel editor" onSubmit={e=>void submit(e)}>
  <h2>{project?'Edit project':'Create project'}</h2>
  <label>Project type<select aria-label="Project type" disabled={Boolean(project)} value={type} onChange={e=>setType(e.target.value)}>{canCommercial&&<option value="commercial">Commercial RFQ</option>}{canEer&&<option value="internal_eer">Internal EER</option>}</select></label>
  <label>Workflow<select aria-label="Workflow" disabled={Boolean(project)} value={workflowId} onChange={e=>setWorkflowId(e.target.value)}><option value="">Default for this project type</option>{project?.workflowId&&!catalog.workflows.some(w=>w.id===project.workflowId)&&<option value={project.workflowId}>Saved project workflow</option>}{catalog.workflows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><p className="field-help">The selected workflow is saved with the project. Later template changes do not reset existing work.</p>
  <label>Project manager<select aria-label="Project manager" value={managerId} onChange={e=>setManagerId(e.target.value)}><option value="">{project?'Unassigned':'Default to creator if eligible'}</option>{catalog.managers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Project supervisor<select aria-label="Project supervisor" value={supervisorId} onChange={e=>setSupervisorId(e.target.value)}><option value="">Unassigned</option>{catalog.managers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
  <label>Project title<input required maxLength={200} value={values.title} onChange={e=>set('title',e.target.value)}/></label>
  <label>Stage<input disabled={type==='commercial'&&!canViewCommercialFields} value={values.stage} onChange={e=>set('stage',e.target.value)}/></label>
  <h3>Project details</h3>
  {fields.map(field=><label key={field.key}>{field.label}{field.kind==='textarea'?<textarea value={values[field.key]||''} onChange={e=>set(field.key,e.target.value)}/>:<input disabled={field.key==='status'&&type==='commercial'&&!canViewCommercialFields} type={field.kind==='date'?'date':'text'} min={field.kind==='date'?(field.key==='edd'&&values.startDate?values.startDate:'1900-01-01'):undefined} max={field.kind==='date'?'2100-12-31':undefined} value={values[field.key]||''} onChange={e=>set(field.key,e.target.value)}/>}</label>)}
  {type==='commercial'&&canViewCommercialFields&&<><h3>Restricted commercial information</h3>{pricingFields.map(field=><label key={field.key}>{field.label}<textarea value={values[field.key]||''} onChange={e=>set(field.key,e.target.value)}/></label>)}</>}
  {error&&<p role="alert" className="error">{error}</p>}
  <div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="submit" disabled={busy||!values.title.trim()}>{busy?'Saving…':'Save project'}</button></div>
 </form>
}

