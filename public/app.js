const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { view: 'overview', data: null, role: 'Senior Management', query: '' };

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

async function load() {
  state.data = await api('/api/bootstrap');
  $('#signedUser').textContent = state.data.user || 'Stephan';
  render();
}
function setView(view) {
  state.view = view;
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
}
function render() {
  if (!state.data) return;
  const titles = { overview: 'Overview', projects: 'Projects', mytasks: 'My Tasks', capacity: 'Capacity', reports: 'Reports' };
  $('#pageTitle').textContent = titles[state.view];
  $('#notificationCount').textContent = state.data.notifications.filter(n => !n.read).length || '';
  if (state.view === 'overview') renderOverview();
  if (state.view === 'projects') renderProjects();
  if (state.view === 'mytasks') renderMyTasks();
  if (state.view === 'capacity') renderCapacity();
  if (state.view === 'reports') renderReports();
}
function renderOverview() {
  const projects = filteredProjects(), tasks = filteredTasks();
  const active = projects.filter(p => !['Completed', 'Lost/Cancelled'].includes(p.stage)).length;
  const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
  const escalated = tasks.filter(t => t.flag).length;
  $('#viewRoot').innerHTML = `<div class="stats"><div class="stat"><small>Active projects</small><strong>${active}</strong></div><div class="stat"><small>Open tasks</small><strong>${tasks.filter(t => t.status !== 'Completed').length}</strong></div><div class="stat"><small>Escalations</small><strong>${escalated}</strong></div><div class="stat"><small>Overdue</small><strong>${overdue}</strong></div></div><div class="grid-2"><div class="panel"><h3>Project portfolio</h3><div class="project-list">${projects.slice(0,8).map(projectRow).join('')}</div></div><div class="panel"><h3>Needs attention</h3><div class="task-list">${tasks.filter(t => t.flag || (t.dueDate && new Date(t.dueDate) < new Date())).slice(0,8).map(taskRow).join('') || '<p class="muted">No current escalations.</p>'}</div></div></div>`;
  bindRows();
}
function projectRow(p) { const count = state.data.tasks.filter(t => t.projectId === p.id).length; return `<div class="project-row" data-project="${p.id}"><div><strong>${esc(p.wbs)} · ${esc(p.title)}</strong><div class="meta"><span class="pill">${esc(p.client)}</span><span class="pill">${esc(p.stage)}</span><span class="pill">${esc(p.owner)}</span></div></div><small>${count} tasks</small></div>`; }
function taskRow(t) { return `<div class="task-row" data-task="${t.id}"><div><strong>${esc(t.wbs)} · ${esc(t.title)}</strong><div class="meta"><span class="pill">${esc(t.assignee)}</span><span class="pill">${esc(t.status)}</span>${t.flag ? `<span class="pill alert">${esc(t.flag)}</span>` : ''}</div></div><small>${esc(t.dueDate)}</small></div>`; }
function renderProjects() {
  const projects = filteredProjects();
  $('#viewRoot').innerHTML = `<div class="panel"><h3>All projects</h3><div class="project-list">${projects.map(projectRow).join('')}</div></div>`;
  bindRows();
}
function openProject(id) {
  const p = state.data.projects.find(x => x.id === id), tasks = state.data.tasks.filter(t => t.projectId === id);
  const statuses = ['To Do', 'Assigned', 'In Progress', 'Completed'];
  $('#drawerBody').innerHTML = `<p class="eyebrow">${esc(p.type)}</p><h2>${esc(p.wbs)} · ${esc(p.title)}</h2><p>${esc(p.scope || 'No scope description')}</p><div class="meta"><span class="pill">${esc(p.client)}</span><span class="pill">${esc(p.stage)}</span><span class="pill">Owner: ${esc(p.owner)}</span></div>${p.pricing ? `<div class="panel"><strong>Commercial</strong><p>ROM: ${esc(p.pricing.rom || '—')} · PO: ${esc(p.pricing.poStatus || '—')}</p></div>` : ''}<h3>Task board</h3><div class="kanban">${statuses.map(s => `<div class="kanban-col"><h4>${s}</h4>${tasks.filter(t => t.status === s || (s === 'To Do' && !statuses.includes(t.status))).map(t => `<div class="task-card" data-task="${t.id}"><strong>${esc(t.title)}</strong><div class="meta"><span class="pill">${esc(t.assignee)}</span>${t.flag ? `<span class="pill alert">${esc(t.flag)}</span>` : ''}</div></div>`).join('')}</div>`).join('')}</div>`;
  $('#drawer').classList.remove('hidden');
  $$('#drawerBody [data-task]').forEach(el => el.onclick = () => openTask(el.dataset.task));
}
function openTask(id) {
  const t = state.data.tasks.find(x => x.id === id), p = projectFor(t), canAssign = state.data.permissions.canAssign;
  $('#drawerBody').innerHTML = `<p class="eyebrow">${esc(p?.title)}</p><h2>${esc(t.wbs)} · ${esc(t.title)}</h2><div class="field"><label>Status</label><select id="taskStatus">${['To Do','Assigned','In Progress','Completed'].map(x => `<option ${t.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>Assignee</label><select id="taskAssignee" ${canAssign ? '' : 'disabled'}>${state.data.users.map(u => `<option ${t.assignee === u.name ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div><div class="form-grid"><div class="field"><label>MH estimate</label><input id="taskEstimate" type="number" value="${esc(t.mhEstimate ?? '')}" ${canAssign ? '' : 'disabled'}></div><div class="field"><label>Actual MH</label><input id="taskActual" type="number" value="${esc(t.mhActual ?? '')}"></div></div><div class="field"><label>Flag / escalation</label><input id="taskFlag" value="${esc(t.flag || '')}"></div><div class="field"><label>Escalation reason</label><textarea id="taskReason">${esc(t.flagReason || '')}</textarea></div><div class="field"><label>Remarks</label><textarea id="taskRemarks">${esc(t.remarks || '')}</textarea></div><button id="saveTask" class="primary full">Save task</button>`;
  $('#drawer').classList.remove('hidden');
  $('#saveTask').onclick = async () => { try { await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: $('#taskStatus').value, assignee: $('#taskAssignee').value, mhEstimate: $('#taskEstimate').value, mhActual: $('#taskActual').value, flag: $('#taskFlag').value, flagReason: $('#taskReason').value, remarks: $('#taskRemarks').value }) }); await load(); toast('Task updated'); $('#drawer').classList.add('hidden'); } catch (e) { toast(e.message); } };
}
function renderMyTasks() { const tasks = filteredTasks().filter(t => t.assignee === state.data.user); $('#viewRoot').innerHTML = `<div class="panel"><h3>Assigned to ${esc(state.data.user)}</h3><div class="task-list">${tasks.map(taskRow).join('') || '<p class="muted">No tasks assigned.</p>'}</div></div>`; bindRows(); }
function renderCapacity() { const rows = state.data.users.map(u => { const booked = state.data.tasks.filter(t => t.assignee === u.name && t.status !== 'Completed').reduce((n,t) => n + Number(t.mhEstimate || 0),0); const pct = Math.min(100, Math.round(booked / 40 * 100)); return `<tr><td><strong>${esc(u.name)}</strong><br><small>${esc(u.role)}</small></td><td>${booked} MH<div class="bar"><span style="width:${pct}%"></span></div></td><td>${Math.max(0,40-booked)} MH</td></tr>`; }).join(''); $('#viewRoot').innerHTML = `<div class="panel"><h3>Weekly capacity</h3><table class="capacity-table"><thead><tr><th>Team member</th><th>Booked</th><th>Available</th></tr></thead><tbody>${rows}</tbody></table></div>`; }
function renderReports() { if (!state.data.permissions.management) { $('#viewRoot').innerHTML = '<div class="panel"><h3>Management reporting</h3><p class="muted">This area is restricted to Senior Management.</p></div>'; return; } const estimate = state.data.tasks.reduce((n,t)=>n+Number(t.mhEstimate||0),0), actual = state.data.tasks.reduce((n,t)=>n+Number(t.mhActual||0),0); $('#viewRoot').innerHTML = `<div class="stats"><div class="stat"><small>Total estimated MH</small><strong>${estimate}</strong></div><div class="stat"><small>Total actual MH</small><strong>${actual}</strong></div><div class="stat"><small>Variance</small><strong>${actual-estimate}</strong></div><div class="stat"><small>Escalations</small><strong>${state.data.tasks.filter(t=>t.flag).length}</strong></div></div><div class="panel"><h3>Export</h3><p class="muted">Download the current project/task dataset for management analysis.</p><button id="exportBtn" class="primary">Export CSV</button></div>`; $('#exportBtn').onclick = () => location.href = '/api/export.csv'; }
function bindRows() { $$('[data-project]').forEach(el => el.onclick = () => openProject(el.dataset.project)); $$('[data-task]').forEach(el => el.onclick = () => openTask(el.dataset.task)); }
function openNewProject() { const canCommercial = state.data.permissions.canCreateCommercial; $('#modalBody').innerHTML = `<h2>Create project</h2><div class="form-grid"><div class="field"><label>Type</label><select id="pType"><option value="internal_eer">Internal EER</option>${canCommercial ? '<option value="commercial">Commercial</option>' : ''}</select></div><div class="field"><label>Client</label><input id="pClient" value="Internal"></div></div><div class="field"><label>Project title</label><input id="pTitle"></div><div class="field"><label>Scope</label><textarea id="pScope"></textarea></div><button id="createProject" class="primary full">Create project</button>`; $('#modal').classList.remove('hidden'); $('#createProject').onclick = async () => { try { await api('/api/projects', { method:'POST', body: JSON.stringify({ type: $('#pType').value, client: $('#pClient').value, title: $('#pTitle').value, scope: $('#pScope').value }) }); $('#modal').classList.add('hidden'); await load(); toast('Project created'); } catch(e) { toast(e.message); } }; }

