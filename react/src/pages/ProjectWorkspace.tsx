import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { request, type Project, type Session, type Task } from '../api';
type History = { action: string; comment: string; user: string; at: string };
type WorkNode = {
  id: string;
  name: string;
  type: string;
  parent: string;
  completion: string;
  parallelWithPrevious: boolean;
  requiredFields: string[];
  status: string;
  values: Record<string, string>;
  completedBy?: string;
  completedAt?: string;
  decision?: string;
  notificationSentAt?: string;
  history: History[];
  blockers: string[];
  canEdit: boolean;
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
function TaskRow({
  task,
  canAssign,
  canUpdate,
  onSaved,
}: {
  task: Task;
  canAssign: boolean;
  canUpdate: boolean;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState(task.status || 'To Do');
  const [actual, setActual] = useState(Number(task.mhActual || 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/tasks/' + encodeURIComponent(task.id), {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(canUpdate ? { mhActual: actual } : {}) }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="project-task-row" onSubmit={(e) => void save(e)}>
      <div>
        <strong>{task.title}</strong>
        <small>
          {task.assignee} · {task.mhEstimate || 0} estimated hours · {task.status}
        </small>
      </div>
      {(canAssign || canUpdate) && (
        <>
          <label>
            Status
            <select
              aria-label={'Status for ' + task.title}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['To Do', 'Assigned', 'In Progress', 'DOA - Review', 'TL - Review', 'Completed'].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          {canUpdate && (
            <label>
              Actual hours
              <input
                aria-label={'Actual hours for ' + task.title}
                type="number"
                min="0"
                step="0.25"
                value={actual}
                onChange={(e) => setActual(Number(e.target.value))}
              />
            </label>
          )}
          <button disabled={busy}>Save task</button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error} Use Tasks &amp; Work Packages to record any required overrun flag and reason.
        </p>
      )}
    </form>
  );
}
function ObjectDetails({
  node,
  instance,
  project,
  data,
  onChange,
}: {
  node: WorkNode;
  instance: Instance;
  project: Project;
  data: Session;
  onChange: () => Promise<void>;
}) {
  const [values, setValues] = useState(node.values || {});
  const [comment, setComment] = useState('');
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
            ...(action === 'save' ? { values } : {}),
            comment,
          }),
        },
      );
      await onChange();
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
          <h2>{node.name}</h2>
        </div>
        <span className={'object-status status-' + node.status.toLowerCase().replaceAll(' ', '-')}>
          {node.status}
        </span>
      </div>
      <p className="muted">
        {node.parallelWithPrevious
          ? 'Runs in parallel with the previous sibling.'
          : 'Runs after the previous sibling group.'}{' '}
        Child objects and linked tasks must be complete before this object can finish.
      </p>
      {node.requiredFields.length > 0 && (
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate('save');
          }}
        >
          {node.requiredFields.map((field) => (
            <label key={field}>
              {field}
              <textarea
                aria-label={field}
                disabled={!node.canEdit || busy}
                value={values[field] || ''}
                onChange={(e) => setValues((current) => ({ ...current, [field]: e.target.value }))}
              />
            </label>
          ))}
          {node.canEdit && <button disabled={busy}>Save object fields</button>}
        </form>
      )}
      {node.decision && <p role="status">Decision: {node.decision}</p>}
      {node.notificationSentAt && (
        <p role="status">
          In-app readiness notification recorded at{' '}
          {new Date(node.notificationSentAt).toLocaleString()}.
        </p>
      )}
      <h3>Linked tasks</h3>
      {linked.length ? (
        linked.map((task) => (
          <TaskRow
            key={task.id + ':' + task.status + ':' + task.mhActual}
            task={task}
            canAssign={node.canEdit && !!data.permissions.assignTasks}
            canUpdate={
              !task.workflowLocked &&
              node.status === 'In progress' &&
              !!data.permissions.updateActualMH &&
              (!!data.permissions.assignTasks || task.assignee === data.user)
            }
            onSaved={onChange}
          />
        ))
      ) : (
        <p className="muted">No tasks linked to this object.</p>
      )}
      {node.canEdit && data.permissions.createTasks && (
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
                {data.users.map((u) => (
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
      {node.canEdit && data.permissions.assignTasks && unlinked.length > 0 && (
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
      {node.status === 'Completed' && (
        <p>
          Completed by {node.completedBy}{' '}
          {node.completedAt ? 'on ' + new Date(node.completedAt).toLocaleString() : ''}.
        </p>
      )}
      {(node.canComplete || node.canReopen || (approval && node.canEdit)) && (
        <label className="project-comment">
          {node.canReopen
            ? 'Reason for reopening'
            : approval
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
        {node.canComplete && (
          <button
            className="primary"
            disabled={
              busy ||
              (approval && !comment.trim()) ||
              Object.entries(values).some(([key, value]) => value !== node.values[key])
            }
            onClick={() => void mutate('complete')}
          >
            {approval ? 'Approve and complete' : 'Mark complete'}
          </button>
        )}
      </div>
      {node.status === 'In progress' && !node.canComplete && !node.blockers.length && (
        <p className="muted">
          Completion requires the assigned project manager or supervisor and sufficient workflow
          access.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
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
  data,
  onBack,
  onRefresh,
}: {
  project: Project;
  data: Session;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [template, setTemplate] = useState('');
  const [canAttach, setCanAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await request<{ workflow: Instance | null; canAttach: boolean }>(
      '/projects/' + encodeURIComponent(project.id) + '/workflow',
    );
    setInstance(result.workflow);
    setCanAttach(result.canAttach);
    setSelected((current) =>
      result.workflow?.nodes.some((n) => n.id === current)
        ? current
        : result.workflow?.nodes.find((n) => n.status === 'In progress')?.id ||
          result.workflow?.nodes[0]?.id ||
          '',
    );
  }, [project.id]);
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        await load();
        const catalog = await request<{ workflows: { id: string; name: string }[] }>(
          '/workflow-templates',
        );
        if (active) setTemplates(catalog.workflows);
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
      <div className="toolbar">
        <button onClick={onBack}>← Project register</button>
        <button
          disabled={busy}
          onClick={() => void refresh().catch((e) => setError((e as Error).message))}
        >
          Refresh project
        </button>
      </div>
      <section className="panel project-summary">
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
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading project workflow…</p>
      ) : !instance ? (
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
          <div className="panel project-workflow-header">
            <div>
              <h2>{instance.name}</h2>
              <p className="muted">
                Saved version {instance.version} · {instance.completed} of {instance.total} visible
                objects complete
              </p>
            </div>
            <strong>
              {instance.isComplete
                ? 'Workflow complete'
                : instance.nodes
                    .filter((n) => !n.parent && n.status === 'In progress')
                    .map((n) => n.name)
                    .join(' + ') || 'Work in progress'}
            </strong>
          </div>
          <div className="project-workflow-layout">
            <nav className="panel project-object-list" aria-label="Project workflow objects">
              {ordered.map((item) => (
                <button
                  key={item.id}
                  className={selected === item.id ? 'selected' : ''}
                  style={{ paddingLeft: 12 + depth(item) * 16 }}
                  aria-current={selected === item.id ? 'step' : undefined}
                  onClick={() => setSelected(item.id)}
                >
                  <span>{item.name}</span>
                  <small>
                    {item.status}
                    {item.parallelWithPrevious ? ' · Parallel' : ''}
                  </small>
                </button>
              ))}
            </nav>
            {node ? (
              <ObjectDetails
                key={
                  node.id +
                  ':' +
                  Object.entries(node.values || {})
                    .map(([k, v]) => k + v)
                    .join('|') +
                  ':' +
                  node.status
                }
                node={node}
                instance={instance}
                project={project}
                data={data}
                onChange={refresh}
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
