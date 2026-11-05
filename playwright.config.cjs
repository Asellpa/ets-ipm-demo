const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/e2e',testMatch:'*.spec.cjs',
 timeout:30000,expect:{timeout:10000},retries:process.env.CI?1:0,
 workers:1,reporter:process.env.CI?[['github'],['html',{open:'never'}]]:'list',
 use:{baseURL:'http://127.0.0.1:5175',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome'],...(process.env.CI?{channel:'chrome'}:{})}}],
 webServer:[
  {command:'node tests/e2e/isolated-server.cjs',url:'http://127.0.0.1:5174/api/bootstrap',reuseExistingServer:false,timeout:30000,env:{NODE_ENV:'test'}},
  {command:'npm --prefix react run dev -- --strictPort',url:'http://127.0.0.1:5175',reuseExistingServer:false,timeout:30000}
 ]
});

