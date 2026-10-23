import {taskStatuses} from '../project-utils';
import TimeLog from '../components/TimeLog';
import ObjectAttachments from '../components/ObjectAttachments';
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { request, type Project, type Session, type Task } from '../api';
import type { ObjectField } from './WorkflowFieldsEditor';
type History = { action: string; comment: string; user: string; at: string };
export type WorkNode = {
  view?: 'fields' | 'departments' | 'hours';
  hours?: {estimate:number;actual:number};
  id: string;
  name: string;
  type: string;
  parent: string;
  completion: string;
  parallelWithPrevious: boolean;
  requiredFields: string[];
  fields: ObjectField[];
  requiresSignoff: boolean;
  signedOffBy?: string;
  signedOffAt?: string;
  status: string;
  values: Record<string, string>;
  completedBy?: string;
  completedAt?: string;
  decision?: string;
  notificationSentAt?: string;
  history: History[];
  blockers: string[];
  canEdit: boolean;
  canPlan?: boolean;
  canComplete: boolean;
  canReopen: boolean;
  tasks: string[];
};
type Instance = {
  name: string;
  workflowId: string;
  version: string;
  revision: number;
  nodes: WorkNode[];
  completed: number;
  total: number;
  isComplete: boolean;
};
function TaskRow({task,data,canUpdate,canLog,parentBusy,onSaved}:{task:Task;data:Session;canUpdate:boolean;canLog:boolean;parentBusy:boolean;onSaved:()=>Promise<void>}){
 const [busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function setStatus(status:string){setBusy(true);setError('');try{await request('/tasks/'+encodeURIComponent(task.id),{method:'PATCH',body:JSON.stringify({status})});await onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="linked-task"><div className="project-task-row"><div><strong>{task.title}</strong><small>{task.assignee} · {task.mhEstimate||0} estimated hours</small></div><label>Status<select aria-label={'Status for '+task.title} disabled={!canUpdate||busy||parentBusy} value={task.status||'To Do'} onChange={e=>void setStatus(e.target.value)}>{[...new Set([...taskStatuses,task.status||'To Do'])].map(status=><option key={status}>{status}</option>)}</select></label></div>{error&&<p className="error" role="alert">{error}</p>}{(canLog||!!task.timeEntries?.length)&&<TimeLog task={task} data={data} canLog={canLog} onSaved={onSaved}/>}</div>;
}
function ObjectDetails({
  node,
  instance,
  project,
  data,
  onChange,
  onDirtyChange,
  tools,
}: {
  node: WorkNode;
  instance: Instance;
  project: Project;
  data: Session;
  onChange: () => Promise<void>;
  onDirtyChange: (dirty:boolean) => void;
  tools?: ReactNode;
}) {
  const [values, setValues] = useState(node.values || {});
  const previousValues = useRef(JSON.stringify(node.values || {}));
  useEffect(() => {
    const previous = previousValues.current;
    setValues((current) => (JSON.stringify(current) === previous ? node.values || {} : current));
    previousValues.current = JSON.stringify(node.values || {});
  }, [node.values]);
  const [comment, setComment] = useState('');
  const [saved,setSaved]=useState(false);
  const changed=Object.entries(values).some(([key,value])=>value!==node.values[key]);
  useEffect(()=>{onDirtyChange(changed||!!comment.trim());return()=>onDirtyChange(false)},[changed,comment,onDirtyChange]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [assignee, setAssignee] = useState('Unassigned');
  const [estimate, setEstimate] = useState(0);
  const [existing, setExisting] = useState('');
  const linked = data.tasks.filter((t) => node.tasks.includes(t.id));
  const unlinked = data.tasks.filter(
    (t) => t.projectId === project.id && !t.workflowNodeId && Number(t.level || 3) >= 3,
  );
  async function mutate(action: string) {
    if (
      action === 'reopen' &&
      !window.confirm(
        'Reopen this object, its children, parents and dependent later work? Completed task records are retained.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(
        '/projects/' +
          encodeURIComponent(project.id) +
          '/workflow/nodes/' +
          encodeURIComponent(node.id),
        {
          method: 'PATCH',
          body: JSON.stringify({
            action,
            expectedRevision: instance.revision,
            ...(action === 'save' ? { values:Object.fromEntries(Object.entries(values).filter(([key,value])=>value!==node.values[key])) } : {}),
            comment,
          }),
        },
      );
      setComment('');setSaved(true);await onChange();
    } catch (e) {
      setError((e as Error).message);
      await onChange();
    } finally {
      setBusy(false);
    }
  }
  async function addTask(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          title: taskTitle,
          assignee,
          mhEstimate: estimate,
          workflowNodeId: node.id,
        }),
      });
      setTaskTitle('');
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function link() {
    if (!existing) return;
    setBusy(true);
    setError('');
    try {
      await request('/tasks/' + encodeURIComponent(existing), {
        method: 'PATCH',
        body: JSON.stringify({ workflowNodeId: node.id }),
      });
      setExisting('');
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const approval =
    ['approval', 'signoff'].includes(node.type) ||
    ['approval', 'signoff'].includes(node.completion);
  return (
    <section className="panel project-object" aria-label="Selected workflow object">
      <div className="toolbar">
        <div>
          <small>{node.type === 'stage' ? 'Lifecycle phase' : node.type}</small>
          <h2>{node.name}</h2>{node.view!=='hours'&&node.hours&&(node.hours.estimate>0||node.hours.actual>0)&&<p>{node.hours.estimate} estimated / {node.hours.actual} actual hours · Includes descendant tasks once</p>}
        </div>
        <span className={'object-status status-' + node.status.toLowerCase().replaceAll(' ', '-')}>
          {node.status}
        </span>
      </div>
      {node.status==='Pending'&&<p className="permission-note">Waiting for earlier objects to be signed off. Planning is available only with assignment and object edit access.</p>}
      {node.status==='In progress'&&!node.canEdit&&<p className="permission-note">This object is read-only with your access profile. Assigned tasks may still allow status updates and time logging.</p>}
      {tools}
      {node.fields.length > 0 && (
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate('save');
          }}
        >
          {node.fields.map((field,index) => (
            <Fragment key={field.id}>{field.section!==node.fields[index-1]?.section&&field.section&&<h3 className="object-field-section">{field.section}</h3>}<label>
              {field.label}
              {field.required ? ' *' : ''}
              {field.type==='users'&&<small className="field-help">Select one or more people. Use Ctrl or Command to select multiple names.</small>}
              {field.type==='user'||field.type==='users' ? (<select aria-label={field.label} multiple={field.type==='users'} disabled={!node.canEdit||field.canEdit===false||busy} value={field.type==='users'?(()=>{try{return JSON.parse(values[field.id]||'[]') as string[]}catch{return []}})():(values[field.id]||'')} onChange={e=>setValues(current=>({...current,[field.id]:field.type==='users'?JSON.stringify(Array.from(e.target.selectedOptions,o=>o.value)):e.target.value}))}>{field.type==='user'&&<option value="">Select team member…</option>}{data.users.filter(u=>u.resourceEnabled!==false).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>) : field.projectField === 'owner' ? (<select aria-label={field.label} disabled={!node.canEdit||field.canEdit===false||busy} value={values[field.id]||''} onChange={e=>setValues(current=>({...current,[field.id]:e.target.value}))}><option value="">Select owner…</option>{values[field.id]&&!data.users.some(u=>u.name===values[field.id])&&<option disabled value={values[field.id]}>{values[field.id]} (unavailable)</option>}{data.users.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select>) : field.type === 'textarea' ? (
                <textarea
                  aria-label={field.label}
                  disabled={!node.canEdit || field.canEdit===false || busy}
                  value={values[field.id] || ''}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, [field.id]: e.target.value }))
                  }
                />
              ) : field.type === 'select' ? (
                <select
                  aria-label={field.label}
                  disabled={!node.canEdit || field.canEdit===false || busy}
                  value={values[field.id] || ''}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, [field.id]: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {field.options?.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <input
                  aria-label={field.label}
                  type="checkbox"
                  disabled={!node.canEdit || field.canEdit===false || busy}
                  checked={values[field.id] === 'true'}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, [field.id]: String(e.target.checked) }))
                  }
                />
              ) : (
                <input
                  aria-label={field.label}
                  type={field.type}
                  min={field.type === 'date' ? '1900-01-01' : field.min}
                  max={field.type === 'date' ? '2100-12-31' : undefined}
                  step={field.type === 'number' ? 'any' : undefined}
                  disabled={!node.canEdit || field.canEdit===false || busy}
                  value={values[field.id] || ''}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, [field.id]: e.target.value }))
                  }
                />
              )}
            </label></Fragment>
          ))}
          {node.canEdit && <div className="form-actions"><button disabled={busy||!changed}>Save object fields</button>{saved&&!changed&&<span role="status">Object fields saved</span>}</div>}
        </form>
      )}
      {node.decision && <p role="status">Decision: {node.decision}</p>}
      {node.notificationSentAt && (
        <p role="status">
          In-app readiness notification recorded at{' '}
          {new Date(node.notificationSentAt).toLocaleString()}.
        </p>
      )}
      {node.requiresSignoff && !node.signedOffBy && (
        <p className="permission-note">
          Sign-off: assigned project manager or supervisor, after required work is complete.
        </p>
      )}
      {node.signedOffBy && (
        <p>
          Signed off by {node.signedOffBy}
          {node.signedOffAt ? ' on ' + new Date(node.signedOffAt).toLocaleString() : ''}.
        </p>
      )}
      {node.view!=='departments'&&<>      {(linked.length>0||((node.canEdit||node.canPlan)&&data.permissions.createTasks))&&<h3>Tasks for this object</h3>}
      {linked.length ? (
        linked.map((task) => (
          <TaskRow
            key={task.id + ':' + task.status + ':' + task.mhActual}
            task={task}
            data={data}
            parentBusy={busy}
            canLog={data.users.find(u=>u.name===data.user)?.resourceEnabled!==false && task.assignee === data.user && !!data.permissions.updateActualMH && !task.workflowLocked && !busy}
            canUpdate={!task.workflowLocked&&(!!data.permissions.assignTasks||task.assignee===data.user)}
            onSaved={onChange}
          />
        ))
      ) : (
        null
      )}
      {(node.canEdit || node.canPlan) && data.permissions.createTasks && (
        <details className="project-task-add">
          <summary>Add a task to this object</summary>
          <form className="editor" onSubmit={(e) => void addTask(e)}>
            <label>
              Task title
              <input
                required
                maxLength={200}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </label>
            <label>
              Assign to
              <select
                disabled={!data.permissions.assignTasks}
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option>Unassigned</option>
                {data.users.filter(u=>u.resourceEnabled!==false).map((u) => (
                  <option key={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label>
              Estimated hours
              <input
                type="number"
                min="0"
                step="0.25"
                value={estimate}
                onChange={(e) => setEstimate(Number(e.target.value))}
              />
            </label>
            <button disabled={busy || !taskTitle.trim()}>Create linked task</button>
          </form>
        </details>
      )}
      {(node.canEdit||node.canPlan) && data.permissions.assignTasks && unlinked.length > 0 && (
        <div className="project-link-task">
          <label>
            Link an existing task
            <select
              aria-label="Link an existing task"
              value={existing}
              onChange={(e) => setExisting(e.target.value)}
            >
              <option value="">Choose a task</option>
              {unlinked.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !existing} onClick={() => void link()}>
            Link task
          </button>
        </div>
      )}
      </>}
      {node.blockers.length > 0 && node.status === 'In progress' && (
        <div className="object-blockers">
          <strong>Before completing this object</strong>
          <ul>
            {node.blockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {node.status === 'Completed' && !node.signedOffBy && (
        <p>
          Completed by {node.completedBy}{' '}
          {node.completedAt ? 'on ' + new Date(node.completedAt).toLocaleString() : ''}.
        </p>
      )}
      {(node.canComplete || node.canReopen) && (
        <label className="project-comment">
          {node.canReopen
            ? 'Reason for reopening'
            : approval || node.requiresSignoff
              ? 'Approval / sign-off comment'
              : 'Completion comment (optional)'}
          <textarea
            aria-label="Workflow comment"
            maxLength={3000}
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
      )}
      <div className="form-actions">
        {node.canReopen && (
          <button disabled={busy || !comment.trim()} onClick={() => void mutate('reopen')}>
            Reopen object
          </button>
        )}
        {approval && node.canComplete && (
          <button disabled={busy || !comment.trim()} onClick={() => void mutate('reject')}>
            Reject
          </button>
        )}
        {(node.canComplete || (node.requiresSignoff && node.status !== 'Completed')) && (
          <button
            className="primary"
            disabled={
              busy || !node.canComplete ||
              ((approval || node.requiresSignoff) && !comment.trim()) ||
              Object.entries(values).some(([key, value]) => value !== node.values[key])
            }
            onClick={() => void mutate(node.requiresSignoff ? 'signoff' : 'complete')}
          >
            {node.requiresSignoff
              ? 'Sign off parent'
              : approval
                ? 'Approve and complete'
                : 'Mark complete'}
          </button>
        )}
      </div>
      {node.requiresSignoff && node.status !== 'Completed' && !node.canComplete && (
        <p className="muted">
          Completion requires the assigned project manager or supervisor, with Complete access for a normal child object or Approve access for a parent or approval.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ObjectAttachments key={project.id+node.id} projectId={project.id} nodeId={node.id} canEdit={node.canEdit&&!busy} canViewCommercial={!!data.permissions.viewCommercialFields} onChanged={onChange}/>
      {node.history?.length > 0 && (
        <details className="object-history">
          <summary>Object history ({node.history.length})</summary>
          {node.history.map((entry, i) => (
            <p key={i}>
              <strong>{entry.action}</strong> · {entry.user} · {new Date(entry.at).toLocaleString()}
              {entry.comment && <span> — {entry.comment}</span>}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
export default function ProjectWorkspace({
  project,
  initialNodeId,
  embedded,
  data,
  onBack,
  onRefresh,
  onDirtyChange,
  renderTools,
  linkedProjects,
}: {
  project: Project;
  initialNodeId?: string;
  embedded?: boolean;
  data: Session;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onDirtyChange?: (dirty:boolean) => void;
  renderTools?: (node:WorkNode,refresh:()=>Promise<void>) => ReactNode;
  linkedProjects?: ReactNode;
}) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(initialNodeId||'');
  const [showLinks,setShowLinks]=useState(false);const dirty=useRef(false);
  const reportDirty=useCallback((value:boolean)=>{dirty.current=value;onDirtyChange?.(value)},[onDirtyChange]);
  function navigate(id?:string){if(id===selected&&!showLinks)return;if(dirty.current&&!window.confirm('Discard unsaved object fields or comment?'))return;reportDirty(false);setShowLinks(!id);if(id)setSelected(id);const body=document.querySelector('.project-popup-body');if(body)body.scrollTop=0;}
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [template, setTemplate] = useState('');
  const [canAttach, setCanAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await request<{ workflow: Instance | null; canAttach: boolean }>(
      '/projects/' + encodeURIComponent(project.id) + '/workflow',
    );
    setInstance(previous=>JSON.stringify(previous)===JSON.stringify(result.workflow)?previous:result.workflow);
    setCanAttach(result.canAttach);
    setSelected((current) =>
      result.workflow?.nodes.some((n) => n.id === current)
        ? current
        : result.workflow?.nodes.find((n) => !n.parent)?.id ||
          result.workflow?.nodes[0]?.id ||
          '',
    );
    return result;
  }, [project.id]);
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const result=await load();
        if(!result.workflow&&result.canAttach){const catalog = await request<{ workflows: { id: string; name: string }[] }>(
          '/workflow-templates',
        );
        if (active) setTemplates(catalog.workflows);}
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void start();
    return () => {
      active = false;
    };
  }, [load]);
  const refresh = useCallback(async () => {
    await Promise.all([load(), onRefresh()]);
  }, [load, onRefresh]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if(document.hidden)return;
      const modal=document.querySelector('.project-popup[open]');if(modal?.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select'))return;
      void load().catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function attach() {
    setBusy(true);
    setError('');
    try {
      await request('/projects/' + encodeURIComponent(project.id) + '/workflow', {
        method: 'POST',
        body: JSON.stringify({ workflowId: template }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const ordered: WorkNode[] = [];
  function append(parent: string) {
    for (const item of instance?.nodes.filter((n) => (n.parent || '') === parent) || []) {
      ordered.push(item);
      append(item.id);
    }
  }
  append('');
  const node = instance?.nodes.find((n) => n.id === selected);
  const person = (id?: string) => data.users.find((u) => u.id === id)?.name || 'Unassigned';
  function depth(node: WorkNode) {
    let count = 0,
      current = node;
    const seen = new Set<string>();
    while (current.parent && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = instance?.nodes.find((n) => n.id === current.parent);
      if (!parent) break;
      count++;
      current = parent;
    }
    return Math.min(count, 6);
  }
  return (
    <>
      {!embedded&&<><div className="toolbar">
        <button onClick={onBack}>← Project register</button>
        <button
          disabled={busy}
          onClick={() => void refresh().catch((e) => setError((e as Error).message))}
        >
          Refresh project
        </button>
      </div>
      <section className={embedded?"embedded-project-summary":"panel project-summary"}>
        <div>
          <small>Project {project.wbs}</small>
          <h2>{project.title}</h2>
          <p>{project.client || 'Internal project'}</p>
        </div>
        <dl>
          <div>
            <dt>Project manager</dt>
            <dd>{person(project.managerId)}</dd>
          </div>
          <div>
            <dt>Supervisor</dt>
            <dd>{person(project.supervisorId)}</dd>
          </div>
          <div>
            <dt>Business status</dt>
            <dd>{project.stage}</dd>
          </div>
        </dl>
      </section></>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading project workflow…</p>
      ) : !instance ? error ? null : (
        <section className="panel">
          <h2>No workflow attached</h2>
          <p>
            This existing project has been preserved. Attach a workflow to begin tracking its
            objects; existing tasks remain available to link.
          </p>
          {canAttach && (
            <>
              <label>
                Project workflow
                <select
                  aria-label="Project workflow"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="">Default for project type</option>
                  {templates.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy} onClick={() => void attach()}>
                Attach workflow
              </button>
            </>
          )}
        </section>
      ) : (
        <>
          <div className="project-workflow-layout">
            <nav className="panel project-object-list" aria-label="Project workflow objects"><div className="workflow-nav-caption"><strong>{instance.name}</strong><small>{instance.isComplete?'Workflow complete':instance.completed+' / '+instance.total+' objects complete'}</small></div>
              {ordered.map((item) => (
                <button
                  key={item.id}
                  className={!showLinks&&selected === item.id ? 'selected' : ''}
                  style={{ paddingLeft: 12 + depth(item) * 16 }}
                  aria-label={item.name}
                  aria-current={!showLinks&&selected === item.id ? 'step' : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <span>{item.name}</span>
                  <small>
                    {item.status}
                    {item.parallelWithPrevious ? ' · Parallel' : ''}
                  </small>
                </button>
              ))}
              {linkedProjects&&<button className={'project-utility '+(showLinks?'selected':'')} aria-label="Linked projects" onClick={()=>navigate()}><span>Linked projects</span><small>Related records</small></button>}
              <details className="workflow-version"><summary>Workflow version</summary><p>{instance.version}</p><p>Object order, fields and access use this project’s saved configuration. Later template edits apply to new projects.</p></details>
            </nav>
            {showLinks? <section className="panel project-object">{linkedProjects}</section> : node ? (
              <ObjectDetails
                key={node.id + ':' + node.status}
                node={node}
                instance={instance}
                project={project}
                data={data}
                onChange={refresh}
                onDirtyChange={reportDirty}
                tools={renderTools?.(node,refresh)}
              />
            ) : (
              <section className="panel">
                <p>No workflow objects are visible with your access profile.</p>
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}
