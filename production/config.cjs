const fs=require('node:fs');
function secret(name){if(process.env[name+'_FILE'])process.env[name]=fs.readFileSync(process.env[name+'_FILE'],'utf8').trim();return process.env[name];}
for(const key of ['DATABASE_URL','IDENTITY_PROXY_SECRET'])secret(key);
function errors(env=process.env){
 if(env.NODE_ENV!=='production')return [];
 const e=[];
 if(!env.DATABASE_URL)e.push('DATABASE_URL is required; JSON storage is development-only');
 if(env.AUTH_MODE!=='proxy')e.push('AUTH_MODE=proxy is required with an approved MFA identity gateway');
 if(!env.IDENTITY_PROXY_SECRET||env.IDENTITY_PROXY_SECRET.length<32)e.push('IDENTITY_PROXY_SECRET must contain at least 32 characters');
 if(!env.APP_ORIGINS||env.APP_ORIGINS.split(',').some(s=>{try{return new URL(s.trim()).protocol!=='https:'}catch{return true}}))e.push('APP_ORIGINS must list exact HTTPS origins');
 if(!env.ETS_FILE_DIR)e.push('ETS_FILE_DIR is required for private files');
 if(!env.CLAMD_HOST)e.push('CLAMD_HOST is required; uploads fail closed');
 return e;
}
function assert(){const e=errors();if(e.length)throw Error('Production configuration: '+e.join('; '));}
function identity(req,db){
 if(process.env.AUTH_MODE!=='proxy')return null;
 const crypto=require('node:crypto'),expected=process.env.IDENTITY_PROXY_SECRET||'',given=String(req.headers['x-ipm-proxy-secret']||'');
 if(expected.length<32||Buffer.byteLength(expected)!==Buffer.byteLength(given)||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(given)))return null;
 const email=String(req.headers['x-forwarded-email']||'').trim().toLowerCase();if(!email)return null;
 const matches=db.users.filter(u=>u.active&&String(u.email||'').trim().toLowerCase()===email);
 return matches.length===1?matches[0]:null;
}
module.exports={errors,assert,identity};
