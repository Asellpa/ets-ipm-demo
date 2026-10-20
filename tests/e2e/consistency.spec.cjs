const {test,expect}=require('@playwright/test');
async function login(page){await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('Stephan');await page.getByLabel('User ID',{exact:true}).fill('123');await page.getByLabel('Password',{exact:true}).fill('Testing');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',level:1})).toBeVisible()}
test('project and work package date rules reject invalid writes without changing saved dates',async({page})=>{
 await login(page);
 const create=async(data)=>page.request.post('/api/projects',{data:{type:'internal_eer',title:'Date validation QA',...data}});
 for(const dates of [{startDate:'3001-02-03'},{startDate:'2026-10-20',edd:'2026-10-19'},{startDate:'2026-02-30'}])expect((await create(dates)).status()).toBe(422);
 const response=await create({startDate:'2026-10-20',edd:'2026-10-21'});expect(response.status()).toBe(201);const {project}=await response.json();
 expect((await page.request.patch('/api/projects/'+project.id,{data:{startDate:'2026-10-22'}})).status()).toBe(422);
 for(const path of ['/api/tasks','/api/work-packages'])for(const dates of [{startDate:'3001-01-01'},{startDate:'2026-10-20',dueDate:'2026-10-19'}])expect((await page.request.post(path,{data:{projectId:project.id,title:'Invalid schedule',...dates}})).status()).toBe(422);
 expect((await page.request.post('/api/import',{data:{rows:[{WBS:'DATE-QA',Level:1,'Start Date':'3001-01-01'}]}})).status()).toBe(422);
});
test('form controls share a font, date constraints and focused user editing',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Project Register',exact:true}).click();await page.getByRole('button',{name:'+ New project',exact:true}).click();
 const font=await page.getByLabel('Project title',{exact:true}).evaluate(el=>getComputedStyle(el).fontFamily);
 for(const label of ['Scope','Project type','Remarks'])expect(await page.getByLabel(label,{exact:true}).evaluate(el=>getComputedStyle(el).fontFamily)).toBe(font);
 await page.getByLabel('Start date',{exact:true}).fill('2026-10-20');await page.getByLabel('Expected delivery date',{exact:true}).fill('2026-10-19');expect(await page.getByLabel('Expected delivery date',{exact:true}).evaluate(el=>el.validity.rangeUnderflow)).toBe(true);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Manage Users',exact:true}).click();await page.getByRole('button',{name:'+ New user',exact:true}).click();await expect(page.getByRole('button',{name:/Active Users/})).toHaveCount(0);await expect(page.getByRole('button',{name:/Offboarded \/ Inactive/})).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:/Active Users/})).toBeVisible();await page.getByRole('button',{name:'Edit',exact:true}).first().click();await expect(page.getByRole('button',{name:/Active Users/})).toHaveCount(0);await expect(page.getByRole('button',{name:/Offboarded \/ Inactive/})).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Tasks & Work Packages',exact:true}).click();const task=page.getByRole('button',{name:'+ New task',exact:true});const work=page.getByRole('button',{name:'+ New work package',exact:true});if(await task.isVisible()){const a=await task.boundingBox(),b=await work.boundingBox();expect(Math.abs(a.y-b.y)).toBeLessThan(2);expect(b.x-a.x-a.width).toBeLessThanOrEqual(12);expect(a.height).toBe(b.height)}
});
