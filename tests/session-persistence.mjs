import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const guest=JSON.stringify([{id:'local',name:'Local bike',details:'',colour:'#24624c',parking:null}]);
function boot({saved='valid-session',legacy='',failure=null}={}){
 const local=new Map([['where-is-my-bike:v1',guest]]);if(saved)local.set('bike-session',saved);
 const session=new Map();if(legacy)session.set('bike-session',legacy);
 const nodes=new Map(),events=new Map();let mode=failure,resolveRequest;
 const node=()=>({value:'',style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(){},querySelectorAll(){return [];},close(){},showModal(){}});
 const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const context=vm.createContext({document:{getElementById:$,createElement:node,createTextNode:t=>t},window:{BIKE_API:'https://test.example',addEventListener:(k,fn)=>events.set(k,fn)},location:{protocol:'https:'},navigator:{},crypto,localStorage:storage(local),sessionStorage:storage(session),console,
 fetch:async()=>{
   if(mode==='offline')throw Error('Offline');
   if(mode==='pending')await new Promise(resolve=>{resolveRequest=resolve;});
   if(mode==='expired')return {ok:false,status:401,json:async()=>({error:'Session expired.'})};
   return {ok:true,status:200,json:async()=>({revision:1,user:{id:'a',username:'Alice'},bikes:[]})};
 }});
 vm.runInContext(source,context);
 return {$,local,session,events,context,setMode:m=>{mode=m;},resolve:()=>resolveRequest()};
}
const settle=()=>new Promise(setImmediate);
const reopened=boot();await settle();assert.match(reopened.$('account-label').textContent,/Alice/);assert.equal(reopened.local.get('bike-session'),'valid-session');assert.equal(reopened.session.size,0);
const migrated=boot({saved:'',legacy:'legacy-session'});await settle();assert.equal(migrated.local.get('bike-session'),'legacy-session');assert.equal(migrated.session.size,0);assert.match(migrated.$('account-label').textContent,/Alice/);
const offline=boot({failure:'offline'});await settle();assert.equal(offline.local.get('bike-session'),'valid-session');assert.match(offline.$('status').textContent,/login has been kept/);offline.setMode(null);offline.events.get('online')();await settle();assert.match(offline.$('account-label').textContent,/Alice/);
const expired=boot({failure:'expired'});await settle();assert.equal(expired.local.has('bike-session'),false);assert.equal(expired.$('account-label').textContent,'ON THIS DEVICE');
reopened.local.delete('bike-session');reopened.events.get('storage')({key:'bike-session'});assert.equal(reopened.$('account-label').textContent,'ON THIS DEVICE');assert.equal(reopened.$('count').textContent,1);
const race=boot({failure:'pending'});race.local.delete('bike-session');race.events.get('storage')({key:'bike-session'});race.resolve();await settle();assert.equal(race.$('account-label').textContent,'ON THIS DEVICE');assert.equal(race.local.has('bike-session'),false);
console.log('PASS: browser reopen, legacy migration, offline retention and reconnect, expiry, cross-tab logout and in-flight restore/logout race.');
