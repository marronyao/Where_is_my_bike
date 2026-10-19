import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const nodes=new Map();
function node(){return {value:'',textContent:'',disabled:false,hidden:false,style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(){},querySelectorAll(){return [];},showModal(){this.open=true;},close(){this.open=false;},focus(){}};}
const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const guest={id:'guest',name:'Local bike',details:'',colour:'#24624c',parking:null};
const local=new Map([['where-is-my-bike:v1',JSON.stringify([guest])]]),session=new Map();
let cloud=[],revision=0,conflict=false,cloudWrites=0;
const context={document:{getElementById:$,createElement:node,createTextNode:text=>({text})},window:{BIKE_API:'https://api.example'},location:{protocol:'https:'},navigator:{},crypto,confirm:()=>true,console,
 localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
 fetch:async(url,options)=>{let data={},ok=true;
 if(url.endsWith('/login'))data={token:'test-session'};
 if(url.endsWith('/bikes')&&options.method==='PUT'){
   if(conflict){ok=false;data={error:'Conflict. Reload data.'};}else{const input=JSON.parse(options.body);assert.equal(input.revision,revision);cloud=input.bikes;data={revision:++revision};cloudWrites++;}
 }else if(url.endsWith('/bikes'))data={user:{id:'account-a',username:'Alice'},bikes:cloud,revision};
 return {ok,json:async()=>data};
 }};
vm.runInNewContext(await readFile(new URL('../app.js',import.meta.url),'utf8'),context);
const submit=()=>$('bike-form').onsubmit({preventDefault(){}});
$('login').onclick();$('username').value='Alice';$('password').value='password';await $('auth-form').onsubmit({preventDefault(){}});
assert.equal($('count').textContent,0);assert.match($('account-label').textContent,/Alice/);assert.equal(JSON.parse(local.get('where-is-my-bike:v1'))[0].id,'guest');
$('add').onclick();$('bike-name').value='Cloud bike';$('bike-details').value='';$('bike-colour').value='#24624c';await submit();
assert.equal(cloudWrites,1);assert.equal(cloud[0].name,'Cloud bike');assert.equal(JSON.parse(local.get('where-is-my-bike:v1')).length,1);
conflict=true;$('add').onclick();$('bike-name').value='Unsaved bike';await submit();assert.equal($('count').textContent,1);assert.equal(cloudWrites,1);assert.match($('status').textContent,/not been saved/);
$('bike-dialog').close();await $('logout').onclick();assert.equal($('account-label').textContent,'ON THIS DEVICE');assert.equal($('count').textContent,1);assert.equal(session.has('bike-session'),false);assert.equal($('logout').hidden,true);
console.log('PASS: login separates local and cloud records; cloud saves avoid local storage; conflicts preserve saved state; logout clears session and restores local mode.');
