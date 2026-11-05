// Role-specific field policy. Object access, financial protection and workflow locks remain ceilings.
function fieldAccess(field,profileId){return profileId==='prof-admin'?'edit':field.permissions?.[profileId]||'inherit';}
function mappedAccess(db,p,user,ps,WF){
 const instance=db.projectWorkflows?.[p.id],result={};if(!instance||!user)return result;
 for(const node of instance.nodes){const level=WF.access(instance,node,p,user,ps),open=instance.states[node.id]?.status==='In progress';for(const field of require('./workflow-fields').fieldsFor(node)){if(!field.projectField)continue;const financial=require('./financial-access');const restricted=financial.financialField(field,{...node,financialRestricted:financial.financialNode(instance.nodes,node)});const rule=fieldAccess(field,user.profileId),value=level==='hidden'||rule==='hidden'||restricted&&!(p.type==='commercial'&&ps.viewCommercialFields)?'hidden':!open||['view','hidden'].includes(level)||rule==='view'?'view':'edit';const old=result[field.projectField];if(!old||['hidden','view','edit'].indexOf(value)<['hidden','view','edit'].indexOf(old))result[field.projectField]=value;}}
 return result;
}
module.exports={fieldAccess,mappedAccess};
