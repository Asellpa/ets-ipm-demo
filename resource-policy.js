// Account purpose is separate from permission profiles: an administrator may also
// be an engineer, but the dedicated sysadmin account must never book work.
function isResource(user){return !!user && user.resourceEnabled!==false && String(user.username||user.name).trim().toLowerCase()!=='sysadmin';}
module.exports={isResource};
