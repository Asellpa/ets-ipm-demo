// Run locally with the backend stopped. No credentials belong in source or command arguments.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {prepareDemo}=require('../demo-maintenance');
const dir=process.env.ETS_DATA_DIR?path.resolve(process.env.ETS_DATA_DIR):path.resolve(__dirname,'../data');
const file=path.join(dir,'db.json');
function passwordPrompt(label='Password for sysadmin (hidden): '){
  if(!process.stdin.isTTY)throw Error('Run this command in an interactive terminal so password entry can be hidden.');
  return new Promise((resolve,reject)=>{
    let value='';process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();
    function finish(error){process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value)}
    function read(chunk){for(const c of chunk.toString()){if(c==='\u0003'){finish(Error('Cancelled; no changes made'));return}if(c==='\r'||c==='\n'){finish();return}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c}}
    process.stdin.on('data',read);
  });
}
async function main(){
  const running=await new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:Number(process.env.PORT||5174)});socket.setTimeout(1000);socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',()=>resolve(false));socket.once('timeout',()=>{socket.destroy();resolve(false)})});
  if(running)throw Error('Stop the backend on port '+(process.env.PORT||5174)+' before running setup.');
  if(!fs.existsSync(file))throw Error('Existing data/db.json was not found. Start and stop the backend once first.');
  const original=fs.readFileSync(file,'utf8'),db=JSON.parse(original);
  if(db.maintenance?.sysadmin1309Setup){console.log('Setup was already completed. No accounts or projects were changed.');return}
  console.log(`This one-time setup clears ${(db.projects||[]).length} project records and their linked work, creates sysadmin / ID 1309, and gives Stephan Admin access. A private local backup is kept.`);
  const password=await passwordPrompt();
  const again=await passwordPrompt('Confirm password (hidden): ');
  if(password!==again)throw Error('Passwords did not match; no changes made.');
  prepareDemo(db,password);
  // Fail rather than overwrite any concurrent change.
  if(fs.readFileSync(file,'utf8')!==original)throw Error('Database changed during setup. Stop the backend and try again.');
  const backup=file+'.backup-'+Date.now(),temp=file+'.setup-'+process.pid;
  fs.writeFileSync(backup,original,{mode:0o600,flag:'wx'});
  fs.writeFileSync(temp,JSON.stringify(db,null,2),{mode:0o600,flag:'wx'});
  fs.renameSync(temp,file);
  console.log('Done. Register cleared; sysadmin created; Stephan is Admin. Restart both servers and sign in with sysadmin / 1309.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