$('#loginForm').onsubmit = async event => { event.preventDefault(); $('#loginError').textContent = ''; try { await api('/api/login', { method:'POST', body: JSON.stringify({ user: $('#loginUser').value, id: $('#loginId').value, password: $('#loginPassword').value }) }); showApp(); await load(); } catch(e) { $('#loginError').textContent = e.message; } };
$('#logoutBtn').onclick = async () => { await api('/api/logout', { method:'POST' }).catch(()=>{}); state.data = null; showLogin(); };
$('#roleSelect').onchange = async e => { state.role = e.target.value; await load(); };
$('#search').oninput = e => { state.query = e.target.value; render(); };
$$('#nav button').forEach(button => button.onclick = () => setView(button.dataset.view));
$('#drawerClose').onclick = () => $('#drawer').classList.add('hidden');
$('#modalClose').onclick = () => $('#modal').classList.add('hidden');
$('#newProjectBtn').onclick = openNewProject;
$('#notificationsBtn').onclick = () => { $('#drawerBody').innerHTML = `<h2>Notifications</h2>${state.data.notifications.map(n => `<div class="task-row"><div><strong>${esc(n.text)}</strong><small>${esc(n.ts)}</small></div></div>`).join('') || '<p class="muted">No notifications.</p>'}`; $('#drawer').classList.remove('hidden'); };
$('#auditBtn').onclick = () => { $('#drawerBody').innerHTML = `<h2>Audit trail</h2>${state.data.audit.map(a => `<div class="task-row"><div><strong>${esc(a.text)}</strong><small>${esc(a.user)} · ${esc(a.ts)}</small></div></div>`).join('') || '<p class="muted">No audit entries.</p>'}`; $('#drawer').classList.remove('hidden'); };

// Always start at the login screen for the demo. Authentication is established only after form submission.
showLogin();
