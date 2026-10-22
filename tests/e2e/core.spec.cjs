const {test,expect}=require('@playwright/test');
async function login(page){
 await page.goto('/');
 await page.getByLabel('Username').fill('Stephan');
 await page.getByLabel('User ID').fill('123');
 await page.getByLabel('Password').fill('Testing');
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
}
test('login, create internal project, create task, and verify persistence',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Project Register'}).click();
 await page.getByRole('button',{name:'+ New project'}).click();
 await page.getByLabel('Project type').selectOption('internal_eer');await expect(page.getByLabel('Workflow',{exact:true})).toHaveValue('eer');
 await page.getByLabel('Record name (optional)').fill('Playwright isolated project');
 await page.getByRole('button',{name:'Save project'}).click();
 await expect(page.getByRole('dialog',{name:'Project: Playwright isolated project',exact:true}).getByRole('heading',{name:'Playwright isolated project',exact:true})).toBeVisible();
 if(await page.getByRole('dialog',{name:/^Project:/}).count())await page.getByRole('button',{name:'Close project',exact:true}).click();await page.getByRole('button',{name:'Tasks & Departments'}).click();
 await page.getByRole('button',{name:'+ Add',exact:true}).click();await page.getByRole('button',{name:'New task',exact:true}).click();
 await page.getByLabel('Title').fill('Playwright isolated task');
 await page.getByRole('button',{name:'Save task'}).click();
 await expect(page.getByText('Playwright isolated task')).toBeVisible();
 await page.reload();
 if(await page.getByRole('dialog',{name:/^Project:/}).count())await page.getByRole('button',{name:'Close project',exact:true}).click();await page.getByRole('button',{name:'Tasks & Departments'}).click();
 await expect(page.getByText('Playwright isolated task')).toBeVisible();
});
test('role management loads server permissions and settings screen opens',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Role Management'}).click();
 await expect(page.getByRole('heading',{name:'Role Management',level:1})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Permission Profiles',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Manage Permissions',exact:true}).first().click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Manage Roles',{exact:false})).toBeDisabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Project Settings'}).click();
 await expect(page.getByRole('heading',{name:'System settings'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Workflow configuration'})).toBeVisible();
});
test('unauthenticated API requests are rejected',async({request})=>{
 const response=await request.get('http://127.0.0.1:5174/api/bootstrap');
 expect(response.status()).toBe(401);
});


test('custom role profile creation, editing and deletion persist',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Role Management',exact:true}).click();await page.getByRole('button',{name:'+ Create Profile',exact:true}).click();const name='QA custom role '+Date.now();const dialog=page.getByRole('dialog');await dialog.getByLabel('Profile Name',{exact:true}).fill(name);await dialog.getByLabel('View Projects',{exact:false}).check();await dialog.getByRole('button',{name:'Save Profile',exact:true}).click();await expect(dialog).toHaveCount(0);await page.reload();await page.getByRole('button',{name:'Role Management',exact:true}).click();const card=page.getByRole('article').filter({has:page.getByRole('heading',{name,exact:true})});await expect(card).toContainText('1 permissions enabled');await card.getByRole('button',{name:'Manage Permissions',exact:true}).click();await expect(dialog.getByLabel('View Projects',{exact:false})).toBeChecked();await dialog.getByLabel('View RFQ Engineering / MH Fields',{exact:false}).check();await dialog.getByRole('button',{name:'Save Profile',exact:true}).click();await expect(card).toContainText('2 permissions enabled');await card.getByRole('button',{name:'Manage Permissions',exact:true}).click();page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Delete Profile',exact:true}).click();await expect(card).toHaveCount(0);
});
