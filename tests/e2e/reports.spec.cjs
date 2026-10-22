const {test,expect}=require('@playwright/test');
test('administrator can filter reports and export results',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Username').fill('Stephan');
 await page.getByLabel('User ID').fill('123');
 await page.getByLabel('Password').fill('Testing');
 await page.getByRole('button',{name:'Sign in'}).click();
 await page.getByRole('button',{name:'Project Register'}).click();
 await page.getByRole('button',{name:'+ New project'}).click();
 await page.getByLabel('Project type').selectOption('internal_eer');
 await page.getByLabel('Record name (optional)').fill('QA Completed Report Project');
 await page.getByRole('button',{name:'Save project'}).click();
 await page.getByRole('dialog',{name:'Project: QA Completed Report Project',exact:true}).waitFor({state:'visible'});await page.getByRole('button',{name:'Close project',exact:true}).click();await page.getByRole('button',{name:'Tasks & Departments'}).click();
 await page.getByRole('button',{name:'+ Add',exact:true}).click();await page.getByRole('button',{name:'New task',exact:true}).click();
 await page.getByLabel('Title').fill('QA Completed Report Task');
 await page.getByLabel('Task workflow object',{exact:true}).selectOption('phase-0');await page.getByLabel('Status').selectOption('Completed');
 await page.getByRole('button',{name:'Save task'}).click();
 await page.getByRole('button',{name:'Reports'}).click();
 await expect(page.getByRole('navigation',{name:'Report views'})).toBeVisible();
 await page.getByRole('button',{name:'Task details',exact:true}).click();
 await expect(page.getByLabel('Task status')).toBeVisible();
 await expect(page.getByRole('button',{name:'Export filtered CSV'})).toBeVisible();
 const statusFilter=page.getByRole('combobox',{name:'Task status'});
 await expect(statusFilter).toBeVisible({timeout:5000});
 await statusFilter.selectOption('Completed',{timeout:5000});
 await expect(page.getByRole('table').getByText('QA Completed Report Task')).toBeVisible();
});

test('report overview, overdue drill-down, workload and empty filters use consistent data',async({page})=>{
 await page.goto('/');await page.getByLabel('Username').fill('Stephan');await page.getByLabel('User ID').fill('123');await page.getByLabel('Password').fill('Testing');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',level:1})).toBeVisible();
 const suffix=Date.now().toString(36),name='Report drilldown '+suffix;let r=await page.request.post('/api/projects',{data:{workflowId:'eer',type:'internal_eer',title:name}});expect(r.status()).toBe(201);const {project}=await r.json();
 r=await page.request.post('/api/tasks',{data:{projectId:project.id,workflowNodeId:'phase-0',title:'Late report task '+suffix,mhEstimate:8,mhActual:2,status:'In Progress',assignee:'Stephan',startDate:'2026-01-01',dueDate:'2026-01-02'}});expect(r.status()).toBe(201);
 r=await page.request.post('/api/tasks',{data:{projectId:project.id,workflowNodeId:'phase-0',title:'Finished report task '+suffix,mhEstimate:4,mhActual:3,status:'Completed'}});expect(r.status()).toBe(201);
 await page.reload();await page.getByRole('button',{name:'Reports',exact:true}).click();await page.getByLabel('Project',{exact:true}).selectOption(project.id);await expect(page.getByRole('progressbar',{name:'Task completion'})).toHaveAttribute('aria-valuenow','50');const summary=page.getByRole('row').filter({hasText:name});await expect(summary).toContainText('12 h');await expect(summary).toContainText('5 h');
 await page.getByRole('button',{name:'Team workload',exact:true}).click();const team=page.getByRole('row').filter({has:page.getByRole('button',{name:'Stephan',exact:true})});await expect(team).toContainText('8 h');await team.getByRole('button',{name:'Stephan',exact:true}).click();await expect(page.getByRole('heading',{name:'Task report'})).toBeVisible();await expect(page.getByRole('table')).toContainText('Late report task '+suffix);await expect(page.getByRole('table')).not.toContainText('Finished report task '+suffix);
 await page.getByRole('button',{name:'Overdue',exact:true}).click();await expect(page.getByRole('table')).toContainText('Late report task '+suffix);await expect(page.getByRole('table')).not.toContainText('Finished report task '+suffix);
 await page.getByLabel('Search tasks or projects').fill('NONEXISTENT-'+suffix);await expect(page.getByRole('heading',{name:'No results for this selection'})).toBeVisible();await expect(page.getByRole('button',{name:'Export filtered CSV',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Clear all filters',exact:true}).click();await expect(page.getByLabel('Project',{exact:true})).toHaveValue('all');await expect(page.getByLabel('Search tasks or projects')).toHaveValue('');
 await page.getByRole('button',{name:'Overview',exact:true}).last().click();await page.getByLabel('Project',{exact:true}).selectOption(project.id);await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name:'Task report'})).toBeVisible();await expect(page.getByRole('table')).toContainText('Finished report task '+suffix);
});
test('report-only profile does not expose pricing, downloads or imports',async({page})=>{
 await page.goto('/');await page.getByLabel('Username').fill('Stephan');await page.getByLabel('User ID').fill('123');await page.getByLabel('Password').fill('Testing');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',level:1})).toBeVisible();const suffix=Date.now().toString(36),username='report'+suffix;
 let r=await page.request.post('/api/admin/profiles',{data:{name:username,permissions:{viewReports:true}}});expect(r.status()).toBe(201);const {id}=await r.json();r=await page.request.post('/api/admin/users',{data:{name:username,username,userId:username,password:'Testing',profileId:id}});expect(r.status()).toBe(201);await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Username').fill(username);await page.getByLabel('User ID').fill(username);await page.getByLabel('Password').fill('Testing');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Reports',exact:true}).click();await expect(page.getByRole('navigation',{name:'Report views'})).toBeVisible();await expect(page.getByRole('button',{name:'Commercial estimate',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Data tools',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Export filtered CSV',exact:true})).toHaveCount(0);
});
