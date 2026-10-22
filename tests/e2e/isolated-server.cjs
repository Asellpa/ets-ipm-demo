// E2E-only backend: never reads or writes the developer's data/db.json.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ets-ipm-playwright-'));
fs.copyFileSync(path.join(root,'data','seed.json'),path.join(temp,'seed.json'));
const child=spawn(process.execPath,[path.join(root,'server.js')],{
 env:{...process.env,PORT:'5174',ETS_DATA_DIR:temp},stdio:'inherit'
});
let closed=false;
function cleanup(){if(closed)return;closed=true;child.kill();fs.rmSync(temp,{recursive:true,force:true});}
process.on('SIGINT',()=>{cleanup();process.exit(130)});
process.on('SIGTERM',()=>{cleanup();process.exit(143)});
process.on('exit',cleanup);
child.on('exit',code=>{cleanup();process.exit(code||0)});

