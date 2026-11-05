// Adds a visual-designer entry point to workflow configuration cards without replacing existing editing.
(() => {
  function enhance(){
    if(S.view!=='workflowconfig')return;
    document.querySelectorAll('.edit-workflow').forEach(edit=>{
      const id=edit.dataset.id,card=edit.closest('.feature');
      if(!card)return;
      let actions=card.querySelector('.tile-actions.workflow-actions');
      if(!actions){actions=document.createElement('div');actions.className='tile-actions workflow-actions';card.appendChild(actions)}
      let designer=card.querySelector('[data-designer]');
      if(!designer){designer=document.createElement('button');designer.className='primary';designer.dataset.designer=id;designer.textContent='Open Designer';designer.type='button'}
      if(designer.parentElement!==actions)actions.appendChild(designer);
      if(edit.parentElement!==actions)actions.appendChild(edit);
      designer.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(typeof window.openWorkflowDesigner==='function')window.openWorkflowDesigner(id);else toast('Workflow Designer is not available yet')};
    });
    const add=document.getElementById('addWorkflow');
    if(add&&!add.dataset.visualBound){add.dataset.visualBound='1';const old=add.onclick;add.onclick=()=>{old?.();setTimeout(()=>{const save=document.getElementById('saveWorkflow');if(!save)return;const oldSave=save.onclick;save.textContent='Create & Open Designer';save.onclick=()=>{const before=(JSON.parse(localStorage.getItem('ets_ipm_architecture_v1')||'{}').workflows||[]).map(w=>w.id);oldSave?.();setTimeout(()=>{const c=JSON.parse(localStorage.getItem('ets_ipm_architecture_v1')||'{}');const created=(c.workflows||[]).find(w=>!before.includes(w.id));if(created&&window.openWorkflowDesigner)window.openWorkflowDesigner(created.id)},40)}} ,0)}}
  }
  const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',enhance);setTimeout(enhance,100);
})();