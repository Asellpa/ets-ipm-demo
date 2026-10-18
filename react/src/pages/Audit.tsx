import {useState} from 'react';
import type {Session} from '../api';
type Entry={id:string;ts:string;user:string;text:string;entityType?:string;projectId?:string;changes?:{field:string;from:unknown;to:unknown}[]};
export default function Audit({data}:{data:Session}){
 const[search,setSearch]=useState('');const[from,setFrom]=useState('');const[to,setTo]=useState('');const rows=(data.audit as Entry[]).filter(a=>(!search||`${a.user} ${a.text} ${a.entityType}`.toLowerCase().includes(search.toLowerCase()))&&(!from||a.ts.slice(0,10)>=from)&&(!to||a.ts.slice(0,10)<=to));
 return <section className="panel"><h2>Audit history</h2><div className="toolbar"><label>Search audit<input value={search} onChange={e=>setSearch(e.target.value)}/></label><label>From date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To date<input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label></div><table><thead><tr><th>When</th><th>User</th><th>Action / changes</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td>{new Date(a.ts).toLocaleString()}</td><td>{a.user}</td><td>{a.text}{a.changes?.length?<details><summary>Changed fields</summary>{a.changes.map(c=><p key={c.field}>{c.field}: {JSON.stringify(c.from)} → {JSON.stringify(c.to)}</p>)}</details>:null}</td></tr>)}</tbody></table>{!rows.length&&<p>No matching audit events.</p>}</section>
}
