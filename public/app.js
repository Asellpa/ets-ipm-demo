const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { view: 'overview', data: null, role: 'Senior Management', query: '', activeProjectId: null };

async function api(url, options = {}) {
  options.headers = { ...(options.headers || {}), 'Content-Type': 'application/json', 'x-role': state.role };
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Request failed'); error.status = response.status; throw error; }
  return data;
}
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(message) { $('#toast').textContent = message; $('#toast').classList.remove('hidden'); setTimeout(() => $('#toast').classList.add('hidden'), 2200); }
function showLogin() { $('#loginScreen').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#loginScreen').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function projectFor(task) { return state.data.projects.find(p => p.id === task.projectId); }
function filteredProjects() { const q = state.query.toLowerCase(); return state.data.projects.filter(p => !q || `${p.wbs} ${p.title} ${p.client} ${p.owner}`.toLowerCase().includes(q)); }
function filteredTasks() { const q = state.query.toLowerCase(); return state.data.tasks.filter(t => !q || `${t.wbs} ${t.title} ${t.assignee} ${t.status}`.toLowerCase().includes(q)); }
function projectTasks(projectId) { return state.data.tasks.filter(t => t.projectId === projectId).sort((a,b) => String(a.wbs).localeCompare(String(b.wbs), undefined, { numeric: true })); }
function taskLevel(task, project) { if (task.level) return Number(task.level); const rest = String(task.wbs).replace(String(project.wbs), '').replace(/^\./, ''); return rest ? rest.split('.').length + 1 : 1; }
function parentFor(task, project) { if (task.parentWbs) return task.parentWbs; const parts = String(task.wbs).split('.'); return parts.length > 1 ? parts.slice(0,-1).join('.') : project.wbs; }

async function load() {
  state.data = await api('/api/bootstrap');
  $('#signedUser').textContent = state.data.user || 'Stephan';
  $('#auditNav').classList.toggle('hidden', !state.data.permissions.canAudit);
  $('#auditBtn').classList.toggle('hidden', !state.data.permissions.canAudit);
  render();
}
function setView(view) {
  state.view = view;
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
}
function render() {
  if (!state.data) return;
  const titles = { overview: 'Overview', projects: 'Projects', mytasks: 'My Tasks', capacity: 'Capacity', reports: 'Reports', audit: 'Audit & History' };
  $('#pageTitle').textContent = titles[state.view] || 'Overview';
  $('#notificationCount').textContent = state.data.notifications.filter(n => !n.read).length || '';
  if (state.view === 'overview') renderOverview();
  if (state.view === 'projects') renderProjects();
  if (state.view === 'mytasks') renderMyTasks();
  if (state.view === 'capacity') renderCapacity();
  if (state.view === 'reports') renderReports();
  if (state.view === 'audit') renderAudit();
}
function renderOverview() {
  const projects = filteredProjects(), tasks = filteredTasks();
  const active = projects.filter(p => !['Completed', 'Lost/Cancelled'].includes(p.stage)).length;
  const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
  const escalated = tasks.filter(t => t.flag).length;
  $('#viewRoot').innerHTML = `<div class="stats"><div class="stat"><small>Active projects</small><strong>${active}</strong></div><div class="stat"><small>Open tasks</small><strong>${tasks.filter(t => t.status !== 'Completed').length}</strong></div><div class="stat"><small>Escalations</small><strong>${escalated}</strong></div><div class="stat"><small>Overdue</small><strong>${overdue}</strong></div></div><div class="grid-2"><div class="panel"><h3>Project portfolio</h3><div class="project-list">${projects.slice(0,8).map(projectRow).join('')}</div></div><div class="panel"><h3>Needs attention</h3><div class="task-list">${tasks.filter(t => t.flag || (t.dueDate && new Date(t.dueDate) < new Date())).slice(0,8).map(taskRow).join('') || '<p class="muted">No current escalations.</p>'}</div></div></div>`;
  bindRows();
}
function projectRow(p) { const count = projectTasks(p.id).filter(t => taskLevel(t,p) >= 3).length || projectTasks(p.id).length; return `<div class="project-row" data-project="${p.id}"><div><strong>${esc(p.wbs)} · ${esc(p.title)}</strong><div class="meta"><span class="pill">${esc(p.client)}</span><span class="pill">${esc(p.stage)}</span><span class="pill">${esc(p.owner)}</span></div></div><small>${count} tasks</small></div>`; }
function taskRow(t) { return `<div class="task-row" data-task="${t.id}"><div><strong>${esc(t.wbs)} · ${esc(t.title)}</strong><div class="meta"><span class="pill">${esc(t.assignee)}</span><span class="pill">${esc(t.status)}</span>${t.flag ? `<span class="pill alert">${esc(t.flag)}</span>` : ''}</div></div><small>${esc(t.dueDate)}</small></div>`; }
function renderProjects() {
  const projects = filteredProjects();
  $('#viewRoot').innerHTML = `<div class="panel"><div class="panel-heading"><div><h3>All projects</h3><p class="muted">Open a project to view its WBS hierarchy, tasks and project history.</p></div></div><div class="project-list">${projects.map(projectRow).join('')}</div></div>`;
  bindRows();
}

function hierarchyHtml(project, tasks) {
  const workPackages = tasks.filter(t => taskLevel(t, project) === 2);
  const level3 = tasks.filter(t => taskLevel(t, project) >= 3);
  const groups = workPackages.length ? workPackages : [{ id:'virtual', wbs: project.wbs, title:'Project tasks', status:'', assignee:'', virtual:true }];
  return `<div class="hierarchy-root"><div class="hierarchy-project"><span class="level-badge">L1</span><div><strong>${esc(project.wbs)} · ${esc(project.title)}</strong><small>${esc(project.client)} · ${esc(project.stage)}</small></div></div>${groups.map(wp => {
    const children = level3.filter(t => parentFor(t, project) === wp.wbs || (!workPackages.length));
    return `<div class="work-package"><div class="work-package-head"><div><span class="level-badge secondary">L2</span><strong>${esc(wp.wbs)} · ${esc(wp.title)}</strong></div>${state.data.permissions.canAssign ? `<button class="ghost small-btn add-child" data-parent="${esc(wp.wbs)}">+ Add task</button>` : ''}</div><div class="hierarchy-children">${children.map(t => `<div class="hierarchy-task" data-task="${t.id}"><span class="tree-line"></span><span class="level-badge tertiary">L3</span><div class="hierarchy-task-main"><strong>${esc(t.wbs)} · ${esc(t.title)}</strong><div class="meta"><span class="pill">${esc(t.assignee)}</span><span class="pill">${esc(t.status)}</span><span class="pill">${esc(t.department || '')}</span>${t.flag ? `<span class="pill alert">${esc(t.flag)}</span>` : ''}</div></div><div class="mh"><small>MH</small><strong>${esc(t.mhActual ?? 0)} / ${esc(t.mhEstimate ?? 0)}</strong></div></div>`).join('') || '<p class="muted empty-indent">No Level 3 tasks yet.</p>'}</div></div>`;
  }).join('')}</div>`;
}

function openProject(id) {
  state.activeProjectId = id;
  const p = state.data.projects.find(x => x.id === id), tasks = projectTasks(id);
  const audit = state.data.permissions.canAudit ? state.data.audit.filter(a => a.projectId === id || tasks.some(t => t.id === a.entityId)) : [];
  $('#projectModalBody').innerHTML = `<div class="project-page-header"><div><p class="eyebrow">${esc(p.type === 'commercial' ? 'Commercial project' : 'Internal EER')}</p><h1>${esc(p.wbs)} · ${esc(p.title)}</h1><div class="meta"><span class="pill">${esc(p.client)}</span><span class="pill">${esc(p.stage)}</span><span class="pill">Owner: ${esc(p.owner)}</span><span class="pill">Priority: ${esc(p.priority)}</span></div></div><div class="project-actions">${state.data.permissions.canAssign ? `<button id="projectAddTask" class="primary">+ Add task</button>` : ''}</div></div><div class="project-info-grid"><div class="info-card"><small>Aircraft</small><strong>${esc(p.aircraft || '—')}</strong></div><div class="info-card"><small>EDD</small><strong>${esc(p.edd || '—')}</strong></div><div class="info-card"><small>DOA focal</small><strong>${esc(p.doaFocal || '—')}</strong></div><div class="info-card"><small>Scope</small><strong>${esc(p.scope || '—')}</strong></div></div>${p.pricing ? `<div class="commercial-strip"><strong>Commercial</strong><span>ROM: ${esc(p.pricing.rom || '—')}</span><span>PO: ${esc(p.pricing.poStatus || '—')}</span></div>` : ''}<div class="project-tabs"><button class="active" data-project-tab="hierarchy">Hierarchy & Tasks</button>${state.data.permissions.canAudit ? '<button data-project-tab="history">Project History</button>' : ''}</div><div id="projectTabContent">${hierarchyHtml(p,tasks)}</div>`;
  $('#projectModal').classList.remove('hidden');
  bindProjectContent(p, tasks, audit);
}
function bindProjectContent(project, tasks, audit) {
  $('#projectAddTask')?.addEventListener('click', () => openNewTask(project.id));
  $$('#projectModalBody .add-child').forEach(btn => btn.onclick = e => { e.stopPropagation(); openNewTask(project.id, btn.dataset.parent); });
  $$('#projectModalBody [data-task]').forEach(el => el.onclick = () => openTask(el.dataset.task));
  $$('#projectModalBody [data-project-tab]').forEach(btn => btn.onclick = () => {
    $$('#projectModalBody [data-project-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('#projectTabContent').innerHTML = btn.dataset.projectTab === 'history' ? auditHistoryHtml(audit) : hierarchyHtml(project, tasks);
    if (btn.dataset.projectTab === 'hierarchy') bindProjectContent(project, tasks, audit);
  });
}
function auditHistoryHtml(items) {
  if (!items.length) return '<div class="audit-empty"><p class="muted">No history has been recorded for this project yet.</p></div>';
  return `<div class="audit-timeline">${items.map(a => `<div class="audit-entry"><div class="audit-dot"></div><div><strong>${esc(a.text)}</strong><div class="audit-meta">${esc(a.user)} · ${esc(a.ts)}</div>${a.changes?.length ? `<div class="change-list">${a.changes.map(c => `<span><b>${esc(c.field)}</b>: ${esc(c.from || '—')} → ${esc(c.to || '—')}</span>`).join('')}</div>` : ''}</div></div>`).join('')}</div>`;
}
function openTask(id) {
  const t = state.data.tasks.find(x => x.id === id), p = projectFor(t), canAssign = state.data.permissions.canAssign;
  $('#drawerBody').innerHTML = `<p class="eyebrow">${esc(p?.title)}</p><h2>${esc(t.wbs)} · ${esc(t.title)}</h2><div class="field"><label>Status</label><select id="taskStatus">${['To Do','Assigned','In Progress','Review','Completed','On Hold (Client)'].map(x => `<option ${t.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>Assignee</label><select id="taskAssignee" ${canAssign ? '' : 'disabled'}>${state.data.users.map(u => `<option ${t.assignee === u.name ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div><div class="form-grid"><div class="field"><label>MH estimate</label><input id="taskEstimate" type="number" value="${esc(t.mhEstimate ?? '')}" ${canAssign ? '' : 'disabled'}></div><div class="field"><label>Actual MH</label><input id="taskActual" type="number" value="${esc(t.mhActual ?? '')}"></div></div><div class="field"><label>Department</label><input id="taskDepartment" value="${esc(t.department || '')}" ${canAssign ? '' : 'disabled'}></div><div class="field"><label>Flag / escalation</label><input id="taskFlag" value="${esc(t.flag || '')}"></div><div class="field"><label>Escalation reason</label><textarea id="taskReason">${esc(t.flagReason || '')}</textarea></div><div class="field"><label>Remarks</label><textarea id="taskRemarks">${esc(t.remarks || '')}</textarea></div><button id="saveTask" class="primary full">Save task</button>`;
  $('#drawer').classList.remove('hidden');
  $('#saveTask').onclick = async () => { try { await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: $('#taskStatus').value, assignee: $('#taskAssignee').value, mhEstimate: $('#taskEstimate').value, mhActual: $('#taskActual').value, department: $('#taskDepartment').value, flag: $('#taskFlag').value, flagReason: $('#taskReason').value, remarks: $('#taskRemarks').value }) }); await load(); toast('Task updated'); $('#drawer').classList.add('hidden'); if (state.activeProjectId) openProject(state.activeProjectId); } catch (e) { toast(e.message); } };
}
function openNewTask(projectId, parentWbs = '') {
  const p = state.data.projects.find(x => x.id === projectId);
  const workPackages = projectTasks(projectId).filter(t => taskLevel(t,p) === 2);
  const defaultParent = parentWbs || workPackages[0]?.wbs || p.wbs;
  $('#modalBody').innerHTML = `<h2>Add task to ${esc(p.wbs)}</h2><p class="muted">Tasks follow the tracker hierarchy: Level 1 Project → Level 2 Work Package → Level 3 Task.</p><div class="field"><label>Parent / Work Package</label><select id="tParent">${workPackages.length ? workPackages.map(w => `<option value="${esc(w.wbs)}" ${w.wbs===defaultParent?'selected':''}>${esc(w.wbs)} · ${esc(w.title)}</option>`).join('') : `<option value="${esc(p.wbs)}">${esc(p.wbs)} · Project tasks</option>`}</select></div><div class="field"><label>Task title</label><input id="tTitle" placeholder="e.g. Review customer documents"></div><div class="form-grid"><div class="field"><label>Department</label><input id="tDepartment" value="Engineering"></div><div class="field"><label>Assignee</label><select id="tAssignee"><option value="">Unassigned</option>${state.data.users.map(u => `<option>${esc(u.name)}</option>`).join('')}</select></div></div><div class="form-grid"><div class="field"><label>Priority</label><select id="tPriority"><option>Normal</option><option>High</option><option>Low</option></select></div><div class="field"><label>MH estimate</label><input id="tEstimate" type="number" min="0" step="0.5" value="0"></div></div><div class="form-grid"><div class="field"><label>Due date</label><input id="tDue" type="date"></div><div class="field"><label>Dependency WBS</label><input id="tDependency" placeholder="Optional"></div></div><div class="field"><label>Action / notes</label><textarea id="tAction"></textarea></div><button id="createTask" class="primary full">Create task</button>`;
  $('#modal').classList.remove('hidden');
  $('#createTask').onclick = async () => {
    try {
      if (!$('#tTitle').value.trim()) return toast('Enter a task title');
      await api('/api/tasks', { method:'POST', body: JSON.stringify({ projectId, parentWbs: $('#tParent').value, title: $('#tTitle').value.trim(), department: $('#tDepartment').value, assignee: $('#tAssignee').value, priority: $('#tPriority').value, mhEstimate: $('#tEstimate').value, dueDate: $('#tDue').value, dependency: $('#tDependency').value, action: $('#tAction').value }) });
      $('#modal').classList.add('hidden'); await load(); toast('Task added'); openProject(projectId);
    } catch(e) { toast(e.message); }
  };
}
function renderMyTasks() { const tasks = filteredTasks().filter(t => t.assignee === state.data.user && taskLevel(t,projectFor(t)) >= 3); $('#viewRoot').innerHTML = `<div class="panel"><h3>Assigned to ${esc(state.data.user)}</h3><div class="task-list">${tasks.map(taskRow).join('') || '<p class="muted">No tasks assigned.</p>'}</div></div>`; bindRows(); }
function renderCapacity() { const rows = state.data.users.map(u => { const booked = state.data.tasks.filter(t => t.assignee === u.name && t.status !== 'Completed' && taskLevel(t,projectFor(t)) >= 3).reduce((n,t) => n + Number(t.mhEstimate || 0),0); const pct = Math.min(100, Math.round(booked / 40 * 100)); return `<tr><td><strong>${esc(u.name)}</strong><br><small>${esc(u.role)}</small></td><td>${booked} MH<div class="bar"><span style="width:${pct}%"></span></div></td><td>${Math.max(0,40-booked)} MH</td></tr>`; }).join(''); $('#viewRoot').innerHTML = `<div class="panel"><h3>Weekly capacity</h3><table class="capacity-table"><thead><tr><th>Team member</th><th>Booked</th><th>Available</th></tr></thead><tbody>${rows}</tbody></table></div>`; }
function renderReports() { if (!state.data.permissions.management) { $('#viewRoot').innerHTML = '<div class="panel"><h3>Management reporting</h3><p class="muted">This area is restricted to Senior Management.</p></div>'; return; } const tasks=state.data.tasks.filter(t=>taskLevel(t,projectFor(t))>=3), estimate = tasks.reduce((n,t)=>n+Number(t.mhEstimate||0),0), actual = tasks.reduce((n,t)=>n+Number(t.mhActual||0),0); $('#viewRoot').innerHTML = `<div class="stats"><div class="stat"><small>Total estimated MH</small><strong>${estimate}</strong></div><div class="stat"><small>Total actual MH</small><strong>${actual}</strong></div><div class="stat"><small>Variance</small><strong>${actual-estimate}</strong></div><div class="stat"><small>Escalations</small><strong>${tasks.filter(t=>t.flag).length}</strong></div></div><div class="panel"><h3>Export</h3><p class="muted">Download the current project/task dataset for management analysis.</p><button id="exportBtn" class="primary">Export CSV</button></div>`; $('#exportBtn').onclick = () => location.href = '/api/export.csv'; }
function renderAudit() {
  if (!state.data.permissions.canAudit) { $('#viewRoot').innerHTML = '<div class="panel"><h3>Audit & History</h3><p class="muted">Restricted to Senior Management.</p></div>'; return; }
  const projects = state.data.projects;
  $('#viewRoot').innerHTML = `<div class="panel"><div class="audit-toolbar"><div><h3>Audit & History</h3><p class="muted">Admin view of project creation, task creation, assignments and field changes.</p></div><div class="audit-filters"><select id="auditProject"><option value="">All projects</option>${projects.map(p=>`<option value="${p.id}">${esc(p.wbs)} · ${esc(p.title)}</option>`).join('')}</select><input id="auditSearch" placeholder="Search user, field or event"></div></div><div id="auditResults">${auditHistoryHtml(state.data.audit)}</div></div>`;
  const refreshAudit = () => { const pid=$('#auditProject').value, q=$('#auditSearch').value.toLowerCase(); const items=state.data.audit.filter(a=>(!pid||a.projectId===pid)&&(!q||`${a.text} ${a.user} ${(a.changes||[]).map(c=>`${c.field} ${c.from} ${c.to}`).join(' ')}`.toLowerCase().includes(q))); $('#auditResults').innerHTML=auditHistoryHtml(items); };
  $('#auditProject').onchange=refreshAudit; $('#auditSearch').oninput=refreshAudit;
}
function bindRows() { $$('[data-project]').forEach(el => el.onclick = () => openProject(el.dataset.project)); $$('[data-task]').forEach(el => el.onclick = () => openTask(el.dataset.task)); }
function openNewProject() { const canCommercial = state.data.permissions.canCreateCommercial; $('#modalBody').innerHTML = `<h2>Create project</h2><div class="form-grid"><div class="field"><label>Type</label><select id="pType"><option value="internal_eer">Internal EER</option>${canCommercial ? '<option value="commercial">Commercial</option>' : ''}</select></div><div class="field"><label>Client</label><input id="pClient" value="Internal"></div></div><div class="field"><label>Project title</label><input id="pTitle"></div><div class="field"><label>Scope</label><textarea id="pScope"></textarea></div><button id="createProject" class="primary full">Create project</button>`; $('#modal').classList.remove('hidden'); $('#createProject').onclick = async () => { try { await api('/api/projects', { method:'POST', body: JSON.stringify({ type: $('#pType').value, client: $('#pClient').value, title: $('#pTitle').value, scope: $('#pScope').value }) }); $('#modal').classList.add('hidden'); await load(); toast('Project created'); } catch(e) { toast(e.message); } }; }

$('#loginForm').onsubmit = async event => { event.preventDefault(); $('#loginError').textContent = ''; try { await api('/api/login', { method:'POST', body: JSON.stringify({ user: $('#loginUser').value, id: $('#loginId').value, password: $('#loginPassword').value }) }); showApp(); await load(); } catch(e) { $('#loginError').textContent = e.message; } };
$('#logoutBtn').onclick = async () => { await api('/api/logout', { method:'POST' }).catch(()=>{}); state.data = null; showLogin(); };
$('#roleSelect').onchange = async e => { state.role = e.target.value; if (state.view === 'audit' && state.role !== 'Senior Management') state.view='overview'; await load(); };
$('#search').oninput = e => { state.query = e.target.value; render(); };
$$('#nav button').forEach(button => button.onclick = () => setView(button.dataset.view));
$('#drawerClose').onclick = () => $('#drawer').classList.add('hidden');
$('#modalClose').onclick = () => $('#modal').classList.add('hidden');
$('#projectModalClose').onclick = () => { $('#projectModal').classList.add('hidden'); state.activeProjectId=null; };
$('#newProjectBtn').onclick = openNewProject;
$('#notificationsBtn').onclick = () => { $('#drawerBody').innerHTML = `<h2>Notifications</h2>${state.data.notifications.map(n => `<div class="task-row"><div><strong>${esc(n.text)}</strong><small>${esc(n.ts)}</small></div></div>`).join('') || '<p class="muted">No notifications.</p>'}`; $('#drawer').classList.remove('hidden'); };
$('#auditBtn').onclick = () => setView('audit');

showLogin();
