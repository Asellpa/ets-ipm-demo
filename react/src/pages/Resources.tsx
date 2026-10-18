import {useEffect,useState,type FormEvent} from 'react';
import {request,type Session} from '../api';
type Cell={date:string;booked:number;capacity:number;free:number;leave:string};
type Capacity={start:string;days:number;rows:{user:string;position?:string;capacity:number;cells:Cell[]}[]};
export default function Resources({data}:{data:Session}){
 const[start,setStart]=useState(()=>new Date().toISOString().slice(0,10));
 const[days,setDays]=useState(7);
 const[capacity,setCapacity]=useState<Capacity|null>(null);
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const[user,setUser]=useState(data.users[0]?.name||'');
 const[date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
 const[type,setType]=useState('Leave');
 const[note,setNote]=useState('');
 const[leave,setLeave]=useState(data.leave);const[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;request<Capacity>('/capacity?start='+encodeURIComponent(start)+'&days='+days).then(result=>{if(active){setCapacity(result);setError('')}}).catch(err=>{if(active)setError((err as Error).message)});return()=>{active=false}},[start,days,refresh]);
 async function addLeave(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await request('/leave',{method:'POST',body:JSON.stringify({user,date,type,note})});setRefresh(x=>x+1);setNote('');const next=await request<Session>('/bootstrap');setLeave(next.leave)}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
 return <div className="panel">
  <h2>Daily resource capacity</h2>
  <div className="toolbar"><label>Start date<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Days<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7</option><option value={14}>14</option><option value={30}>30</option></select></label></div>
  {error&&<p role="alert" className="error">{error}</p>}
  {!capacity?<p>Loading capacity…</p>:<div style={{overflowX:'auto'}}><table><thead><tr><th>Team member</th>{capacity.rows[0]?.cells.map(c=><th key={c.date}>{c.date}</th>)}</tr></thead><tbody>{capacity.rows.map(row=><tr key={row.user}><th>{row.user}</th>{row.cells.map(c=><td key={c.date} title={'Booked '+c.booked+' MH; Capacity '+c.capacity+' MH; Free '+c.free+' MH'}>{c.leave?<strong>{c.leave}</strong>:<span>{c.booked}/{c.capacity} MH{c.booked>c.capacity?' (Overbooked)':''}<small> · Free {c.free} MH</small></span>}</td>)}</tr>)}</tbody></table></div>}
  <p>Cells show booked / available man-hours. Leave days are labelled; weekends have zero capacity.</p>
  {data.permissions.manageLeave&&<form className="editor" onSubmit={e=>void addLeave(e)}><h3>Record leave</h3><label>Team member<select aria-label="Team member" required value={user} onChange={e=>setUser(e.target.value)}>{data.users.filter(u=>u.active!==false).map(u=><option key={u.id}>{u.name}</option>)}</select></label><label>Leave date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Leave type<select value={type} onChange={e=>setType(e.target.value)}><option>Leave</option><option>Sick leave</option><option>Training</option><option>Unavailable</option></select></label><label>Note<input value={note} onChange={e=>setNote(e.target.value)}/></label><button disabled={busy||!user} type="submit">Save leave</button></form>}{data.permissions.manageLeave&&<section><h3>Recorded leave</h3>{leave.map(l=><p key={l.id}>{l.user} · {l.date} · {l.type} <button disabled={busy} onClick={async()=>{setBusy(true);try{await request('/leave/'+l.id,{method:'DELETE'});setLeave(current=>current.filter(x=>x.id!==l.id));setRefresh(x=>x+1)}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}>Remove leave</button></p>)}</section>}
 </div>;
}

