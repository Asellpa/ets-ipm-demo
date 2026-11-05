function workToday(timeZone='UTC',at=new Date()){
 if(typeof timeZone!=='string'||timeZone.length>100)throw Error('Choose a valid time zone');
 try{const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);const get=type=>parts.find(p=>p.type===type).value;return get('year')+'-'+get('month')+'-'+get('day')}catch{throw Error('Choose a valid time zone')}
}
module.exports={workToday};
