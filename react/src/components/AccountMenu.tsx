import {useEffect,useRef,useState} from 'react';
import type {Session} from '../api';
import Appearance from './Appearance';

export default function AccountMenu({data,onRefresh,onSignOut}:{data:Session;onRefresh:()=>Promise<void>;onSignOut:()=>Promise<void>}){
 const[open,setOpen]=useState(false),[preferencesOpen,setPreferencesOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false)}
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 function closePreferences(){setPreferencesOpen(false);trigger.current?.focus()}
 return <>
  <div className="account-menu" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false)}} onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
   <button ref={trigger} type="button" className="account-trigger" aria-label="Account menu" aria-expanded={open} aria-controls="account-panel" title={'Account: '+data.user} onClick={()=>setOpen(value=>!value)}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
   </button>
   {open&&<div id="account-panel" className="account-panel" role="region" aria-label="Your profile">
    <div className="account-details"><strong>{data.user}</strong><small>{data.profile}</small></div>
    <button type="button" aria-haspopup="dialog" onClick={()=>{setOpen(false);setPreferencesOpen(true)}}>Preferences</button>
    <button type="button" className="account-signout" onClick={()=>{setOpen(false);void onSignOut()}}>Sign out</button>
   </div>}
  </div>
  <Appearance data={data} onRefresh={onRefresh} open={preferencesOpen} onClose={closePreferences}/>
 </>;
}
