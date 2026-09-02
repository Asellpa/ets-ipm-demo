// Adds a visual-designer entry point to workflow configuration cards without replacing existing editing.
(() => {
  function enhance(){
    if(S.view!=='workflowconfig')return;
    document.querySelectorAll('.edit-workflow').forEach(edit=>{
      const id=edit.dataset.id,card=edit.closest('.feature');
      if(!card||card.querySelector('[data-designer]'))return;
      const b=document.createElement('button');b.className='primary';b.dataset.designer=id;b.textContent='Open Designer';b.style.marginTop='8px';b.style.marginRight='7px';card.insertBefore(b,edit);
    });
    const add=document.getElementById('addWorkflow');
    if(add&&!add.dataset.visualBound){add.dataset.visualBound='1';const old=add.onclick;add.onclick=()=>{old?.();setTimeout(()=>{const save=document.getElementById('saveWorkflow');if(!save)return;const oldSave=save.onclick;save.textContent='Create & Open Designer';save.onclick=()=>{const before=(JSON.parse(localStorage.getItem('ets_ipm_architecture_v1')||'{}').workflows||[]).map(w=>w.id);oldSave?.();setTimeout(()=>{const c=JSON.parse(localStorage.getItem('ets_ipm_architecture_v1')||'{}');const created=(c.workflows||[]).find(w=>!before.includes(w.id));if(created&&window.openWorkflowDesigner)openWorkflowDesigner(created.id)},30)}} ,0)}}
  }
  const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',enhance);setTimeout(enhance,100);
})();