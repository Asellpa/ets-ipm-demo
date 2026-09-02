// Header/navigation polish for the demo shell.
(() => {
  function polishHeader(){
    const header=document.querySelector('main > header');
    if(!header)return;
    header.querySelector('.eyebrow')?.remove();
    document.getElementById('myOnly')?.remove();
    document.getElementById('import')?.classList.add('header-moved-action');
    document.getElementById('export')?.classList.add('header-moved-action');
    const n=document.getElementById('notif');
    if(n){
      n.classList.add('notification-button');
      n.setAttribute('aria-label','Notifications');
      n.setAttribute('title','Notifications');
      const count=document.getElementById('notifCount')?.textContent?.replace(/[()]/g,'').trim()||'';
      n.innerHTML=`<span class="bell-wrap" aria-hidden="true"><svg viewBox="0 0 24 24" class="bell-icon"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>${count?`<span id="notifCount" class="notification-badge">${count}</span>`:'<span id="notifCount" class="notification-badge hidden"></span>'}</span>`;
      updateNotificationState();
    }
  }
  function updateNotificationState(){
    const n=document.getElementById('notif'), badge=document.getElementById('notifCount');
    if(!n||!badge||!S.data)return;
    const unread=S.data.notifications.filter(x=>!(x.readBy||[]).includes(S.data.user)).length;
    badge.textContent=unread?String(unread):'';
    badge.classList.toggle('hidden',!unread);
    n.classList.toggle('has-notifications',unread>0);
  }
  function addReportActions(){
    if(S.view!=='reports')return;
    const root=document.getElementById('root');if(!root||root.querySelector('#reportDataActions'))return;
    const canImport=!!S.data.permissions.importData, canExport=!!S.data.permissions.exportData;
    if(!canImport&&!canExport)return;
    const panel=document.createElement('div');
    panel.id='reportDataActions';panel.className='panel report-data-actions';
    panel.innerHTML=`<div class="panel-head"><div><h3>Data Operations</h3><p class="muted">Import the ETS tracker or export the current application register from Reporting.</p></div><div class="toolbar report-actions">${canImport?'<button id="reportImport" class="ghost">Import Tracker</button>':''}${canExport?'<button id="reportExport" class="ghost">Export Register</button>':''}</div></div>`;
    root.prepend(panel);
    document.getElementById('reportImport')?.addEventListener('click',()=>document.getElementById('fileInput')?.click());
    document.getElementById('reportExport')?.addEventListener('click',()=>download('/api/export.csv'));
  }
  const previousLoad=load;
  load=async function(){await previousLoad();polishHeader();updateNotificationState();addReportActions()};
  const previousRender=render;
  render=function(){previousRender();polishHeader();updateNotificationState();addReportActions()};
  polishHeader();
})();