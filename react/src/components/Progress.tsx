import {progress} from '../project-utils';import type {Task} from '../api';
export default function Progress({tasks}:{tasks:Task[]}){const p=progress(tasks);return <div className="task-progress"><div><span>{p.total?`${p.done}/${p.total} tasks complete`:'No applicable tasks'}</span><strong>{p.percent}%</strong></div><progress aria-label="Task progress" max={100} value={p.percent}/></div>}
