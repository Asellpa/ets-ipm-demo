import {Children,cloneElement,isValidElement,type CSSProperties,type ReactNode,type SelectHTMLAttributes} from 'react';
import {statusTone} from '../project-utils';
type Kind='status'|'priority';
const palette:Record<string,{backgroundColor:string;color:string}>=Object.fromEntries(['red','yellow','green','teal','purple','blue','neutral'].map(tone=>[tone,{backgroundColor:`var(--tone-${tone}-bg)`,color:`var(--tone-${tone}-fg)`}]));
export function optionTone(value:string,kind:Kind='status'){if(kind==='priority')return /^high$/i.test(value)?'red':/^low$/i.test(value)?'green':/^normal$/i.test(value)?'blue':'neutral';return !value||['all','Not Required','Draft','TBD'].includes(value)?'neutral':statusTone(value);}
export function ToneBadge({value,kind='status'}:{value:string;kind?:Kind}){return <span className="tone-badge" data-tone={optionTone(value,kind)} style={palette[optionTone(value,kind)]}>{value||'—'}</span>}
export default function ToneSelect({kind,children,className='',value,...props}:SelectHTMLAttributes<HTMLSelectElement>&{kind?:Kind}){
 const current=String(value??'');return <select {...props} value={value} className={(kind?'tone-select ':'')+className} data-tone={kind?optionTone(current,kind):undefined} style={kind?{...palette[optionTone(current,kind)],...props.style}:props.style}>{kind?Children.map(children,child=>{if(!isValidElement<{value?:string|number;children?:ReactNode;style?:CSSProperties}>(child)||child.type!=='option')return child;const option=String(child.props.value??child.props.children??'');return cloneElement(child,{style:{...palette[optionTone(option,kind)],...child.props.style}})}):children}</select>;
}
