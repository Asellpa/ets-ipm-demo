async function openAccount(page){
 const trigger=page.getByRole('button',{name:'Account menu',exact:true});
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
}
async function signOut(page){
 await openAccount(page);
 await page.getByRole('region',{name:'Your profile',exact:true}).getByRole('button',{name:'Sign out',exact:true}).click();
}
async function openPreferences(page){
 await openAccount(page);
 await page.getByRole('region',{name:'Your profile',exact:true}).getByRole('button',{name:'Preferences',exact:true}).click();
}
module.exports={openAccount,signOut,openPreferences};
