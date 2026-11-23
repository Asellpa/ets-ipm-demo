function spreadHours(startDate,total,max=8,dueDate='',cal={workingDays:[1,2,3,4,5],holidays:[]}) {
  const result={}; if(!startDate || !Number(total)) return result;
  if(dueDate && dueDate>=startDate) {
    const dates=[]; let d=new Date(startDate+'T00:00:00Z');
    while(d.toISOString().slice(0,10)<=dueDate) { if(cal.workingDays.includes(d.getUTCDay())&&!cal.holidays.includes(d.toISOString().slice(0,10)))dates.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
    // Weekend-only work remains visible as a capacity conflict.
    if(!dates.length)dates.push(startDate);
    const units=Math.round(Number(total)*10000), base=Math.floor(units/dates.length);
    dates.forEach((date,i)=>result[date]=(base+(i<units-base*dates.length?1:0))/10000);
    return result;
  }
  let d=new Date(startDate+'T00:00:00Z'),left=Number(total),guard=0;
  while(left>0&&guard++<75000){if(cal.workingDays.includes(d.getUTCDay())&&!cal.holidays.includes(d.toISOString().slice(0,10))){const h=Math.min(max,left);result[d.toISOString().slice(0,10)]=h;left-=h;}d.setUTCDate(d.getUTCDate()+1);}return result;
}
module.exports={spreadHours};
