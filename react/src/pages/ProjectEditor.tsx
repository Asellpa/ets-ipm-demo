import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request, type Project } from '../api';

type Field = { key: string; label: string; kind?: 'date' | 'textarea' };
const fields: Field[] = [
  { key: 'client', label: 'Client / department' },
  { key: 'owner', label: 'Project owner' },
  { key: 'aircraft', label: 'Aircraft' },
  { key: 'registration', label: 'Registration' },
  { key: 'releaseType', label: 'Release type' },
  { key: 'sector', label: 'Sector' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'scope', label: 'Scope', kind: 'textarea' },
  { key: 'startDate', label: 'Start date', kind: 'date' },
  { key: 'edd', label: 'Expected delivery date', kind: 'date' },
  { key: 'requiredInputs', label: 'Required inputs', kind: 'textarea' },
  { key: 'deliverables', label: 'Deliverables', kind: 'textarea' },
  { key: 'clientFocal', label: 'Client focal point' },
  { key: 'doaFocal', label: 'DOA focal point' },
  { key: 'site', label: 'Site' },
  { key: 'sage', label: 'SAGE reference' },
  { key: 'nreStatus', label: 'NRE status' },
  { key: 'remarks', label: 'Remarks', kind: 'textarea' },
];
const pricingFields = [
  { key: 'rom', label: 'ROM / pricing' },
  { key: 'poStatus', label: 'PO status' },
  { key: 'negotiationNotes', label: 'Negotiation notes' },
  { key: 'offerDetails', label: 'Offer details' },
  { key: 'agreementDetails', label: 'Agreement details' },
] as const;
export default function ProjectEditor({
  project,
  initialType,
  canCommercial,
  canEer,
  canViewCommercialFields,
  onSaved,
  onCancel,
  onConfigure,
}: {
  project?: Project;
  initialType?: string;
  canCommercial: boolean;
  canEer: boolean;
  canViewCommercialFields?: boolean;
  onSaved: (project?: Project) => Promise<void>;
  onCancel: () => void;
  onConfigure?: () => void;
}) {
  const [catalog, setCatalog] = useState<{
    protocolVersion?: number;
    defaultManagerId?: string;
    projectTypes?: { id: string; workflowId: string }[];
    workflows: { id: string; name: string; projectType?: string; description?: string }[];
    managers: { id: string; name: string }[];
  }>({ workflows: [], managers: [] });
  const [loaded, setLoaded] = useState(false);
  const [workflowId, setWorkflowId] = useState(project?.workflowId || '');
  const [managerId, setManagerId] = useState(project?.managerId || '');
  const [supervisorId, setSupervisorId] = useState(project?.supervisorId || '');
  const createType = useRef(project?.type || initialType || (canCommercial ? 'commercial' : 'internal_eer'));
  const existing = Boolean(project);
  useEffect(() => {
    let active = true;
    request<typeof catalog>('/workflow-templates')
      .then((result) => {
        if (active) {
          if (result.protocolVersion !== 2)
            throw new Error(
              'The backend is older than this project form. Pull the latest code and restart the backend on port 5174 before creating a project.',
            );
          setCatalog(result);
          setLoaded(true);
          if (!existing) {
            setWorkflowId(
              result.projectTypes?.find((t) => t.id === createType.current)?.workflowId ||
                result.workflows[0]?.id ||
                '',
            );
            setManagerId(result.defaultManagerId || '');
          }
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [existing]);
  const [type, setType] = useState(
    project?.type || initialType || (canCommercial ? 'commercial' : 'internal_eer'),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {
      title: project?.title || '',
      stage: project?.stage || '',
    };
    for (const field of fields)
      initial[field.key] = String(
        (project as unknown as Record<string, unknown> | undefined)?.[field.key] ?? '',
      );
    if (!project) initial.startDate = new Date().toISOString().slice(0, 10);
    for (const field of pricingFields)
      initial[field.key] = String(
        (project as unknown as { pricing?: Record<string, string> } | undefined)?.pricing?.[
          field.key
        ] ?? '',
      );
    return initial;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (values.startDate && values.edd && values.edd < values.startDate)
        throw new Error('Expected delivery date cannot precede start date');
      if (!loaded || (!catalog.workflows.some((w) => w.id === workflowId) && !project))
        throw new Error('Select an existing workflow before creating a project');
      if (!managerId && !supervisorId)
        throw new Error('Assign a project manager or supervisor for parent sign-off');
      const payload: Record<string, string> = {
        type,
        title: values.title.trim() || 'Untitled project',
        ...(!project
          ? { workflowId, managerId, supervisorId }
          : {
              ...(managerId !== project.managerId ? { managerId } : {}),
              ...(supervisorId !== project.supervisorId ? { supervisorId } : {}),
            }),
      };
      if (
        project &&
        project.workflowSchemaVersion !== 3 &&
        (canViewCommercialFields || type !== 'commercial')
      )
        payload.stage = values.stage;
      for (const field of project && project.workflowSchemaVersion !== 3 ? fields : [])
        if (field.key !== 'status' || canViewCommercialFields || type !== 'commercial')
          payload[field.key] = values[field.key] || '';
      if (
        project &&
        project.workflowSchemaVersion !== 3 &&
        type === 'commercial' &&
        canViewCommercialFields
      )
        for (const field of pricingFields) payload[field.key] = values[field.key] || '';
      const result = await request<{ project: Project }>(
        project ? '/projects/' + encodeURIComponent(project.id) : '/projects',
        { method: project ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      await onSaved(result.project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel editor" onSubmit={(e) => void submit(e)}>
      <h2>{project ? 'Edit project' : 'Create project'}</h2>
      <label>
        Project type
        <select
          aria-label="Project type"
          disabled={Boolean(project)}
          value={type}
          onChange={(e) => {
            createType.current = e.target.value;
            setType(e.target.value);
            setWorkflowId(
              catalog.projectTypes?.find((t) => t.id === e.target.value)?.workflowId || '',
            );
          }}
        >
          {canCommercial && <option value="commercial">Commercial RFQ</option>}
          {canEer && <option value="internal_eer">Internal EER</option>}
        </select>
      </label>
      <label>
        Workflow
        <select
          aria-label="Workflow"
          required
          disabled={Boolean(project) || !loaded}
          value={workflowId}
          onChange={(e) => setWorkflowId(e.target.value)}
        >
          <option value="">Select an existing workflow</option>
          {project?.workflowId && !catalog.workflows.some((w) => w.id === project.workflowId) && (
            <option value={project.workflowId}>Saved project workflow</option>
          )}
          {catalog.workflows.filter(w=>!w.projectType||w.projectType===type).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      {catalog.workflows.find(w=>w.id===workflowId)?.description&&<p className="field-help">{catalog.workflows.find(w=>w.id===workflowId)?.description}</p>}
      <p className="field-help">
        Create the record here, then fill in its configured object pages. All workflow fields start
        blank. Each parent requires manager or supervisor sign-off.
      </p>
      <label>
        Project manager
        <select
          aria-label="Project manager"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
        >
          <option value="">Select a manager</option>
          {catalog.managers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Project supervisor
        <select
          aria-label="Project supervisor"
          value={supervisorId}
          onChange={(e) => setSupervisorId(e.target.value)}
        >
          <option value="">Unassigned</option>
          {catalog.managers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Record name (optional)
        <input
          maxLength={200}
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
      {project && project.workflowSchemaVersion !== 3 && (
        <>
          {' '}
          <label>
            Stage
            <input
              disabled={type === 'commercial' && !canViewCommercialFields}
              value={values.stage}
              onChange={(e) => set('stage', e.target.value)}
            />
          </label>
          <h3>Project details</h3>
          {fields.map((field) => (
            <label key={field.key}>
              {field.label}
              {field.kind === 'textarea' ? (
                <textarea
                  value={values[field.key] || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              ) : (
                <input
                  disabled={
                    field.key === 'status' && type === 'commercial' && !canViewCommercialFields
                  }
                  type={field.kind === 'date' ? 'date' : 'text'}
                  min={
                    field.kind === 'date'
                      ? field.key === 'edd' && values.startDate
                        ? values.startDate
                        : '1900-01-01'
                      : undefined
                  }
                  max={field.kind === 'date' ? '2100-12-31' : undefined}
                  value={values[field.key] || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
            </label>
          ))}
          {type === 'commercial' && canViewCommercialFields && (
            <>
              <h3>Restricted commercial information</h3>
              {pricingFields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <textarea
                    value={values[field.key] || ''}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                </label>
              ))}
            </>
          )}
        </>
      )}
      {!catalog.workflows.length && loaded && (
        <p role="alert">A workflow must be created before you can create a project.</p>
      )}
      {onConfigure && (
        <button type="button" onClick={onConfigure}>
          Configure workflows first
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !loaded || (!project && !workflowId) || (!managerId && !supervisorId)}
        >
          {busy ? 'Saving…' : 'Save project'}
        </button>
      </div>
    </form>
  );
}
