const encoder = new TextEncoder();
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const hex = bytes => [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const random = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value)).then(hex);
async function passwordHash(password, salt) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
function equal(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Use JSON requests.',415);
  const reader=request.body?.getReader();if(!reader)fail('Missing request body.');
  const parts=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();fail('Request too large.',413);}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid JSON.');}
}
export function validateBikes(bikes){
  if(!Array.isArray(bikes)||bikes.length>100)fail('Maximum 100 bikes.');const ids=new Set();
  return bikes.map(b=>{
    if(!b||typeof b.id!=='string'||b.id.length>100||ids.has(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.details!=='string'||b.details.length>500||!/^#[0-9a-f]{6}$/i.test(b.colour))fail('Invalid bike.');ids.add(b.id);
    let parking=null;if(b.parking!==null){const p=b.parking;if(!p||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lng)||Math.abs(p.lng)>180||typeof p.time!=='string'||!Number.isFinite(Date.parse(p.time))||typeof p.note!=='string'||p.note.length>1000)fail('Invalid parking spot.');parking={lat:p.lat,lng:p.lng,time:p.time,note:p.note};}
    return {id:b.id,name:b.name,details:b.details,colour:b.colour,parking};
  });
}
async function throttle(db,key,now,limit){
  const result=await db.prepare('INSERT INTO auth_limits(bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+900,now,now).first();
  if(result.attempts>limit)fail('Too many attempts. Please try again in 15 minutes.',429);
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=origin===env.ALLOWED_ORIGIN;
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, POST, PUT, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type, Authorization';}
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!allowed)return reply({error:'Origin not allowed.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname,now=Math.floor(Date.now()/1000),db=env.DB;
  try{
    if(path==='/health'&&request.method==='GET')return reply({ok:true});
    if(['/signup','/login'].includes(path)&&request.method==='POST'){
      const input=await body(request);if(typeof input.username!=='string'||!input.username.trim()||input.username.trim().length>80||typeof input.password!=='string')fail('Enter a username and password.');
      const display=input.username.trim(),username=display.toLocaleLowerCase('en-GB');
      if(path==='/signup'&&Array.from(input.password).length<8)fail('Password must contain at least 8 characters.');
      await throttle(db,'ip:'+await digest(request.headers.get('CF-Connecting-IP')||'local'),now,30);
      await throttle(db,'name:'+await digest(username),now,10);
      let user=await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
      if(path==='/signup'){
        if(user)fail('This username is unavailable.',409);
        const salt=random(24),hash=await passwordHash(input.password,salt);user={id:crypto.randomUUID(),display_name:display};
        try{await db.batch([db.prepare('INSERT INTO users(id,username,display_name,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)').bind(user.id,username,display,salt,hash,now),db.prepare('INSERT INTO bike_documents(user_id) VALUES (?)').bind(user.id)]);}catch(e){if(String(e).includes('UNIQUE'))fail('This username is unavailable.',409);throw e;}
      }else{
        const hash=await passwordHash(input.password,user?.salt||'not-a-user-salt');
        if(!user||!equal(hash,user.password_hash))fail('Incorrect username or password.',401);
      }
      const token=random(32);
      await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').bind(now),db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),user.id,now+SESSION_SECONDS)]);
      return reply({token,user:{id:user.id,username:user.display_name}});
    }
    const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)fail('Please log in.',401);
    const hash=await digest(token),user=await db.prepare('SELECT u.id,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(hash,now).first();
    if(!user)fail('Your session has expired. Please log in again.',401);
    if(path==='/logout'&&request.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hash).run();return reply({ok:true});}
    // Renew active sessions at most once a day; revoked sessions are never recreated.
    if(path==='/bikes')await db.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=? AND expires_at>? AND expires_at<?').bind(now+SESSION_SECONDS,hash,now,now+SESSION_SECONDS-86400).run();
    if(path==='/bikes'&&request.method==='GET'){
      const doc=await db.prepare('SELECT bikes,revision FROM bike_documents WHERE user_id=?').bind(user.id).first();return reply({bikes:JSON.parse(doc.bikes),revision:doc.revision,user:{id:user.id,username:user.display_name}});
    }
    if(path==='/bikes'&&request.method==='PUT'){
      const input=await body(request),bikes=validateBikes(input.bikes);if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('Invalid revision.');
      const result=await db.prepare('UPDATE bike_documents SET bikes=?,revision=revision+1 WHERE user_id=? AND revision=? RETURNING revision').bind(JSON.stringify(bikes),user.id,input.revision).first();
      if(!result)fail('Your bikes changed on another device. Reload cloud data before saving again.',409);return reply({revision:result.revision});
    }
    return reply({error:'Not found.'},404);
  }catch(e){return reply({error:e.status?e.message:'The service is temporarily unavailable. Please try again.'},e.status||503);}
}};
