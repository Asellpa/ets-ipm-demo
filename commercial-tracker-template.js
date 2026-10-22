// Field names and choices follow the supplied Trial 14 tracker; records remain blank.
const id='commercial-tracker';
const choices={doa:['EASA 21J','N/A','EASA 21J, 21G','EASA 21G','GCAA 21J','GACA 21J','FAA 21J','EASA 21J, GCAA 21J','EASA 21J, GACA 21J','EASA 145','-'],mro:['EASA 21G','EASA','EASA 145','GCAA 21G','EASA, GCAA','GCAA 145','EASA 21G, GCAA 21G','EASA 145, GCAA 145','CoC','-'],workshare:['Pending','P.L Shared to Manager','P.L Shared to DOA','P.L Updated by UAC','MHA Breakdown Shared to Manager',"Demande D'Achat Prepared","Demande D'Achat Submitted",'-']};
function create(){
 const field=(key,label,type='text',extra={})=>({id:key,label,type,required:false,dataGroup:'general',...extra});
 const mapped=(key,label,type='text',extra={})=>field(key,label,type,{projectField:key,...extra});
 const select=(key,label,options,extra={})=>mapped(key,label,'select',{options,...extra});
 const restricted=(key,label,type='text',extra={})=>mapped(key,label,type,{dataGroup:'commercial',...extra});
 const node=(id,name,parent='',fields=[],extra={})=>({id,name,parent,type:parent?'object':'stage',completion:'manual',permissions:{},requiredFields:[],taskTemplates:[],parallelWithPrevious:!!parent,fields,...extra});
 const nodes=[
 node('overview','Overview','',[
  mapped('title','Project','text',{required:true}),mapped('client','CLIENT','text',{required:true}),mapped('scope','Details','textarea',{required:true}),mapped('startDate','Start Date','date',{required:true}),select('priority','Priority',['High','Normal','Low','TBD']),mapped('requestDate','Request Date','date')]),
 node('planning','Planning','',[mapped('edd','Expected delivery date','date'),field('plan','Planning notes','textarea')]),
 node('implementation','Implementation','',[mapped('actionItems','Action Items','textarea'),mapped('dependency','Escalation / blocked by','textarea'),mapped('remarks','Remarks','textarea')]),
 node('review','Review & Approval','',[field('review','Review comments','textarea',{required:true})]),
 node('delivery','Delivery','',[mapped('deliverables','Deliverables','textarea',{required:true}),mapped('completionDate','Completion Date','date',{required:true})]),
 node('closure','Closure','',[field('closure','Closure notes','textarea',{required:true})]),
 node('aircraft-scope','Aircraft & scope','overview',[mapped('aircraft','Aircraft'),mapped('registration','A/C Reg'),select('doaScope','DOA Scope',choices.doa),select('releaseType','MRO Release',choices.mro)],{parallelWithPrevious:false}),
 node('contacts','People & contacts','overview',[mapped('owner','Owner'),mapped('clientFocal','Client Focal'),mapped('doaFocal','DOA focal'),mapped('customerSupport','Customer Support')]),
 node('references','Programme & references','overview',[mapped('programme','Programme'),mapped('sage','Sage'),mapped('site','Site'),mapped('internalClient','Internal Client'),select('nreStatus','NRE Status',['Not Required','Pending Approval','Approved','In Progress','Closed']),mapped('projectTimeline','Project Timeline','textarea')]),
 node('commercial','Commercial & quotations','overview',[
  restricted('rom','ROM','select',{options:['Pending (DOA)','Confirmed (DOA)','Shared to Client','-']}),restricted('poStatus','PO Status','select',{options:['Pending','Received','-']}),restricted('mhRate','BU-BU MH Rate (AED)','number',{min:0}),restricted('internalQuote','Internal Quote (AED)','number',{min:0}),restricted('purchaseRequest',"Demande d'achat",'select',{options:['Not Started','Prepared','Submitted','Approved','-']}),restricted('internalQuoteStatus','Internal Quote Status','select',{options:['Pending','Sent','Under Review','Approved','Rejected','Revised','-']}),restricted('internalPoStatus','Internal PO Status','select',{options:['Pending','Received','-']}),restricted('externalQuoteValue','External Quote Value'),restricted('negotiationNotes','Negotiation notes','textarea'),restricted('offerDetails','Offer details','textarea'),restricted('agreementDetails','Agreement details','textarea')],{permissions:{'prof-ltse':'hidden','prof-tse':'hidden'}}),
 node('workshare','Work classification & workshare','planning',[select('taskClassification','Task Classification',['DOA Delegated','DOA Support','ETS Dept','-']),select('department','ETS Sub-Dept',['Cert.','M&I','P&S','Cert, M&I','Cert, M&I, P&S','Cert, P&S','M&I, P&S','-']),select('workshareStatus','Workshare Status',choices.workshare)],{parallelWithPrevious:false}),
 node('team','Team & supervision','planning',[field('team','Team members and responsibilities','textarea',{required:true}),mapped('requiredInputs','Required inputs','textarea')])];
 return {id,name:'Commercial tracker',projectType:'commercial',description:'Commercial fields from the current tracker, organised into workflow objects. Schedule tasks and log hours in Resource Planning and My Work.',stages:nodes.filter(n=>!n.parent).map(n=>n.name),objects:[],nodes};
}
function projects(){
 const old=create(); const sectionNames={'overview':'Project details','aircraft-scope':'Aircraft & scope','contacts':'People & contacts','references':'Programme & references','commercial':'Commercial & quotations','workshare':'Work classification'};
 const fields=old.nodes.filter(n=>sectionNames[n.id]).flatMap(n=>n.fields.map(f=>({...f,section:sectionNames[n.id]}))).filter(f=>!['startDate','requestDate','workshareStatus'].includes(f.id));
 const dates=old.nodes.flatMap(n=>n.fields).filter(f=>['startDate','requestDate','edd','completionDate','workshareStatus'].includes(f.id)).map(f=>({...f,required:false,section:f.type==='date'?'Schedule':'Workshare'}));
 const node=(id,name,fields,parallel=false)=>({id,name,parent:'',type:'stage',completion:'manual',permissions:{},requiredFields:[],taskTemplates:[],fields,parallelWithPrevious:parallel,view:id==='execution'?'departments':id==='dates-hours'?'hours':'fields'});
 return {id:'commercial',name:'Projects',projectType:'commercial',description:'Project details in Overview, dates and hours together, and tasks grouped by department.',stages:['Overview','Dates & hours','Departments & tasks','Review & closure'],objects:[],nodes:[node('overview','Overview',fields),node('dates-hours','Dates & hours',dates,true),node('execution','Departments & tasks',old.nodes.find(n=>n.id==='implementation').fields,true),node('closure','Review & closure',old.nodes.find(n=>n.id==='closure').fields)]};
}
module.exports={id,create,projects};
