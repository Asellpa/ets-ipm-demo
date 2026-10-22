export type ObjectField = {
  section?: string;
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox';
  required: boolean;
  dataGroup?: 'general' | 'commercial';
  options?: string[];
  projectField?: string;
  min?: number;
};
const presets: Omit<ObjectField, 'id'>[] = [
  { label: 'Project name', type: 'text', required: true, projectField: 'title' },
  { label: 'Start date', type: 'date', required: true, projectField: 'startDate' },
  { label: 'Scope', type: 'textarea', required: true, projectField: 'scope' },
  { label: 'Client / department', type: 'text', required: false, projectField: 'client' },
  { label: 'Expected delivery date', type: 'date', required: false, projectField: 'edd' },
  { label: 'Aircraft', type: 'text', required: false, projectField: 'aircraft' },
  { label: 'Registration', type: 'text', required: false, projectField: 'registration' },
  {
    label: 'Release type',
    type: 'select',
    required: false,
    projectField: 'releaseType',
    options: ['EASA', 'GCAA', 'CoC'],
  },
  {
    label: 'Sector',
    type: 'select',
    required: false,
    projectField: 'sector',
    options: ['21J', '21G', '145'],
  },
  { label: 'Required inputs', type: 'textarea', required: false, projectField: 'requiredInputs' },
  { label: 'Deliverables', type: 'textarea', required: false, projectField: 'deliverables' },
  { label: 'Team members', type: 'textarea', required: true },
  { label: 'Supervision and responsibilities', type: 'textarea', required: true },
  { label: 'Estimated hours', type: 'number', required: false, min: 0 },
  { label: 'Budget estimate', type: 'number', required: false, min: 0, dataGroup: 'commercial' },
  {
    label: 'ROM / pricing',
    type: 'textarea',
    required: false,
    dataGroup: 'commercial',
    projectField: 'rom',
  },
  {
    label: 'PO status',
    type: 'text',
    required: false,
    dataGroup: 'commercial',
    projectField: 'poStatus',
  },
  {
    label: 'Negotiation notes',
    type: 'textarea',
    required: false,
    dataGroup: 'commercial',
    projectField: 'negotiationNotes',
  },
  {
    label: 'Offer details',
    type: 'textarea',
    required: false,
    dataGroup: 'commercial',
    projectField: 'offerDetails',
  },
  {
    label: 'Agreement details',
    type: 'textarea',
    required: false,
    dataGroup: 'commercial',
    projectField: 'agreementDetails',
  },
  { label: 'Remarks', type: 'textarea', required: false, projectField: 'remarks' },
];
export function fieldsForNode(node: {
  fields?: ObjectField[];
  requiredFields?: string[];
}): ObjectField[] {
  return (
    node.fields ??
    (node.requiredFields || []).map((label) => ({
      id: label,
      label,
      type: 'textarea',
      required: true,
      dataGroup: 'general',
    }))
  );
}
export default function WorkflowFieldsEditor({
  name,
  fields,
  parent,
  onChange,
}: {
  name: string;
  fields: ObjectField[];
  parent: boolean;
  onChange: (fields: ObjectField[]) => void;
}) {
  function update(id: string, change: Partial<ObjectField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...change } : f)));
  }
  return (
    <section className="workflow-field-builder" aria-label="Object form designer">
      <div className="toolbar">
        <div>
          <h3>{name} — object form</h3>
          <p className="muted">
            Define the fields users fill in on this page after creating a project. Template fields
            contain no project data.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...fields,
              {
                id: crypto.randomUUID(),
                label: 'New field',
                type: 'text',
                required: false,
                dataGroup: 'general',
              },
            ])
          }
        >
          + Custom field
        </button>
      </div>
      {parent && (
        <p className="permission-note">
          Parent sign-off is compulsory. Only this project's assigned manager or supervisor can sign
          it off after its required fields, tasks and children are complete.
        </p>
      )}
      <label>
        Add a standard field
        <select
          aria-label="Add a standard field"
          value=""
          onChange={(e) => {
            const preset = presets[Number(e.target.value)];
            if (preset)
              onChange([
                ...fields,
                { ...preset, id: crypto.randomUUID(), dataGroup: preset.dataGroup || 'general' },
              ]);
          }}
        >
          <option value="">Choose a field…</option>
          {presets.map((f, i) => (
            <option
              key={i}
              value={i}
              disabled={
                !!f.projectField &&
                fields.some((current) => current.projectField === f.projectField)
              }
            >
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-builder-layout">
        <div>
          {!fields.length && <p>No fields configured. Add standard fields or create your own.</p>}
          {fields.map((f, index) => (
            <article className="field-definition" key={f.id}>
              <div className="field-definition-grid">
                <label>
                  Field label
                  <input
                    aria-label={'Field label ' + (index + 1)}
                    maxLength={120}
                    value={f.label}
                    onChange={(e) => update(f.id, { label: e.target.value })}
                  />
                </label>
                <label>Section<input aria-label={'Field section '+(index+1)} value={f.section||''} maxLength={120} onChange={e=>update(f.id,{section:e.target.value})}/></label>
                <label>
                  Field type
                  <select
                    aria-label={'Field type ' + (index + 1)}
                    value={f.type}
                    onChange={(e) => {
                      const type = e.target.value as ObjectField['type'];
                      update(f.id, {
                        type,
                        options:
                          type === 'select' ? f.options || ['Option 1', 'Option 2'] : undefined,
                        min: type === 'number' ? f.min : undefined,
                      });
                    }}
                  >
                    {['text', 'textarea', 'date', 'number', 'select', 'checkbox'].map((type) => (
                      <option key={type} value={type}>
                        {
                          {
                            text: 'Text',
                            textarea: 'Long text',
                            date: 'Date',
                            number: 'Number',
                            select: 'Choice list',
                            checkbox: 'Checkbox',
                          }[type]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-required">
                  <input
                    type="checkbox"
                    aria-label={'Required field ' + (index + 1)}
                    checked={f.required}
                    onChange={(e) => update(f.id, { required: e.target.checked })}
                  />
                  Required
                </label>
                <label>
                  Visibility
                  <select
                    aria-label={'Field visibility ' + (index + 1)}
                    value={f.dataGroup || 'general'}
                    disabled={[
                      'rom',
                      'poStatus',
                      'negotiationNotes',
                      'offerDetails',
                      'agreementDetails',
                    ].includes(f.projectField || '')}
                    onChange={(e) =>
                      update(f.id, { dataGroup: e.target.value as ObjectField['dataGroup'] })
                    }
                  >
                    <option value="general">Object permissions</option>
                    <option value="commercial">Restricted commercial / pricing</option>
                  </select>
                </label>
              </div>
              {f.type === 'select' && (
                <label>
                  Choices (one per line)
                  <textarea
                    key={f.id + 'options'}
                    aria-label="Choices (one per line)"
                    defaultValue={(f.options || []).join('\n')}
                    onBlur={(e) =>
                      update(f.id, {
                        options: e.target.value
                          .split('\n')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              )}
              {f.type === 'number' && (
                <label>
                  Minimum (optional)
                  <input
                    type="number"
                    value={f.min ?? ''}
                    onChange={(e) =>
                      update(f.id, {
                        min: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
              <p className="field-help">
                {f.projectField
                  ? 'Also updates ' +
                    (presets.find((p) => p.projectField === f.projectField)?.label ||
                      f.projectField) +
                    ' in the project register.'
                  : 'Saved on this object only.'}
              </p>
              <div className="button-group">
                <button
                  type="button"
                  aria-label={'Move field ' + (index + 1) + ' up'}
                  disabled={!index}
                  onClick={() => {
                    const next = [...fields];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    onChange(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={'Move field ' + (index + 1) + ' down'}
                  disabled={index === fields.length - 1}
                  onClick={() => {
                    const next = [...fields];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    onChange(next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(fields.filter((field) => field.id !== f.id))}
                >
                  Remove field
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="object-form-preview" aria-hidden="true">
          <h4>Blank page preview</h4>
          {fields.map((f) => (
            <label key={f.id}>
              {f.label}
              {f.required ? ' *' : ''}
              {f.type === 'textarea' ? (
                <textarea disabled placeholder="Fill in after project creation" />
              ) : f.type === 'select' ? (
                <select disabled>
                  <option>Select…</option>
                  {f.options?.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  disabled
                  type={
                    f.type === 'checkbox'
                      ? 'checkbox'
                      : f.type === 'date'
                        ? 'date'
                        : f.type === 'number'
                          ? 'number'
                          : 'text'
                  }
                  placeholder="Fill in after project creation"
                />
              )}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
