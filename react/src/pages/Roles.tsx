import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {request} from '../api';

type Profile={id:string;name:string;description:string;permissions:Record<string,boolean>};
type Response={profiles:Profile[];permissions:string[]};
export default function Roles(){
 const[profiles,setProfiles]=useState<Profile[]>([]);
 const[permissionNames,setPermissionNames]=useState<string[]>([]);
 const[selected,setSelected]=useState<string>('');
 const[draft,setDraft]=useState<Profile|null>(null);
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  try{const result=await request<Response>('/admin/profiles');setProfiles(result.profiles);setPermissionNames(result.permissions);setSelected(current=>current||result.profiles[0]?.id||'')}
  catch(e){setError((e as Error).message)}
 },[]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{const p=profiles.find(p=>p.id===selected);setDraft(p?{...p,permissions:{...p.permissions}}:null)},[profiles,selected]);
 async function save(e:FormEvent){e.preventDefault();if(!draft)return;setBusy(true);setError('');
  try{await request(draft.id?'/admin/profiles/'+encodeURIComponent(draft.id):'/admin/profiles',{method:draft.id?'PATCH':'POST',body:JSON.stringify({name:draft.name,description:draft.description,permissions:draft.permissions})});await load();if(!draft.id)setSelected('')}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function remove(){if(!draft?.id||!window.confirm('Delete this role?'))return;setBusy(true);setError('');
  try{await request('/admin/profiles/'+encodeURIComponent(draft.id),{method:'DELETE'});setSelected('');await load()}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="panel"><div className="toolbar"><h2>Role Management</h2><button onClick={()=>{setSelected('');setDraft({id:'',name:'',description:'',permissions:{}})}}>+ New role</button></div>
 {error&&<p className="error" role="alert">{error}</p>}
 <div className="toolbar"><label>Role profile <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">New role</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
 {draft&&<form onSubmit={e=>void save(e)}><label>Role name<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label>Description<input value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
 <h3>Permissions</h3><div className="permission-grid">{permissionNames.map(k=><label key={k}><input type="checkbox" checked={Boolean(draft.permissions[k])} disabled={draft.id==='prof-admin'} onChange={e=>setDraft({...draft,permissions:{...draft.permissions,[k]:e.target.checked}})}/> {k.replace(/([A-Z])/g,' $1')}</label>)}</div>
 <div className="toolbar"><button disabled={busy} type="submit">{busy?'Saving…':'Save role'}</button>{draft.id&&!['prof-admin','prof-senior','prof-ltse','prof-tse'].includes(draft.id)&&<button disabled={busy} type="button" onClick={()=>void remove()}>Delete role</button>}</div></form>}
 </div>
}
