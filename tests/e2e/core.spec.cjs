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
 await page.getByLabel('Project type').selectOption('internal_eer');
 await page.getByLabel('Project title').fill('Playwright isolated project');
 await page.getByRole('button',{name:'Save project'}).click();
 await expect(page.getByText('Playwright isolated project')).toBeVisible();
 await page.getByRole('button',{name:'Tasks & Work Packages'}).click();
 await page.getByRole('button',{name:'+ New task'}).click();
 await page.getByLabel('Title').fill('Playwright isolated task');
 await page.getByRole('button',{name:'Save task'}).click();
 await expect(page.getByText('Playwright isolated task')).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'Tasks & Work Packages'}).click();
 await expect(page.getByText('Playwright isolated task')).toBeVisible();
});
test('role management loads server permissions and settings screen opens',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Role Management'}).click();
 await expect(page.getByRole('heading',{name:'Role Management',level:1})).toBeVisible();
 await expect(page.getByText('Permissions',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Project Configuration'}).click();
 await expect(page.getByRole('heading',{name:'System settings'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Workflow configuration'})).toBeVisible();
});
test('unauthenticated API requests are rejected',async({request})=>{
 const response=await request.get('http://127.0.0.1:5174/api/bootstrap');
 expect(response.status()).toBe(401);
});
