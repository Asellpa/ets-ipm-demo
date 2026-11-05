const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function scan(bytes){
 if(!process.env.CLAMD_HOST){if(process.env.NODE_ENV==='production')throw Object.assign(Error('File scanner unavailable'),{statusCode:503});return;}
 await new Promise((resolve,reject)=>{
  const socket=net.createConnection({host:process.env.CLAMD_HOST,port:Number(process.env.CLAMD_PORT||3310)});let response='',finished=false;
  const finish=e=>{if(finished)return;finished=true;socket.destroy();e?reject(e):resolve();};
  socket.setTimeout(15000,()=>finish(Object.assign(Error('File scanner timed out. Try again later.'),{statusCode:503})));
  socket.on('error',()=>finish(Object.assign(Error('File scanner unavailable. Try again later.'),{statusCode:503})));
  socket.on('connect',()=>{socket.write('zINSTREAM\0');const n=Buffer.alloc(4);n.writeUInt32BE(bytes.length);socket.write(n);socket.write(bytes);socket.write(Buffer.alloc(4));});
  socket.on('data',chunk=>{response+=chunk.toString();if(response.length>4096)return finish(Error('Invalid scanner response'));if(/[\0\n]/.test(response)){const result=response.split(/[\0\n]/)[0];finish(result==='stream: OK'?null:Object.assign(Error(/ FOUND$/.test(result)?'File rejected by malware scanner':'File scanner could not approve this file'),{statusCode:/ FOUND$/.test(result)?422:503}));}});
  socket.on('end',()=>{if(!finished)finish(Object.assign(Error('Incomplete scanner response'),{statusCode:503}));});
 });
}
function location(key){if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid private file key');return path.join(path.resolve(process.env.ETS_FILE_DIR),key.slice(0,2),key);}
async function store(file){
 const bytes=Buffer.from(file.data,'base64');await scan(bytes);
 if(!process.env.ETS_FILE_DIR)return file;
 const key=digest(bytes),target=location(key);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
 try{fs.writeFileSync(target,bytes,{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(digest(fs.readFileSync(target))!==key)throw Error('Private file integrity failure');}
 const {data,...metadata}=file;return {...metadata,size:bytes.length,sha256:key,storageKey:key,scanStatus:'clean'};
}
function bytes(file){
 if(file.storageKey){if(file.scanStatus!=='clean')throw Error('File is not approved for download');const b=fs.readFileSync(location(file.storageKey));if(digest(b)!==file.storageKey||b.length!==file.size)throw Error('Private file integrity failure');return b;}
 if(process.env.NODE_ENV==='production')throw Error('Legacy file requires migration and scanning');return Buffer.from(file.data,'base64');
}
function exportFile(file){return {...file,data:bytes(file).toString('base64'),storageKey:undefined};}
async function migrate(db){for(const f of db.objectAttachments||[])Object.assign(f,await store(f));for(const f of db.objectAttachments||[])if(f.storageKey)delete f.data;for(const f of db.feedback||[])if(f.screenshot&&!f.screenshot.storageKey)f.screenshot=await store(f.screenshot);return db;}
module.exports={scan,store,bytes,exportFile,migrate,digest};
