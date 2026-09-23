export const localDate=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms);
export function midnight(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Use YYYY-MM-DD dates.');const utc=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,10)!==date)throw new Error('Invalid date.');const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(utc));return utc-hour*3600000;}
export function nextDate(date){return new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10)}
export function range(from,to){const start=midnight(from),end=midnight(nextDate(to));if(end<=start)throw new Error('End date must be on or after start date.');return{start,end}}
export function bounds(now){const today=localDate(now);const day=new Date(today+'T12:00:00Z').getUTCDay();const monday=new Date(Date.parse(today+'T12:00:00Z')-((day+6)%7)*86400000).toISOString().slice(0,10);return{today,week:monday}}
export function duration(shift,start,end,now){return Math.max(0,Math.min(shift.ended_at??now,end)-Math.max(shift.started_at,start))}
export function totals(shifts,start,end,now){let completed=0,ongoing=0;for(const s of shifts){if(s.ended_at===null)ongoing+=duration(s,start,end,now);else completed+=duration(s,start,end,now)}return{completed,ongoing}}
export function csvCell(value){let v=String(value??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}
