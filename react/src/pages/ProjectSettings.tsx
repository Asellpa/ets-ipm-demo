import {ProjectTypes,WorkCalendar,TaskCompletionRules} from './BusinessSettings';
import {useCallback,useRef,useState} from 'react';
import Configuration from './Configuration';
import RegisterConfiguration from './RegisterConfiguration';
import FieldPermissions from './FieldPermissions';
export default function ProjectSettings(){
 const[tab,setTab]=useState('workflows');const dirty=useRef(false);const reportDirty=useCallback((value:boolean)=>{dirty.current=value},[]);
 function select(next:string){if(next===tab)return;if((dirty.current||!!document.querySelector('[data-unsaved=true]'))&&!window.confirm('Discard unsaved settings before switching sections?'))return;dirty.current=false;setTab(next)}
 return <div className="project-settings"><nav className="tabs settings-tabs" aria-label="Project settings sections">{[['workflows','Workflows'],['permissions','Field permissions'],['register','Register configuration'],['types','Project types'],['calendar','Working calendar'],['completion','Task rules']].map(([id,label])=><button key={id} className={tab===id?'selected':''} aria-pressed={tab===id} onClick={()=>select(id)}>{label}</button>)}</nav>{tab==='workflows'?<Configuration onDirtyChange={reportDirty}/>:tab==='permissions'?<FieldPermissions onDirtyChange={reportDirty}/>:tab==='types'?<ProjectTypes/>:tab==='completion'?<TaskCompletionRules/>:tab==='calendar'?<WorkCalendar/>:<RegisterConfiguration onDirtyChange={reportDirty}/>}</div>;
}
