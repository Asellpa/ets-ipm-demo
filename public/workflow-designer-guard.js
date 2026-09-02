// Keeps the visual workflow designer stable while the legacy app shell refreshes/renders.
(() => {
  const previousRender = render;
  render = function(){
    if(S.view === 'workflowdesigner' && document.querySelector('.designer-shell')) return;
    return previousRender();
  };
  window.render = render;

  // Designer interactions are self-contained. Prevent unrelated delegated shell clicks
  // from treating designer controls as normal workspace navigation.
  document.addEventListener('click', e => {
    const shell = e.target.closest?.('.designer-shell');
    if(shell) e.stopPropagation();
  }, true);
})();