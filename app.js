'use strict';
const KEY = 'where-is-my-bike:v1';
const colours = ['#24624c','#b35937','#3c65a0','#885698','#94701c'];
const $ = id => document.getElementById(id);
let bikes = [], selected = null, editing = null, map, markers, draftMarker, locating = 0;
const say = message => { $('status').textContent = message; };
const API = window.BIKE_API || '';
let account = null, revision = 0, saving = false, restoring = false;
let authMode = 'login';
let token = '';
try {
  token = localStorage.getItem('bike-session') || sessionStorage.getItem('bike-session') || '';
  if (token) { localStorage.setItem('bike-session', token); sessionStorage.removeItem('bike-session'); }
} catch {}
async function request(path, options = {}, bearer = token) {
  if (!API) throw Error('Cloud accounts are not configured yet. Please try again later.');
  const response = await fetch(API + path, {...options, headers: {'Content-Type':'application/json', ...(bearer ? {Authorization:'Bearer '+bearer} : {})}, cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw Object.assign(Error(data.error || 'Could not contact the cloud service.'), {status:response.status});
  return data;
}
function accountUI() {
  $('account-label').textContent = account ? account.username + ' · CLOUD' : 'ON THIS DEVICE';
  $('login').hidden = $('signup').hidden = !!account;
  $('logout').hidden = $('refresh-cloud').hidden = !account;
  $('storage-heading').textContent = account ? 'Saved to your account.' : 'Your locations stay with you.';
  $('storage-description').textContent = account ? 'Changes are saved to the cloud. Local bikes remain separate. Export backups for safekeeping.' : 'Saved in this browser, on this device. Log in to access your account’s bikes on another device.';
}
function validate(data) {
  if (!Array.isArray(data) || data.length > 100) throw Error('Invalid backup: expected up to 100 bikes.');
  const ids = new Set();
  return data.map(b => {
    if (!b || typeof b.id !== 'string' || ids.has(b.id) || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 80) throw Error('Invalid bike data.');
    ids.add(b.id);
    let parking = null;
    if (b.parking != null) {
      const p = b.parking;
      if (!Number.isFinite(p.lat) || Math.abs(p.lat)>90 || !Number.isFinite(p.lng) || Math.abs(p.lng)>180 || typeof p.time !== 'string' || !Number.isFinite(Date.parse(p.time)) || typeof p.note !== 'string' || p.note.length>1000) throw Error('Invalid parking data.');
      parking = {lat:p.lat,lng:p.lng,time:p.time,note:p.note};
    }
    return {id:b.id,name:b.name.trim(),details:typeof b.details==='string'?b.details.slice(0,500):'',colour:colours.includes(b.colour)?b.colour:colours[0],parking};
  });
}
try { bikes = validate(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { say('Saved data could not be read. Export a backup before making changes.'); }
async function commit(next) {
  if (saving || restoring) { say('Please wait for the current request to finish.'); return false; }
  if (account) {
    saving = true;
    const sessionToken = token;
    try { const result = await request('/bikes', {method:'PUT', body:JSON.stringify({bikes:next, revision})}); if(token!==sessionToken)return false; revision=result.revision; bikes=next; return true; }
    catch (error) { say(error.message + ' Your changes have not been saved.'); return false; }
    finally { saving=false; }
  }
  try { localStorage.setItem(KEY,JSON.stringify(next)); bikes=next; return true; }
  catch { say('Could not save. Browser storage may be full or unavailable. Your changes have not been saved.'); return false; }
}
const current = () => bikes.find(b=>b.id===selected);
function el(tag,text,className) {const n=document.createElement(tag); n.textContent=text; if(className)n.className=className; return n;}
function render() {
  $('count').textContent=bikes.length; $('bikes').replaceChildren();
  if (!bikes.length) $('bikes').append(el('div','Your everyday ride or your weekend favourite. Add a bike to get started.','empty'));
  bikes.forEach(b=>{
    const card=el('article','','bike'+(b.id===selected?' selected':''));
    const select=el('button','','bike-select'); select.type='button'; select.setAttribute('aria-pressed',b.id===selected);
    const title=el('strong','','bike-name'), dot=el('span','','dot'); dot.style.background=b.colour; title.append(dot,document.createTextNode(b.name)); select.append(title);
    select.append(el('p',b.details || 'Your trusty two wheels'));
    select.append(el('p',b.parking?'Parked '+new Date(b.parking.time).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'No parking spot saved yet'));
    select.onclick=()=>choose(b.id); card.append(select);
    if(b.parking?.note) card.append(el('p',b.parking.note));
    const tools=el('div','','tools'); const edit=el('button','Edit','text'), remove=el('button','Delete','text');
    edit.onclick=()=>openBike(b); remove.onclick=async()=>{if(confirm('Delete '+b.name+' and its saved parking spot?')){if(await commit(bikes.filter(x=>x.id!==b.id))) choose(selected===b.id?(bikes[0]?.id||null):selected);}};
    tools.append(edit,remove); card.append(tools); $('bikes').append(card);
  });
  if(markers){markers.clearLayers();bikes.filter(b=>b.parking).forEach(b=>{const p=b.parking;const m=L.marker([p.lat,p.lng],{icon:pin(b.colour)}).addTo(markers);m.bindTooltip(b.name);m.on('click',()=>choose(b.id));});}
}
function pin(colour) {return L.divIcon({className:'bike-marker',html:'<div class="pin" style="background:'+colour+'"></div>',iconSize:[30,30],iconAnchor:[15,33]});}
function choose(id) {
  locating++; selected=id; const b=current(); render();
  $('selected-title').textContent=b?.name || 'Start with your first bike';
  $('parking-form').querySelectorAll('input,textarea,button').forEach(e=>e.disabled=!b); $('locate').disabled=!b;
  $('lat').value=b?.parking?.lat??''; $('lng').value=b?.parking?.lng??''; $('note').value=b?.parking?.note||'';
  $('hint').textContent=b?'Tap the map, drag the pin, or use your current location. Then save.':'Add a bike to save your first parking spot.';
  $('navigate').hidden=!b?.parking;
  if(b?.parking) $('navigate').href='https://www.google.com/maps/dir/?api=1&travelmode=walking&destination='+encodeURIComponent(b.parking.lat+','+b.parking.lng);
  if(draftMarker){draftMarker.remove();draftMarker=null;}
  if(b?.parking){draft(b.parking.lat,b.parking.lng);map?.setView([b.parking.lat,b.parking.lng],16);}
}
function draft(lat,lng) {
  $('lat').value=Number(lat).toFixed(6);$('lng').value=Number(lng).toFixed(6);
  if(!map)return;
  if(draftMarker)draftMarker.setLatLng([lat,lng]);
  else {draftMarker=L.marker([lat,lng],{draggable:true,icon:pin('#253c32'),zIndexOffset:1000}).addTo(map);draftMarker.bindTooltip('Selected parking spot');draftMarker.on('dragend',()=>{const p=draftMarker.getLatLng();draft(p.lat,((p.lng+180)%360+360)%360-180);say('Pin moved. Save to confirm this parking spot.');});}
}
function openBike(b=null){editing=b?.id||null;$('dialog-title').textContent=b?'Edit bike':'Add a bike';$('bike-name').value=b?.name||'';$('bike-details').value=b?.details||'';$('bike-colour').value=b?.colour||colours[bikes.length%colours.length];$('bike-dialog').showModal();}
$('add').onclick=()=>openBike();$('close-dialog').onclick=()=>$('bike-dialog').close();
$('bike-form').onsubmit=async e=>{e.preventDefault();const name=$('bike-name').value.trim();if(!name){$('bike-name').focus();return;}const old=bikes.find(b=>b.id===editing);const b={id:editing||crypto.randomUUID(),name,details:$('bike-details').value.trim(),colour:$('bike-colour').value,parking:old?.parking||null};if(await commit(editing?bikes.map(x=>x.id===editing?b:x):[...bikes,b])){$('bike-dialog').close();choose(b.id);say('Bike saved'+(account?' to your account.':' on this device.'));}};
$('parking-form').onsubmit=async e=>{e.preventDefault();const b=current();if(!b)return;const lat=Number($('lat').value),lng=Number($('lng').value);if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180)return;const parking={lat,lng,note:$('note').value.trim(),time:new Date().toISOString()};if(await commit(bikes.map(x=>x.id===b.id?{...x,parking}:x))){choose(b.id);say('Parking spot saved'+(account?' to your account.':' on this device.'));}};
$('cancel').onclick=()=>{choose(selected);say('Unsaved changes discarded.');};
['lat','lng'].forEach(id=>$(id).addEventListener('change',()=>{if($('lat').value!==''&&$('lng').value!==''&&$('lat').checkValidity()&&$('lng').checkValidity())draft(Number($('lat').value),Number($('lng').value));}));
$('locate').onclick=()=>{
  if(!navigator.geolocation){say('Location is unavailable. Choose a spot on the map or enter coordinates.');return;}
  const token=++locating; const id=selected; $('locate').disabled=true;say('Finding your location…');
  navigator.geolocation.getCurrentPosition(p=>{if(token!==locating||id!==selected)return;$('locate').disabled=false;draft(p.coords.latitude,p.coords.longitude);map?.setView([p.coords.latitude,p.coords.longitude],17);say('Location found (accuracy approximately '+Math.round(p.coords.accuracy)+' metres). Adjust the pin if needed, then save.');},e=>{if(token!==locating)return;$('locate').disabled=false;say(e.code===1?'Location permission was denied. Choose a spot manually.':'Could not find your location. Try again or choose a spot manually.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
};
$('fit').onclick=()=>{const points=bikes.filter(b=>b.parking).map(b=>[b.parking.lat,b.parking.lng]);if(map&&points.length)map.fitBounds(points,{padding:[40,40],maxZoom:16});else say('Save a parking spot to show it here.');};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,bikes},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a','');a.href=url;a.download='my-bikes-private-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Backup exported. It contains private location data; store it safely.');};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;const target=account?.id||null;try{if(file.size>1000000)throw Error('Backup is too large.');const data=JSON.parse(await file.text());if(target!==(account?.id||null))throw Error('Account changed. Select the backup again.');if(data.version!==1)throw Error('Unsupported backup version.');const next=validate(data.bikes);if(confirm('Replace all bikes '+(account?'in your cloud account (including uploading exact locations)':'on this device')+' with '+next.length+' bikes from this backup?')&&await commit(next)){choose(bikes[0]?.id||null);say('Backup restored.');}}catch(err){say('Could not import: '+err.message);}e.target.value='';};
$('privacy').onclick=()=>$('privacy-dialog').showModal();$('close-privacy').onclick=()=>$('privacy-dialog').close();
const isLocalFile = location.protocol === 'file:';
if (isLocalFile) {
  const notice = el('p', '', 'map-notice');
  notice.append(document.createTextNode('Open this app through a local server to load the map. Run '), el('code', 'node server.mjs'), document.createTextNode(' in the project folder, then visit http://127.0.0.1:4173. Direct file access cannot send the website referrer required by the map provider. Export existing bikes before switching: browser storage is separate for each address.'));
  $('map').before(notice);
  $('map-fallback').textContent = 'Map paused in file preview. You can still manage bikes and enter coordinates manually.';
}
if(typeof L!=='undefined' && !isLocalFile){
  map=L.map('map').setView([51.9225,4.4792],13);$('map-fallback').remove();
  let mapWarning;
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
  tiles.on('tileerror',()=>{
    if(mapWarning)return;
    mapWarning=el('p','Map tiles could not be loaded. Check your connection and ensure your browser allows website referrers. You can still enter coordinates and save parking spots.','map-notice');
    mapWarning.setAttribute('role','status'); $('map').before(mapWarning);
  });
  tiles.on('load',()=>{if(mapWarning && $('map').querySelectorAll('.leaflet-tile-loaded').length){mapWarning.remove();mapWarning=null;}});
  tiles.addTo(map);
  markers=L.layerGroup().addTo(map);map.on('click',e=>{if(!current())return;draft(e.latlng.lat,((e.latlng.lng+180)%360+360)%360-180);say('Spot selected. Save to confirm.');});
}else if (!isLocalFile) $('map-fallback').textContent='Map unavailable. Check your connection, or enter coordinates below.';
choose(bikes[0]?.id||null);
function openAuth(mode) {
  if(saving||restoring){say('Please wait for the current request to finish.');return;}
  authMode=mode; const signup=mode==='signup';
  $('auth-title').textContent=$('auth-submit').textContent=signup?'Sign up':'Log in';
  $('password').value=''; $('password').autocomplete=signup?'new-password':'current-password';
  $('auth-help').textContent=signup?'At least 8 characters. No required capitals, numbers or symbols. Usernames are case-insensitive. No password recovery is available, so keep your password safe.':'Use your username and password. This browser will remember your login.';
  $('auth-error').textContent=''; $('auth-dialog').showModal();
}
$('login').onclick=()=>openAuth('login'); $('signup').onclick=()=>openAuth('signup');
$('auth-cancel').onclick=()=>$('auth-dialog').close();
$('auth-form').onsubmit=async e=>{
  e.preventDefault();if(saving||restoring)return;
  const password=$('password').value;
  if(authMode==='signup'&&Array.from(password).length<8){$('auth-error').textContent='Password must contain at least 8 characters.';return;}
  restoring=true;$('auth-submit').disabled=true;$('auth-cancel').disabled=true;
  try {
    const result=await request('/'+authMode,{method:'POST',body:JSON.stringify({username:$('username').value,password})},'');
    try {
      const doc=await request('/bikes',{},result.token),next=validate(doc.bikes);
      token=result.token;account=doc.user;revision=doc.revision;bikes=next;
      let remembered=true;try{localStorage.setItem('bike-session',token);sessionStorage.removeItem('bike-session');}catch{remembered=false;}
      $('auth-dialog').close();accountUI();choose(bikes[0]?.id||null);say('Logged in. You are viewing your cloud bikes.'+(remembered?' You will stay logged in on this device.':' Your browser blocked login storage; this login will last only while the page stays open.'));
    }catch(error){await request('/logout',{method:'POST'},result.token).catch(()=>{});throw error;}
  }catch(error){$('auth-error').textContent=error.message;}
  finally{restoring=false;$('auth-submit').disabled=false;$('auth-cancel').disabled=false;$('password').value='';}
};
$('auth-dialog').addEventListener('cancel',e=>{if(restoring)e.preventDefault();});
function localMode(clearSaved=true){token='';account=null;revision=0;if(clearSaved){try{localStorage.removeItem('bike-session');sessionStorage.removeItem('bike-session');}catch{}}try{bikes=validate(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{bikes=[];say('Local records could not be read.');}accountUI();choose(bikes[0]?.id||null);}
$('logout').onclick=async()=>{
  if(saving||restoring){say('Please wait for the current request to finish.');return;}
  const sessionToken=token;
  restoring=true;
  try{await request('/logout',{method:'POST'});if(token!==sessionToken)return;localMode();say('Logged out. Local mode restored.');}
  catch(error){if(token!==sessionToken)return;if(error.status===401){localMode();say('Session ended. Local mode restored.');}else say('Could not log out: '+error.message+' Please try again.');}
  finally{if(token===sessionToken||!token)restoring=false;}
};
$('refresh-cloud').onclick=async()=>{
  if(saving||restoring)return;
  if(!confirm('Reload saved cloud bikes? Unsaved form changes will be discarded.'))return;
  restoring=true;
  const sessionToken=token;
  try{const doc=await request('/bikes');if(token!==sessionToken)return;bikes=validate(doc.bikes);revision=doc.revision;choose(bikes[0]?.id||null);say('Cloud bikes reloaded.');}
  catch(error){say(error.message);}
  finally{restoring=false;}
};
accountUI();
async function restoreSession(){
  if(!token)return;
  const sessionToken=token;
  restoring=true;say('Restoring your cloud session…');
  try{const doc=await request('/bikes');if(token!==sessionToken)return;bikes=validate(doc.bikes);account=doc.user;revision=doc.revision;accountUI();choose(bikes[0]?.id||null);say('Cloud session restored.');}
  catch(error){if(token!==sessionToken)return;if(error.status===401){localMode();say('Your session has expired. Please log in again.');}else say('Cloud data is temporarily unavailable. Your login has been kept; reconnect or reload to try again. You are viewing local bikes.');}
  finally{if(token===sessionToken||!token)restoring=false;}
}
if(token)restoreSession();
window.addEventListener('online',()=>{if(token&&!account&&!restoring)restoreSession();});
window.addEventListener('storage',event=>{
  if(event.key!=='bike-session'&&event.key!==null)return;
  let next='';try{next=localStorage.getItem('bike-session')||'';}catch{return;}
  if(next===token)return;
  localMode(false);token=next;restoring=false;
  $('bike-dialog').close();$('auth-dialog').close();
  if(token)restoreSession();else say('Logged out in another tab. Local mode restored.');
});
if(!isLocalFile && 'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>say('Offline setup is unavailable. You can still use the app online.'));
