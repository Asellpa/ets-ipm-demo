const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('layout CSS and React components do not bypass the shared typography standard',()=>{
 const root=path.join(__dirname,'../react/src'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8');assert.doesNotMatch(css,/(?:^|[;{])\s*(?:font(?:-size|-family|-weight)?|line-height|letter-spacing)\s*:/m);
 function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())walk(p);else if(p.endsWith('.tsx'))assert.doesNotMatch(fs.readFileSync(p,'utf8'),/\b(?:fontSize|fontFamily|fontWeight|lineHeight|letterSpacing)\s*:/,p);}}walk(root);
 assert.match(fs.readFileSync(path.join(root,'main.tsx'),'utf8'),/@fontsource-variable\/inter\/wght.css/);assert.ok(fs.existsSync(path.join(root,'../public/licenses/inter-OFL.txt')));
});
