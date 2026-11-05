const failures=new Map();
const WINDOW=15*60*1000;
function secureCookie(req){return process.env.SESSION_COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'||!!req.socket.encrypted||(process.env.TRUST_PROXY==='true'&&req.headers['x-forwarded-proto']==='https');}
function originAllowed(req){
 if(!req.url.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(req.method))return true;
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 const origin=req.headers.origin;if(!origin)return true;
 try{const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.origin!==origin)return false;const allowed=(process.env.APP_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);return url.host===req.headers.host||allowed.includes(url.origin)}catch{return false}
}
function keys(req,login){const ip=process.env.TRUST_PROXY==='true'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;return ['ip:'+ip,'account:'+login];}
function blocked(req,login){const now=Date.now();for(const[k,v]of failures)if(v.until<=now)failures.delete(k);return keys(req,login).some(k=>(failures.get(k)?.count||0)>=(k.startsWith('ip:')?50:10));}
function failed(req,login){for(const k of keys(req,login)){const v=failures.get(k);failures.set(k,v&&v.until>Date.now()?{...v,count:v.count+1}:{count:1,until:Date.now()+WINDOW});}}
function succeeded(req,login){failures.delete('account:'+login);}
module.exports={secureCookie,originAllowed,blocked,failed,succeeded};
