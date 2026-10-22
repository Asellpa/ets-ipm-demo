const {financialFile,financialNode}=require('./financial-access');
const crypto=require('node:crypto');
const MAX_FILE=2*1024*1024,MAX_PROJECT=20*1024*1024;
const formats={pdf:['application/pdf',b=>b.subarray(0,5).toString()==='%PDF-'],png:['image/png',b=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))],jpg:['image/jpeg',b=>b[0]===255&&b[1]===216&&b[2]===255],jpeg:['image/jpeg',b=>b[0]===255&&b[1]===216&&b[2]===255],txt:['text/plain',b=>!b.includes(0)&&Buffer.from(b.toString('utf8')).equals(b)],csv:['text/csv',b=>!b.includes(0)&&Buffer.from(b.toString('utf8')).equals(b)]};
function validateFile(b){
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>180||/[\\/\x00-\x1f]/.test(b.name))return {error:'Use a filename of at most 180 characters without folders or control characters'};
 const ext=b.name.split('.').pop().toLowerCase(),format=formats[ext];
 if(!format)return {error:'Supported files: PDF, PNG, JPG, TXT and CSV'};
 if(typeof b.data!=='string'||b.data.length>Math.ceil(MAX_FILE/3)*4||!b.data.length||b.data.length%4!==0||/[^A-Za-z0-9+/=]/.test(b.data))return {error:'Choose a nonempty file up to 2 MB'};
 const bytes=Buffer.from(b.data,'base64');
 if(!bytes.length||bytes.toString('base64')!==b.data||bytes.length>MAX_FILE||!format[1](bytes))return {error:'File contents do not match the supported file type, or exceed 2 MB'};
 return {name:b.name.trim(),mime:format[0],size:bytes.length,data:bytes.toString('base64'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
const metadata=({data,...file})=>file;
async function handleAttachments(ctx){
 const {req,res,url,db,user,ps,WF,body,send,canReadTask,project,audit,write,id,now}=ctx;
 const match=url.pathname.match(/^\/api\/projects\/([^/]+)\/objects\/([^/]+)\/attachments(?:\/([^/]+))?$/);
 if(!match)return false;
 const pid=decodeURIComponent(match[1]),nodeId=decodeURIComponent(match[2]),aid=match[3]&&decodeURIComponent(match[3]),p=project(db,pid),instance=db.projectWorkflows[pid];
 if(!p||!instance?.nodes.some(n=>n.id===nodeId)||!canReadTask({},ps,p,db,user)||!WF.canRead(db,p,user,ps,nodeId)){send(res,404,{error:'Object not found or access restricted'});return true;}
 const files=db.objectAttachments ||= [];const node=instance.nodes.find(n=>n.id===nodeId);const visible=f=>!financialFile(f,node,instance.nodes)||!!ps.viewCommercialFields;
 if(req.method==='GET'){
  if(!aid)send(res,200,{attachments:files.filter(f=>f.projectId===pid&&f.nodeId===nodeId&&visible(f)).map(f=>({...metadata(f),canRemove:f.uploadedById===user.id||!!ps.editProjects})),canEdit:!WF.editError(db,p,user,ps,nodeId)&&(!financialNode(instance.nodes,node)||!!ps.viewCommercialFields)});
  else{const f=files.find(f=>f.id===aid&&f.projectId===pid&&f.nodeId===nodeId);if(!f||!visible(f))send(res,404,{error:'Attachment not found'});else send(res,200,Buffer.from(f.data,'base64'),f.mime,{'Content-Disposition':`attachment; filename="${f.name.replace(/[^a-zA-Z0-9._ -]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(f.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});}
  return true;
 }
 const locked=WF.editError(db,p,user,ps,nodeId);if(locked){send(res,403,{error:locked});return true;}
 if(req.method==='POST'&&!aid){
  const b=await body(req);if(b.dataGroup!==undefined&&!['general','commercial'].includes(b.dataGroup)){send(res,422,{error:'Choose a valid attachment visibility'});return true;}const checked=validateFile(b);if(checked.error){send(res,422,{error:checked.error});return true;}
  const restricted=financialFile({...checked,dataGroup:b.dataGroup},node,instance.nodes);if(restricted&&!ps.viewCommercialFields){send(res,403,{error:'Restricted commercial permission required for this attachment'});return true;}
  if(files.filter(f=>f.projectId===pid&&f.nodeId===nodeId).length>=20||files.filter(f=>f.projectId===pid).reduce((n,f)=>n+f.size,0)+checked.size>MAX_PROJECT){send(res,422,{error:'Attachment limit reached: 20 files per object and 20 MB per project'});return true;}
  const f={...checked,dataGroup:restricted?'commercial':'general',id:id('file'),projectId:pid,nodeId,uploadedBy:user.name,uploadedById:user.id,uploadedAt:now()};files.push(f);instance.revision++;
  audit(db,user,'Attached '+f.name,{entityType:'attachment',entityId:f.id,projectId:pid,workflowNodeId:nodeId,dataGroup:financialFile(f,node,instance.nodes)?'commercial':'general'});write(db);send(res,201,{attachment:metadata(f)});return true;
 }
 if(req.method==='DELETE'&&aid){
  const f=files.find(f=>f.id===aid&&f.projectId===pid&&f.nodeId===nodeId);if(!f||!visible(f)){send(res,404,{error:'Attachment not found'});return true;}
  if(f.uploadedById!==user.id&&!ps.editProjects){send(res,403,{error:'Only the uploader or a project editor can remove an attachment'});return true;}
  db.objectAttachments=files.filter(x=>x.id!==aid);instance.revision++;
  audit(db,user,'Removed attachment '+f.name,{entityType:'attachment',entityId:f.id,projectId:pid,workflowNodeId:nodeId,dataGroup:financialFile(f,node,instance.nodes)?'commercial':'general'});write(db);send(res,200,{ok:true});return true;
 }
 send(res,405,{error:'Unsupported attachment action'});return true;
}
module.exports={handleAttachments,validateFile};
