const {test,expect}=require('@playwright/test');
test('administrator can filter reports and export results',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Username').fill('Stephan');
 await page.getByLabel('User ID').fill('123');
 await page.getByLabel('Password').fill('Testing');
 await page.getByRole('button',{name:'Sign in'}).click();
 await page.getByRole('button',{name:'Reports'}).click();
 await expect(page.getByRole('heading',{name:'Reports and filters'})).toBeVisible();
 await expect(page.getByLabel('Task status')).toBeVisible();
 await expect(page.getByRole('button',{name:'Export filtered CSV'})).toBeVisible();
 const statusFilter=page.getByRole('combobox',{name:'Task status'});
 await expect(statusFilter).toBeVisible({timeout:5000});
 await statusFilter.selectOption('Completed',{timeout:5000});
});
