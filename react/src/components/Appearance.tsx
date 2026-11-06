import {useEffect,useRef,useState} from 'react';
import {request,type Session} from '../api';
type AppearanceMode='light'|'dark'|'system';
export function useAppearance(mode:AppearanceMode){
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=mode==='system'?(media.matches?'dark':'light'):mode};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)},[mode]);
}
export default function Appearance({data,onRefresh}:{data:Session;onRefresh:()=>Promise<void>}){
 const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const dialog=useRef<HTMLDialogElement>(null);const mode=data.preferences?.appearance||'system';
 useEffect(()=>{if(open)dialog.current?.showModal()},[open]);
 async function choose(appearance:AppearanceMode){setBusy(true);setError('');try{await request('/preferences',{method:'PATCH',body:JSON.stringify({appearance})});await onRefresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><button aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>Preferences</button>{open&&<dialog ref={dialog} className="appearance-dialog" aria-labelledby="appearance-title" onCancel={()=>setOpen(false)}><div className="toolbar"><h2 id="appearance-title">Preferences</h2><button aria-label="Close preferences" disabled={busy} onClick={()=>{dialog.current?.close();setOpen(false)}}>×</button></div><fieldset disabled={busy}><legend>Appearance</legend><p className="muted">Saved to your account. Your choice applies across the application.</p><div className="appearance-options">{([['light','Light','Bright surfaces and navy text.'],['dark','Dark','Dark surfaces with softer contrast.'],['system','Device','Follow your device’s appearance.']] as const).map(([value,label,description])=><label key={value} className="appearance-option"><input type="radio" name="appearance" value={value} checked={mode===value} onChange={()=>void choose(value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset>{busy&&<p role="status">Saving appearance…</p>}{error&&<p role="alert" className="error">{error}</p>}</dialog>}</>;
}
