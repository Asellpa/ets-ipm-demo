import ClientContacts from '../components/ClientContacts';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { request, type Project, type Session } from '../api';
import ProjectPopup from './ProjectPopup';
type Client = {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
  revision: number;
  canDelete: boolean;
  estimatedHours: number;
  actualHours: number;
  projectCount: number;
  projects: Project[];
};
type Draft = {
  id?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
  revision?: number;
};
const blank: Draft = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  active: true,
};
export default function Clients({
  data,
  onRefresh,
}: {
  data: Session;
  onRefresh: () => Promise<void>;
}) {
  const [clients, setClients] = useState<Client[]>([]),
    [draft, setDraft] = useState<Draft | null>(null),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [contactBusy, setContactBusy] = useState(false),
    [opened, setOpened] = useState(''),
    [legacyProject, setLegacyProject] = useState('');
  const locked = busy || contactBusy;
  const load = useCallback(async () => {
    const r = await request<{ clients: Client[] }>('/clients');
    setClients(r.clients);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError((e as Error).message));
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const { client } = await request<{ client: Client }>(
        '/clients' + (draft.id ? '/' + draft.id : ''),
        {
          method: draft.id ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...draft, expectedRevision: draft.revision }),
        },
      );
      await load();
      await onRefresh();
      setDraft(null);
      setSelected(client.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Client) {
    if (
      locked ||
      !c.canDelete ||
      !window.confirm('Delete ' + c.name + ' and its focal contacts? This cannot be undone.')
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('/clients/' + c.id, {
        method: 'DELETE',
        body: JSON.stringify({ expectedRevision: c.revision }),
      });
      if (selected === c.id) setSelected('');
      await Promise.all([load(), onRefresh()]);
      setMessage('Client deleted.');
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const client = clients.find((c) => c.id === selected);
  const visibleClients = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const discardContacts = () =>
    !document.querySelector('[data-unsaved=true]') ||
    window.confirm('Discard unsaved contact details?');
  return (
    <>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft ? (
        <form data-unsaved="true" className="panel editor" onSubmit={(e) => void save(e)}>
          <h2>{draft.id ? 'Edit client' : 'Create client'}</h2>
          {(['name', 'contact', 'email', 'phone', 'address', 'notes'] as const).map((key) => (
            <label key={key}>
              {
                {
                  name: 'Client name',
                  contact: 'Contact person',
                  email: 'Email',
                  phone: 'Phone',
                  address: 'Address',
                  notes: 'Notes',
                }[key]
              }
              {key === 'notes' || key === 'address' ? (
                <textarea
                  disabled={locked}
                  maxLength={2000}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ) : (
                <input
                  disabled={locked}
                  required={key === 'name'}
                  type={key === 'email' ? 'email' : 'text'}
                  maxLength={key === 'name' ? 160 : 2000}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <label>
            <input
              disabled={locked}
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Active client
          </label>
          <p className="field-help">
            Archived clients keep their project links and history; they cannot be selected for new
            links.
          </p>
          <div className="form-actions">
            <button type="button" disabled={locked} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="primary" disabled={locked}>
              Save client
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="toolbar">
            <input
              aria-label="Search clients"
              placeholder="Search clients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {data.permissions.manageClients && (
              <button
                className="primary"
                disabled={locked}
                onClick={() => {
                  if (!discardContacts()) return;
                  setDraft({ ...blank });
                  setError('');
                  setMessage('');
                }}
              >
                + New client
              </button>
            )}
          </div>
          <div className="panel">
            <p className="muted">
              Select a client to review its contacts, linked projects and task hours.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Projects</th>
                  <th scope="col">Estimated hours</th>
                  <th scope="col">Actual hours</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        disabled={locked}
                        onClick={() => {
                          if (
                            document.querySelector('[data-unsaved=true]') &&
                            !window.confirm('Discard unsaved contact details?')
                          )
                            return;
                          setSelected(c.id);
                        }}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td>{c.projectCount}</td>
                    <td>{c.estimatedHours}</td>
                    <td>{c.actualHours}</td>
                    <td>{c.active ? 'Active' : 'Archived'}</td>
                    <td>
                      {data.permissions.manageClients && (
                        <div className="button-group">
                          <button
                            disabled={locked}
                            onClick={() => {
                              if (!discardContacts()) return;
                              setSelected(c.id);
                              setDraft({ ...blank, ...c });
                              setError('');
                              setMessage('');
                            }}
                          >
                            Edit client
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={locked || !c.canDelete}
                            title={
                              c.canDelete
                                ? 'Delete this unused client and its focal contacts'
                                : 'Linked clients must be archived using Edit client'
                            }
                            onClick={() => void remove(c)}
                          >
                            Delete client
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleClients.length && (
              <p>
                {clients.length
                  ? 'No clients match your search.'
                  : data.permissions.manageClients
                    ? 'No client profiles yet. Choose + New client to add one.'
                    : 'No client profiles yet. An administrator can create the first client.'}
              </p>
            )}
          </div>
          {client && (
            <section className="panel" aria-label="Client profile">
              <div className="toolbar">
                <h2>{client.name}</h2>
                <button
                  disabled={locked}
                  onClick={() => {
                    if (
                      document.querySelector('[data-unsaved=true]') &&
                      !window.confirm('Discard unsaved contact details?')
                    )
                      return;
                    setSelected('');
                  }}
                >
                  Close client
                </button>
              </div>
              <dl className="client-contact">
                <dt>Contact</dt>
                <dd>{client.contact || '—'}</dd>
                <dt>Email</dt>
                <dd>{client.email || '—'}</dd>
                <dt>Phone</dt>
                <dd>{client.phone || '—'}</dd>
                <dt>Address</dt>
                <dd>{client.address || '—'}</dd>
              </dl>
              {client.notes && <p>{client.notes}</p>}
              <ClientContacts
                key={client.id}
                clientId={client.id}
                canManage={!!data.permissions.manageClientContacts}
                onSaved={load}
                onBusyChange={setContactBusy}
              />
              {data.permissions.manageClients && !client.canDelete && (
                <p className="field-help">
                  This client is linked to project records. Use Edit client to archive it and retain
                  project history.
                </p>
              )}
              <h3>Projects for this client</h3>
              {data.permissions.manageClients &&
                data.permissions.editProjects &&
                client.active &&
                data.projects.some(
                  (p) =>
                    !p.clientId &&
                    p.client?.toLowerCase() === client.name.toLowerCase() &&
                    !['hidden', 'view'].includes(p.fieldAccess?.client || ''),
                ) && (
                  <form
                    className="toolbar"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError('');
                      try {
                        await request('/clients/' + client.id + '/link-project', {
                          method: 'POST',
                          body: JSON.stringify({ projectId: legacyProject }),
                        });
                        setLegacyProject('');
                        await load();
                        await onRefresh();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Link matching legacy project
                      <select
                        aria-label="Link matching legacy project"
                        value={legacyProject}
                        onChange={(e) => setLegacyProject(e.target.value)}
                      >
                        <option value="">Choose a matching unlinked project</option>
                        {data.projects
                          .filter(
                            (p) =>
                              !p.clientId &&
                              p.client?.toLowerCase() === client.name.toLowerCase() &&
                              !['hidden', 'view'].includes(p.fieldAccess?.client || ''),
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.wbs} · {p.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button disabled={locked || !legacyProject}>Link existing project</button>
                  </form>
                )}
              {client.projects.length ? (
                client.projects.map((p) => (
                  <p key={p.id}>
                    <button disabled={locked} onClick={() => setOpened(p.id)}>
                      {p.wbs} · {p.title}
                    </button>{' '}
                    · {p.status}
                  </p>
                ))
              ) : (
                <p>No projects linked to this client.</p>
              )}
            </section>
          )}
        </>
      )}
      {opened && data.projects.some((p) => p.id === opened) && (
        <ProjectPopup
          project={data.projects.find((p) => p.id === opened)!}
          data={data}
          onRefresh={async () => {
            await onRefresh();
            await load();
          }}
          onClose={() => setOpened('')}
        />
      )}
    </>
  );
}
