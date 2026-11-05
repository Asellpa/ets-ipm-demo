// Keeps the visual workflow designer stable while the legacy app shell refreshes/renders.
(() => {
  const previousRender = render;
  render = function(){
    if(S.view === 'workflowdesigner' && document.querySelector('.designer-shell')) return;
    return previousRender();
  };
  window.render = render;

  // Do NOT stop propagation during capture: that prevents the designer's own
  // button/node handlers from receiving clicks. Designer controls already stop
  // propagation where shell isolation is required.
})();