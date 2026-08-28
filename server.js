const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 5174;
const ROOT = __dirname;
const DB = path.join(ROOT, 'data', 'db.json');
const SEED = path.join(ROOT, 'data', 'seed.json');
const DEMO_USER = {
  name: process.env.DEMO_USER || 'Stephan',
  id: process.env.DEMO_ID || '123',
  password: process.env.DEMO_PASSWORD || 'Testing'
};
const sessions = new Map();

if (!fs.existsSync(DB) && fs.existsSync(SEED)) fs.copyFileSync(SEED, DB);

const read = () => JSON.parse(fs.readFileSync(DB, 'utf8'));
const write = data => fs.writeFileSync(DB, JSON.stringify(data, null, 2));
const management = role => role === 'Senior Management';
const canAssign = role => role === 'Senior Management' || role === 'LTSE';
const canEngineeringAtRFQ = role => role === 'Senior Management' || role === 'LTSE';
const roleOf = req => req.headers['x-role'] || 'Senior Management';

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}
function sessionOf(req) { const token = cookies(req).ets_session; return token && sessions.get(token); }
const userOf = req => sessionOf(req)?.name || 'Unknown';
function authRequired(req, res) { const session = sessionOf(req); if (!session) { send(res, 401, { error: 'Authentication required' }); return null; } return session; }
function same(a, b) { const aa = Buffer.from(String(a)), bb = Buffer.from(String(b)); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
function safeProject(p, role) { const x = structuredClone(p); if (!management(role)) delete x.pricing; return x; }
function safeTask(t, role, p) { const x = structuredClone(t); if (p?.type === 'commercial' && p?.stage === 'RFQ' && !canEngineeringAtRFQ(role)) { delete x.mhEstimate; delete x.mhActual; delete x.department; delete x.action; delete x.remarks; delete x.dependency; } return x; }
function log(db, text, req) { db.audit.unshift({ id: 'a' + Date.now(), text, user: userOf(req), ts: new Date().toLocaleString() }); db.audit = db.audit.slice(0, 100); }
function notify(db, text) { db.notifications.unshift({ id: 'n' + Date.now(), text, read: false, ts: new Date().toLocaleString() }); db.notifications = db.notifications.slice(0, 50); }
function send(res, code, obj, type = 'application/json') { const response = type === 'application/json' ? JSON.stringify(obj) : obj; res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(response); }
function body(req) { return new Promise((resolve, reject) => { let s = ''; req.on('data', c => { s += c; if (s.length > 2e6) req.destroy(); }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }
function mime(p) { return p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream'; }

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const role = roleOf(req);

    if (req.method === 'POST' && u.pathname === '/api/login') {
      const b = await body(req);
      if (!same(b.user, DEMO_USER.name) || !same(b.id, DEMO_USER.id) || !same(b.password, DEMO_USER.password)) return send(res, 401, { error: 'Invalid user, ID or password' });
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { name: DEMO_USER.name, id: DEMO_USER.id, createdAt: Date.now() });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': `ets_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
      return res.end(JSON.stringify({ ok: true, user: DEMO_USER.name }));
    }
    if (req.method === 'POST' && u.pathname === '/api/logout') {
      const token = cookies(req).ets_session;
      if (token) sessions.delete(token);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': 'ets_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (u.pathname.startsWith('/api/')) { const session = authRequired(req, res); if (!session) return; }

    if (req.method === 'GET' && u.pathname === '/api/bootstrap') {
      const db = read(), pmap = Object.fromEntries(db.projects.map(p => [p.id, p]));
      return send(res, 200, { role, user: userOf(req), userId: sessionOf(req)?.id, users: db.users, projects: db.projects.map(p => safeProject(p, role)), tasks: db.tasks.map(t => safeTask(t, role, pmap[t.projectId])), notifications: db.notifications, audit: db.audit, permissions: { management: management(role), canAssign: canAssign(role), canCreateCommercial: management(role) } });
    }
    if (req.method === 'PATCH' && u.pathname.startsWith('/api/tasks/')) {
      const id = u.pathname.split('/').pop(), db = read(), t = db.tasks.find(x => x.id === id);
      if (!t) return send(res, 404, { error: 'Task not found' });
      const b = await body(req), allowed = ['status', 'mhActual', 'flag', 'flagReason', 'remarks', 'dependency'];
      if (canAssign(role)) allowed.push('assignee', 'priority', 'mhEstimate', 'dueDate');
      for (const [k, v] of Object.entries(b)) if (allowed.includes(k)) t[k] = v;
      if (Number(t.mhActual) > Number(t.mhEstimate) && !t.flag) t.flag = 'Needs review';
      log(db, `Updated task ${t.wbs}: ${Object.keys(b).join(', ')}`, req);
      if (b.assignee) notify(db, `Task ${t.wbs} assigned to ${b.assignee}`);
      write(db);
      return send(res, 200, { ok: true, task: t });
    }
    if (req.method === 'POST' && u.pathname === '/api/projects') {
      const db = read(), b = await body(req), type = b.type || 'internal_eer';
      if (type === 'commercial' && !management(role)) return send(res, 403, { error: 'Only Senior Management can create Commercial projects' });
      const id = 'p-' + Date.now();
      const p = { id, wbs: type === 'internal_eer' ? `EER-${String(db.projects.filter(x => x.type === 'internal_eer').length + 1).padStart(3, '0')}` : `P-${Date.now().toString().slice(-5)}`, type, client: b.client || 'Internal', title: b.title || 'Untitled project', aircraft: b.aircraft || '', registration: '', releaseType: b.releaseType || '', sector: b.sector || '', owner: b.owner || userOf(req), priority: b.priority || 'Normal', stage: b.stage || 'RFQ', status: b.stage || 'RFQ', scope: b.scope || '', edd: b.edd || '', startDate: new Date().toISOString().slice(0, 10), pricing: management(role) ? { rom: b.rom || '', poStatus: '', negotiationNotes: '' } : {}, clientFocal: '', doaFocal: '', remarks: '' };
      db.projects.unshift(p); log(db, `Created ${type === 'commercial' ? 'Commercial project' : 'Internal EER'} ${p.wbs}`, req);
      if (type === 'internal_eer' && !management(role)) notify(db, `New Internal EER ${p.wbs} created by ${userOf(req)} — LTSE / Senior Management notified`);
      write(db); return send(res, 200, { ok: true, project: safeProject(p, role) });
    }
    if (req.method === 'POST' && u.pathname === '/api/tasks') {
      const db = read(); if (!canAssign(role)) return send(res, 403, { error: 'Only LTSE and above can assign/create tasks' });
      const b = await body(req), p = db.projects.find(x => x.id === b.projectId); if (!p) return send(res, 404, { error: 'Project not found' });
      const id = 't-' + Date.now(), count = db.tasks.filter(x => x.projectId === p.id).length + 1;
      const t = { id, projectId: p.id, wbs: `${p.wbs}.${count}`, title: b.title || 'New task', department: b.department || 'Engineering', assignee: b.assignee || 'Unassigned', priority: b.priority || 'Normal', status: b.assignee ? 'Assigned' : 'To Do', mhEstimate: Number(b.mhEstimate || 0), mhActual: 0, startDate: new Date().toISOString().slice(0, 10), dueDate: b.dueDate || '', dependency: '', action: '', remarks: '', flag: '', flagReason: '' };
      db.tasks.push(t); log(db, `Created task ${t.wbs}`, req); if (t.assignee !== 'Unassigned') notify(db, `Task ${t.wbs} assigned to ${t.assignee}`); write(db); return send(res, 200, { ok: true, task: t });
    }
    if (req.method === 'POST' && u.pathname === '/api/notifications/read') { const db = read(); db.notifications.forEach(n => n.read = true); write(db); return send(res, 200, { ok: true }); }
    if (req.method === 'POST' && u.pathname === '/api/reset') { fs.copyFileSync(SEED, DB); return send(res, 200, { ok: true }); }
    if (req.method === 'GET' && u.pathname === '/api/export.csv') {
      const db = read(), pmap = Object.fromEntries(db.projects.map(p => [p.id, p])), esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`, head = ['WBS', 'Project', 'Client', 'Type', 'Stage', 'Task', 'Assignee', 'Status', 'MH Estimate', 'MH Actual', 'Flag'];
      const lines = [head.map(esc).join(',')];
      for (const t of db.tasks) { const p = pmap[t.projectId], st = safeTask(t, role, p); lines.push([t.wbs, p?.title, p?.client, p?.type, p?.stage, t.title, t.assignee, t.status, st.mhEstimate ?? '', st.mhActual ?? '', t.flag].map(esc).join(',')); }
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="ets_project_export.csv"' }); return res.end(lines.join('\n'));
    }

    const file = u.pathname === '/' ? path.join(ROOT, 'public', 'index.html') : path.join(ROOT, 'public', u.pathname.replace(/^\//, ''));
    if (!file.startsWith(path.join(ROOT, 'public'))) return send(res, 403, 'Forbidden', 'text/plain');
    if (fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' }); return fs.createReadStream(file).pipe(res); }
    return send(res, 404, 'Not found', 'text/plain');
  } catch (e) { console.error(e); send(res, 500, { error: 'Server error' }); }
});

server.listen(PORT, () => console.log(`ETS IPM running at http://localhost:${PORT}`));
