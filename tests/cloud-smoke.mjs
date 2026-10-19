import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BIKE_TEST_API||'https://where-is-my-bike-api.marronyao.workers.dev';
const origin='https://marronyao.github.io';
const run=crypto.randomUUID();let ids=[];
async function call(path,method='GET',body,token,expected=200,source=origin){
 const response=await fetch(base+path,{method,headers:{Origin:source,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));assert.equal(response.headers.get('cache-control'),'no-store');return data;
}
try {
 await call('/bikes','GET',null,null,401);
 await call('/health','GET',null,null,403,'https://untrusted.example');
 await call('/signup','POST',{username:'smoke-short-'+run,password:'1234567'},null,400);
 const a=await call('/signup','POST',{username:'smoke-a-'+run,password:'        '});ids.push(a.user.id);
 const b=await call('/signup','POST',{username:'smoke-b-'+run,password:'noRULES!'});ids.push(b.user.id);
 await call('/login','POST',{username:'smoke-a-'+run,password:'wrong-pass'},null,401);
 const login=await call('/login','POST',{username:('smoke-a-'+run).toUpperCase(),password:'        '});
 const bike={id:'smoke-bike',name:'Test bicycle',details:'Synthetic test record',colour:'#24624c',parking:{lat:0,lng:0,time:new Date().toISOString(),note:'Test only'}};
 await call('/bikes','PUT',{bikes:[bike],revision:0},login.token);
 assert.equal((await call('/bikes','GET',null,a.token)).bikes.length,1);
 assert.equal((await call('/bikes','GET',null,b.token)).bikes.length,0);
 await call('/bikes','PUT',{bikes:[],revision:0},a.token,409);
 await call('/bikes','PUT',{bikes:[{...bike,parking:{...bike.parking,lat:91}}],revision:1},a.token,400);
 await call('/logout','POST',null,login.token);
 await call('/bikes','GET',null,login.token,401);
 await call('/logout','POST',null,a.token);await call('/logout','POST',null,b.token);
 console.log('PASS: password minimum, spaces-only password, username case, invalid login, account isolation, cross-session data, conflict handling, coordinate validation, CORS, authentication and logout revocation.');
}finally{await mkdir('private',{recursive:true});await writeFile('private/test-users.json',JSON.stringify(ids));}
