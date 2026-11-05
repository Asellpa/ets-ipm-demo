import {useState} from 'react';
import guides from '../help-content.json';
export default function UserGuide(){
 const[search,setSearch]=useState('');const[category,setCategory]=useState('All topics');
 const categories=['All topics',...new Set(guides.map(g=>g.category))];
 const query=search.trim().toLocaleLowerCase(),filtered=guides.filter(g=>(category==='All topics'||g.category===category)&&[g.title,g.summary,...g.steps].join(' ').toLocaleLowerCase().includes(query));
 return <section className="panel user-guide" aria-labelledby="user-guide-title"><div className="about-section-title"><h2 id="user-guide-title">User guide</h2><span>{filtered.length} {filtered.length===1?'topic':'topics'}</span></div><div className="help-filters"><label>Search guides<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Try sign-off, time, permissions…"/></label><label>Topic<select aria-label="Topic" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div><div className="about-faq">{filtered.map(g=><details key={g.id}><summary>{g.title}<span aria-hidden="true">+</span></summary><p className="muted">{g.summary}</p><ol>{g.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></details>)}</div>{!filtered.length&&<div className="empty"><h3>No matching guides</h3><p>Try another search or choose All topics.</p><button onClick={()=>{setSearch('');setCategory('All topics')}}>Clear filters</button></div>}</section>
}
