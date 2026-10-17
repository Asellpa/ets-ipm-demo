import {useState,type FormEvent} from 'react';
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
 {key:'edd',label:'Expected delivery date',kind:'date'},
 {key:'startDate',label:'Start date',kind:'date'},
 {key:'requiredInputs',label:'Required inputs',kind:'textarea'},
 {key:'deliverables',label:'Deliverables',kind:'textarea'},
 {key:'clientFocal',label:'Client focal point'},
 {key:'doaFocal',label:'DOA focal point'},
 {key:'projectManager',label:'Project manager'},
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
 const[type,setType]=useState(project?.type||(canCommercial?'commercial':'internal_eer'));
 const[values,setValues]=useState<Record<string,string>>(()=>{
  const initial:Record<string,string>={title:project?.title||'',stage:project?.stage||''};
  for(const field of fields)initial[field.key]=String((project as unknown as Record<string,unknown>|undefined)?.[field.key]??'');
  for(const field of pricingFields)initial[field.key]=String((project as unknown as {pricing?:Record<string,string>}|undefined)?.pricing?.[field.key]??'');
  return initial;
 });
 const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 const set=(key:string,value:string)=>setValues(current=>({...current,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  try{
   const payload:Record<string,string>={type,title:values.title.trim(),stage:values.stage};
   for(const field of fields)payload[field.key]=values[field.key]||'';
   if(type==='commercial'&&canViewCommercialFields)for(const field of pricingFields)payload[field.key]=values[field.key]||'';
   await request(project?'/projects/'+encodeURIComponent(project.id):'/projects',{method:project?'PATCH':'POST',body:JSON.stringify(payload)});
   await onSaved();
  }catch(err){setError((err as Error).message)}finally{setBusy(false)}
 }
 return <form className="panel editor" onSubmit={e=>void submit(e)}>
  <h2>{project?'Edit project':'Create project'}</h2>
  <label>Project type<select disabled={Boolean(project)} value={type} onChange={e=>setType(e.target.value)}>{canCommercial&&<option value="commercial">Commercial RFQ</option>}{canEer&&<option value="internal_eer">Internal EER</option>}</select></label>
  <label>Project title<input required maxLength={200} value={values.title} onChange={e=>set('title',e.target.value)}/></label>
  <label>Stage<input value={values.stage} onChange={e=>set('stage',e.target.value)}/></label>
  <h3>Project details</h3>
  {fields.map(field=><label key={field.key}>{field.label}{field.kind==='textarea'?<textarea value={values[field.key]||''} onChange={e=>set(field.key,e.target.value)}/>:<input type={field.kind==='date'?'date':'text'} value={values[field.key]||''} onChange={e=>set(field.key,e.target.value)}/>}</label>)}
  {type==='commercial'&&canViewCommercialFields&&<><h3>Restricted commercial information</h3>{pricingFields.map(field=><label key={field.key}>{field.label}<textarea value={values[field.key]||''} onChange={e=>set(field.key,e.target.value)}/></label>)}</>}
  {error&&<p role="alert" className="error">{error}</p>}
  <div className="toolbar"><button type="button" onClick={onCancel}>Cancel</button><button type="submit" disabled={busy||!values.title.trim()}>{busy?'Saving…':'Save project'}</button></div>
 </form>
}
