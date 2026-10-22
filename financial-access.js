// Financial metadata is protected even when an old/custom field omitted its data group.
const financialName=value=>/\b(budgets?|costs?|pricing|prices?|rom|quotes?|quotations?|negotiations?|offers?|agreements?|purchase orders?|po status|hourly rate|labour rate|labor rate|mh rate)\b/i.test(String(value||''));
function financialNode(nodes,node){const seen=new Set();let current=node;while(current&&!seen.has(current.id)){if(financialName(current.name))return true;seen.add(current.id);current=(nodes||[]).find(n=>n.id===current.parent)}return false;}
const financialField=(field,node)=>node?.financialRestricted||field.dataGroup==='commercial'||financialName(field.label)||financialName(field.section)||financialName(node?.name);
const financialFile=(file,node,nodes)=>file.dataGroup==='commercial'||financialName(file.name)||financialNode(nodes,node);
const financialMappings=nodes=>new Set((nodes||[]).flatMap(node=>(node.fields||[]).filter(f=>f.projectField&&financialField(f,{...node,financialRestricted:financialNode(nodes,node)})).map(f=>f.projectField)));
module.exports={financialName,financialField,financialFile,financialNode,financialMappings};
