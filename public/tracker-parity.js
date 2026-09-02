// ETS tracker import/parity extension. Keeps the existing application model while accepting the client's workbook workflow.
(() => {
  const STORAGE_KEY='ets_tracker_source_v1';
  const EXPECTED=['WBS','Level','EER #','Sub Dept','CLIENT','Aircraft','A/C Reg','Project','Details','DOA Scope','MRO Release','Task Classification','ETS Sub-Dept','Owner','Priority','Status','Client Focal','Escalation','Customer Support','DOA focal','MH Estimations','Actual MH','Current Man Power','Workshare Status','ROM','PO Status','Action Items','Remarks','Start Date','Completion Date','Card Type','Stage','Escalation Flag'];
  const getSource=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{"columns":[],"rows":[],"fileName":"","importedAt":""}')}catch{return{columns:[],rows:[],fileName:'',importedAt:''}}};
  const saveSource=(fileName,rows)=>{const columns=[...new Set(rows.flatMap(r=>Object.keys(r)).filter(Boolean))];localStorage.setItem(STORAGE_KEY,JSON.stringify({columns,rows,fileName,importedAt:new Date().toISOString()}));};
  const cleanRows=rows=>rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k).trim(),v==null?'':String(v).trim()]))).filter(r=>Object.values(r).some(v=>String(v).trim()));
  function parseCSV(text){
    const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++}else q=!q}else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell);if(row.some(x=>x!==''))rows.push(row);if(!rows.length)return[];const headers=rows.shift().map(x=>String(x).trim());return rows.map(vals=>Object.fromEntries(headers.map((h,i)=>[h,vals[i]??''])))}
  async function readTracker(file){
    const ext=file.name.toLowerCase().split('.').pop();
    if(ext==='csv') return cleanRows(parseCSV(await file.text()));
    if(!window.XLSX) throw new Error('Excel reader could not load. Check internet access or save the tracker as CSV.');
    const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array',cellDates:true});
    const preferred=wb.SheetNames.find(n=>/ets work tracker/i.test(n))||wb.SheetNames[0];
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[preferred],{defval:'',raw:false});
    return cleanRows(rows);
  }
  function normaliseForCore(rows){return rows.map(r=>{const out={...r};const ct=String(r['Card Type']||'').toLowerCase();if(Number(r.Level||0)===1){out['Card Type']=ct.includes('internal')?'Internal (EER)':'Commercial';if(!out.Stage)out.Stage=ct.includes('internal')?(r.Status||'In Progress'):(r.Status||'RFQ')}if(!out.Action&&r['Action Items'])out.Action=r['Action Items'];if(!out['Due Date']&&r['Completion Date'])out['Due Date']=r['Completion Date'];if(!out.Dependency&&r['Workshare Status']&&/block|hold|wait|depend/i.test(r['Workshare Status']))out.Dependency=r['Workshare Status'];return out})}
  function installImport(){
    const oldInput=document.getElementById('fileInput'),oldButton=document.getElementById('import');if(!oldInput||!oldButton)return;
    const input=oldInput.cloneNode(true);input.accept='.csv,.xlsx,.xls,.xlsm';oldInput.replaceWith(input);
    const button=oldButton.cloneNode(true);oldButton.replaceWith(button);
    button.onclick=()=>input.click();
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{toast('Reading tracker…');const rows=await readTracker(file);if(!rows.length)throw new Error('No tracker rows found');saveSource(file.name,rows);const result=await api('/api/import',{method:'POST',body:JSON.stringify({rows:normaliseForCore(rows)})});await load();toast(`Imported ${result.projectsAdded} projects and ${result.tasksAdded} child records`);renderTrackerData()}catch(e){toast(e.message)}finally{input.value=''}};
  }
  function addNav(){const nav=document.getElementById('nav');if(!nav||document.querySelector('[data-view="trackerdata"]'))return;const btn=document.createElement('button');btn.dataset.view='trackerdata';btn.textContent='Tracker Data';const audit=document.getElementById('auditNav');nav.insertBefore(btn,audit||null);btn.onclick=()=>setView('trackerdata')}
  function renderTrackerData(){
    if(S.view!=='trackerdata')return;const src=getSource();document.getElementById('title').textContent='Tracker Data';
    const missing=EXPECTED.filter(c=>!src.columns.includes(c));const present=EXPECTED.filter(c=>src.columns.includes(c));
    const visibleCols=src.columns.length?src.columns:EXPECTED;
    document.getElementById('root').innerHTML=`<div class="stats">${stat('Source rows',src.rows.length)}${stat('Columns',src.columns.length)}${stat('Mapped fields',present.length+'/'+EXPECTED.length)}${stat('Missing expected',missing.length)}</div><div class="panel"><div class="panel-head"><div><h3>Imported ETS Work Tracker</h3><p class="muted">${src.fileName?`Source: ${esc(src.fileName)} · imported ${fmtDate(src.importedAt)}`:'Import the client CSV/XLSX/XLSM tracker to populate this source-data view.'}</p></div>${S.data.permissions.importData?'<button id="trackerImport" class="primary">Import tracker</button>':''}</div>${missing.length?`<p><span class="pill alert">Missing source columns</span> ${missing.map(esc).join(', ')}</p>`:'<p><span class="pill good">Source field set matches the expected tracker structure</span></p>'}<div class="table-wrap"><table class="table"><thead><tr>${visibleCols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${src.rows.slice(0,250).map(r=>`<tr>${visibleCols.map(c=>`<td>${esc(r[c]||'')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${visibleCols.length}">No imported tracker source loaded in this browser.</td></tr>`}</tbody></table></div>${src.rows.length>250?'<p class="muted">Showing first 250 source rows for demo performance. All rows are still sent to the application importer.</p>':''}</div>`;
    document.getElementById('trackerImport')?.addEventListener('click',()=>document.getElementById('fileInput').click());
  }
  const priorRender=render;render=function(){if(S.view==='trackerdata'){renderTrackerData();return}priorRender()};
  const priorLoad=load;load=async function(){await priorLoad();addNav();installImport();if(S.view==='trackerdata')renderTrackerData()};
  addNav();installImport();
})();