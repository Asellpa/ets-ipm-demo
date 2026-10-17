const {test,expect}=require('@playwright/test');
async function login(page,name,id,password){
 await page.goto('/');
 await page.getByLabel('Username').fill(name);
 await page.getByLabel('User ID').fill(id);
 await page.getByLabel('Password').fill(password);
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByRole('heading',{name:'Overview',level:1})).toBeVisible();
}
test('custom restricted role is enforced by the backend and React navigation',async({page})=>{
 await login(page,'Stephan','123','Testing');
 const suffix=Date.now().toString(36);
 const roleName='QA Restricted '+suffix;
 const username='qa'+suffix;
 const userId='qa-'+suffix;
 const password='QaTemporary123!';
 const createdRole=await page.evaluate(async name=>{
  const r=await fetch('/api/admin/profiles',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description:'Temporary QA restricted role',permissions:{createEER:true}})});
  return {status:r.status,data:await r.json()};
 },roleName);
 expect(createdRole.status).toBe(201);
 const createdUser=await page.evaluate(async payload=>{
  const r=await fetch('/api/admin/users',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  return {status:r.status,data:await r.json()};
 },{name:'QA Restricted User',username,userId,password,profileId:createdRole.data.id});
 expect(createdUser.status).toBe(201);
 await page.getByRole('button',{name:'Sign out'}).click();
 await login(page,username,userId,password);
 await expect(page.getByRole('button',{name:'Role Management'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Manage Users'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Reports'})).toHaveCount(0);
 for(const route of ['/api/admin/profiles','/api/admin/users','/api/workflow-config']){
  const result=await page.evaluate(async path=>(await fetch(path,{credentials:'same-origin'})).status,route);
  expect(result,route).toBe(403);
 }
 const response=await page.evaluate(async()=>{
  const r=await fetch('/api/admin/profiles',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Unauthorized role',permissions:{manageRoles:true}})});
  return r.status;
 });
 expect(response).toBe(403);
});
test('commercial RFQ visibility and pricing are enforced server-side',async({page})=>{
 await login(page,'Stephan','123','Testing');
 const suffix=Date.now().toString(36);
 const secret='QA_SECRET_PRICE_'+suffix;
 const project=await page.evaluate(async({suffix,secret})=>{
  const r=await fetch('/api/projects',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'commercial',title:'QA Commercial '+suffix,rom:secret,stage:'RFQ'})});
  return {status:r.status,data:await r.json()};
 },{suffix,secret});
 expect(project.status).toBe(201);
 const role=await page.evaluate(async name=>{
  const r=await fetch('/api/admin/profiles',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,permissions:{viewCommercial:true,viewCommercialFields:false,viewRFQEngineering:false}})});
  return {status:r.status,data:await r.json()};
 },'QA Commercial Limited '+suffix);
 expect(role.status).toBe(201);
 const username='qac'+suffix,userId='qac-'+suffix,password='QaTemporary123!';
 const user=await page.evaluate(async payload=>{
  const r=await fetch('/api/admin/users',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  return {status:r.status,data:await r.json()};
 },{name:'QA Commercial Limited',username,userId,password,profileId:role.data.id});
 expect(user.status).toBe(201);
 await page.getByRole('button',{name:'Sign out'}).click();
 await login(page,username,userId,password);
 const bootstrap=await page.evaluate(async()=>(await fetch('/api/bootstrap',{credentials:'same-origin'})).json());
 const target=bootstrap.projects.find(p=>p.id===project.data.project.id);
 expect(target).toBeTruthy();
 expect(JSON.stringify(target)).not.toContain(secret);
 expect(target).not.toHaveProperty('pricing');
 const denied=await page.evaluate(async id=>(await fetch('/api/projects/'+id,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({pricing:'tampered'})})).status,project.data.project.id);
 expect(denied).toBe(403);
});
