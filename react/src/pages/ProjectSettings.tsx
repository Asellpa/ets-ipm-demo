import {useCallback,useRef,useState} from 'react';
import Configuration from './Configuration';
import RegisterConfiguration from './RegisterConfiguration';
import FieldPermissions from './FieldPermissions';
export default function ProjectSettings(){
 const[tab,setTab]=useState('workflows');const dirty=useRef(false);const reportDirty=useCallback((value:boolean)=>{dirty.current=value},[]);
 function select(next:string){if(next===tab)return;if(dirty.current&&!window.confirm('Discard unsaved settings before switching sections?'))return;dirty.current=false;setTab(next)}
 return <div className="project-settings"><nav className="tabs settings-tabs" aria-label="Project settings sections">{[['workflows','Workflows'],['permissions','Field permissions'],['register','Register configuration']].map(([id,label])=><button key={id} className={tab===id?'selected':''} aria-pressed={tab===id} onClick={()=>select(id)}>{label}</button>)}</nav>{tab==='workflows'?<Configuration onDirtyChange={reportDirty}/>:tab==='permissions'?<FieldPermissions onDirtyChange={reportDirty}/>:<RegisterConfiguration onDirtyChange={reportDirty}/>}</div>;
}
