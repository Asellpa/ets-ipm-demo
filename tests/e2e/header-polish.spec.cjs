const {test,expect}=require('@playwright/test');
const {openAccount,openPreferences,signOut}=require('./account-actions.cjs');
async function login(page){await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('Stephan');await page.getByLabel('User ID',{exact:true}).fill('123');await page.getByLabel('Password',{exact:true}).fill('Testing');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',level:1})).toBeVisible()}
async function theme(page,name){await openPreferences(page);await page.getByRole('radio',{name:new RegExp('^'+name)}).check();await expect(page.getByText('Saving appearance…',{exact:true})).not.toBeVisible();await page.getByRole('button',{name:'Close preferences',exact:true}).click()}
async function aligned(buttons,container){
 await expect(buttons).toHaveCount(2);
 const a=await buttons.nth(0).boundingBox(),b=await buttons.nth(1).boundingBox(),box=await container.boundingBox();
 expect(Math.abs(a.y-b.y)).toBeLessThan(1);expect(Math.abs(a.height-b.height)).toBeLessThan(1);
 expect(b.x).toBeGreaterThanOrEqual(a.x+a.width+6);expect(a.x).toBeGreaterThanOrEqual(box.x);expect(b.x+b.width).toBeLessThanOrEqual(box.x+box.width+1);
}

test('profile disclosure contains account actions, supports keyboard and outside dismissal, restores focus and signs out',async({page},testInfo)=>{
 await login(page);const session=await(await page.request.get('/api/bootstrap')).json();const trigger=page.getByRole('button',{name:'Account menu',exact:true}),panel=page.getByRole('region',{name:'Your profile',exact:true});
 await expect(page.locator('.main>header').getByRole('button',{name:'Preferences',exact:true})).toHaveCount(0);
 await expect(page.locator('.main>header').getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
 await trigger.focus();await page.keyboard.press('Enter');await expect(trigger).toHaveAttribute('aria-expanded','true');await expect(panel).toContainText(session.user);await expect(panel).toContainText(session.profile);
 await page.keyboard.press('Tab');await expect(panel.getByRole('button',{name:'Preferences',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();
 await openAccount(page);await page.getByRole('heading',{name:'Overview',level:1}).click();await expect(panel).toHaveCount(0);
 try{
  for(const [name,width]of [['Dark',1600],['Light',390]]){
   await page.setViewportSize({width,height:844});await theme(page,name);await expect(trigger).toBeFocused();await openAccount(page);const box=await panel.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('profile-'+name.toLowerCase()+'.png'),fullPage:false});await page.keyboard.press('Escape');
  }
  await openPreferences(page);await expect(page.getByRole('dialog',{name:'Preferences',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Preferences',exact:true})).toHaveCount(0);await expect(trigger).toBeFocused();
 }finally{await page.request.patch('/api/preferences',{data:{appearance:'system'}})}
 await signOut(page);await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
});

test('notification close and read controls remain usable after scrolling a long list on desktop and mobile',async({page},testInfo)=>{
 await login(page);
 await page.route('**/api/bootstrap',async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,notifications:Array.from({length:45},(_,i)=>({id:'scroll-notice-'+i,ts:'2026-11-25T08:00:00Z',text:'Notification '+i+': Review the assigned project work and handover details before proceeding. '.repeat(2),readByIds:[],readBy:[]}))}})});
 await page.reload();await expect(page.getByRole('button',{name:'Notifications, 45 unread',exact:true})).toBeVisible();
 try{
  for(const [name,width,height]of [['Light',1440,900],['Dark',390,640]]){
   await page.setViewportSize({width,height});await theme(page,name);const bell=page.getByRole('button',{name:'Notifications, 45 unread',exact:true});await bell.click();const dialog=page.getByRole('dialog',{name:'Notifications',exact:true}),list=dialog.getByRole('region',{name:'Notification list',exact:true}),close=dialog.getByRole('button',{name:'Close notifications',exact:true});
   const before=await close.boundingBox();await list.evaluate(e=>{e.scrollTop=e.scrollHeight});expect(await list.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);const after=await close.boundingBox();expect(Math.abs(before.y-after.y)).toBeLessThan(1);expect(after.y).toBeGreaterThanOrEqual(0);expect(after.y+after.height).toBeLessThan(height);
   await expect(dialog.getByRole('button',{name:'Mark all read',exact:true})).toBeInViewport();await expect(dialog.getByLabel('Unread only')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('notifications-scrolled-'+name.toLowerCase()+'.png'),fullPage:false});await close.click();await expect(dialog).toHaveCount(0);await expect(bell).toBeFocused();await bell.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  }
 }finally{await page.unroute('**/api/bootstrap');await page.request.patch('/api/preferences',{data:{appearance:'system'}})}
});

test('daily checklist actions align across themes and widths, preserve drafts and handle an empty assignment',async({page},testInfo)=>{
 await login(page);const name='Aligned daily checklist '+Date.now();const created=await page.request.post('/api/checklists/templates',{data:{name,shift:'morning',roleIds:['prof-admin'],active:true,items:[{text:'Confirm priorities for the shift',required:true},{text:'Optional handover review',required:false}]}});expect(created.status()).toBe(201);
 await page.getByRole('button',{name:'My Work',exact:true}).click();const sidebar=page.getByRole('complementary',{name:'My daily checklists',exact:true}),card=sidebar.getByRole('heading',{name,exact:true}).locator('..');await card.getByRole('button',{name:'Start checklist',exact:true}).click();const run=sidebar.getByRole('region',{name:name+' checklist',exact:true});await run.getByLabel('Confirm priorities for the shift *',{exact:true}).check();
 page.once('dialog',d=>d.dismiss());await sidebar.getByRole('button',{name:'Refresh checklists',exact:true}).click();await expect(run.getByLabel('Confirm priorities for the shift *',{exact:true})).toBeChecked();await expect(run).toContainText('Unsaved changes');
 await run.getByRole('button',{name:'Save draft',exact:true}).click();await expect(sidebar.getByRole('status')).toHaveText('Checklist saved.');
 try{
  for(const [mode,width]of [['Light',1600],['Dark',900],['Dark',390]]){
   await page.setViewportSize({width,height:1000});await theme(page,mode);await aligned(sidebar.locator('.daily-checklist-actions').getByRole('button'),sidebar);await aligned(run.locator('.form-actions').getByRole('button'),run);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('daily-checklist-'+mode.toLowerCase()+'-'+width+'.png'),fullPage:false});
  }
  await run.getByRole('button',{name:'Submit checklist',exact:true}).click();await expect(run).toContainText('Submitted by Stephan');
  await page.route('**/api/checklists?**',async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,templates:[],runs:[]}})});await sidebar.getByRole('button',{name:'Refresh checklists',exact:true}).click();await expect(sidebar.getByText('No checklist assigned',{exact:true})).toBeVisible();await aligned(sidebar.locator('.daily-checklist-actions').getByRole('button'),sidebar);await page.screenshot({path:testInfo.outputPath('daily-checklist-empty-mobile.png'),fullPage:false});
 }finally{await page.unroute('**/api/checklists?**');await page.request.patch('/api/preferences',{data:{appearance:'system'}})}
});
