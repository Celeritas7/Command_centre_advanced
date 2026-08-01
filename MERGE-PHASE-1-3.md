# Phase 1–3 Merge into CC index.html

Apply these changes in order. Conflict resolution: **replace** existing implementations where noted.

---

## CHANGE 1: Holiday cache — variable declarations (REPLACE existing)

Find the `let holidayMap` and `let personalDaysOff` declarations and replace them with:

```js
let holidayMap=(()=>{try{return JSON.parse(localStorage.getItem('cc_holidayMap'))||{}}catch(e){return{}}})();
let personalDaysOff=(()=>{try{return JSON.parse(localStorage.getItem('cc_personalDaysOff'))||{}}catch(e){return{}}})();
```

## CHANGE 2: loadHolidays() — add localStorage save (EDIT existing)

Inside `loadHolidays()`, after the forEach loop that populates holidayMap, add this line before the console.log:

```js
    localStorage.setItem('cc_holidayMap',JSON.stringify(holidayMap));
```

And change the console.log to: `'✅ Holidays loaded from API & cached:'`
And change the catch message to: `'Holiday API failed (using cache):'`

## CHANGE 3: loadPersonalDaysOff() — add localStorage save (EDIT existing)

Inside `loadPersonalDaysOff()`, after the forEach loop, add:

```js
    localStorage.setItem('cc_personalDaysOff',JSON.stringify(personalDaysOff));
```

Change catch message to: `'Personal days load (using cache):'`

## CHANGE 4: Takeover backgrounds (ADD after existing 6 themes)

After `.tkv-ov.fashion{...}`, add these 14 lines:

```css
.tkv-ov.quickstudy{background:linear-gradient(160deg,#7c2d12,#9a3412,#c2410c)}
.tkv-ov.aistudy{background:linear-gradient(160deg,#1e1b4b,#3730a3,#4f46e5)}
.tkv-ov.appgen{background:linear-gradient(160deg,#172554,#1e3a8a,#1d4ed8)}
.tkv-ov.managertasks{background:linear-gradient(160deg,#450a0a,#991b1b,#b91c1c)}
.tkv-ov.reminders{background:linear-gradient(160deg,#78350f,#92400e,#b45309)}
.tkv-ov.peopletasks{background:linear-gradient(160deg,#4c1d95,#5b21b6,#6d28d9)}
.tkv-ov.cost{background:linear-gradient(160deg,#365314,#3f6212,#4d7c0f)}
.tkv-ov.weather{background:linear-gradient(160deg,#0c4a6e,#075985,#0369a1)}
.tkv-ov.health{background:linear-gradient(160deg,#064e3b,#047857,#059669)}
.tkv-ov.psychology{background:linear-gradient(160deg,#581c87,#6b21a8,#7c3aed)}
.tkv-ov.eagleeye{background:linear-gradient(160deg,#1c1917,#44403c,#57534e)}
.tkv-ov.ghosttracker{background:linear-gradient(160deg,#18181b,#27272a,#3f3f46)}
.tkv-ov.partinventory{background:linear-gradient(160deg,#1a2e05,#3f6212,#4d7c0f)}
.tkv-ov.shopping{background:linear-gradient(160deg,#713f12,#92400e,#b45309)}
```

Also add a fallback background to `.tkv-ov.show`:

```css
.tkv-ov.show{display:flex;animation:lockIn .6s ease;background:linear-gradient(160deg,#1a1a2e,#2d2d44,#3a3a55)}
```

## CHANGE 5: body.tkv-active in OQ callbacks (EDIT existing)

In the `OQ.push('takeover',85,...)` call, change the show callback to add `document.body.classList.add('tkv-active')` and hide callback to add `document.body.classList.remove('tkv-active')`. The callbacks should be:

```js
    ()=>{const el=document.getElementById('tkvOv');el.className='tkv-ov show '+tkvSqClass;document.body.classList.add('tkv-active')},
    ()=>{document.getElementById('tkvOv').classList.remove('show');document.body.classList.remove('tkv-active')}
```

## CHANGE 6: parseMd function (ADD before tkvRender)

Insert this immediately before `function tkvRender(){`:

```js
// Lightweight markdown → HTML for AI briefings
function parseMd(txt){
  if(!txt)return'';
  let h=esc(txt); // sanitize first
  h=h.replace(/^## (.+)$/gm,'<div style="font-size:13px;font-weight:700;margin:8px 0 4px;color:rgba(255,255,255,.95)">$1</div>');
  h=h.replace(/^# (.+)$/gm,'<div style="font-size:14px;font-weight:700;margin:8px 0 4px;color:white">$1</div>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/^[\u2013\u2014–—-]\s+(.+)$/gm,'<div style="padding-left:10px;margin:2px 0">• $1</div>');
  h=h.replace(/\n/g,'<br>');
  return h;
}
```

## CHANGE 7: tkvBriefText rendering (EDIT existing)

In `tkvRender()`, change:
```js
document.getElementById('tkvBriefText').textContent=tkvBriefText||'...';
```
to:
```js
document.getElementById('tkvBriefText').innerHTML=parseMd(tkvBriefText)||'...';
```

## CHANGE 8: ofcWorkDays upgrade (REPLACE existing)

Replace the entire `ofcWorkDays` function with:

```js
function ofcWorkDays(){
  const n=new Date(),y=n.getFullYear(),m=n.getMonth(),last=new Date(y,m+1,0).getDate();
  let c=0;
  for(let d=1;d<=last;d++){
    const dt=new Date(y,m,d);
    if(dt.getDay()===0||dt.getDay()===6)continue; // skip weekends
    const ds=dt.toISOString().split('T')[0]; // YYYY-MM-DD
    if(holidayMap[ds]||personalDaysOff[ds])continue; // skip holidays & personal days off
    c++;
  }
  return c;
}
```

## CHANGE 9: Freee transport generator (ADD after ofcWorkDays)

Insert immediately after `ofcWorkDays`:

```js
// ===== FREEE TRANSPORT GENERATOR =====
const FREEE_ROUTE='下総中山 → 流通センター';
const FREEE_ONE_WAY=830;
const FREEE_ROUND_TRIP=FREEE_ONE_WAY*2; // ¥1,660

function freeeGenText(){
  const wd=ofcWorkDays();
  const total=FREEE_ROUND_TRIP*wd;
  return `${FREEE_ROUTE}（往復）\n合計: ¥${FREEE_ROUND_TRIP.toLocaleString()} × ${wd}日 = ¥${total.toLocaleString()}`;
}

function freeeGenHTML(){
  const wd=ofcWorkDays();
  const total=FREEE_ROUND_TRIP*wd;
  const n=new Date();
  const monthLabel=(n.getMonth()+1)+'月';
  const y=n.getFullYear(),m=n.getMonth(),last=new Date(y,m+1,0).getDate();
  let totalWkd=0,holDays=[],pdoDays=[];
  for(let d=1;d<=last;d++){
    const dt=new Date(y,m,d);
    if(dt.getDay()===0||dt.getDay()===6)continue;
    const ds=dt.toISOString().split('T')[0];
    if(holidayMap[ds]){holDays.push(ds.slice(5));totalWkd++}
    else if(personalDaysOff[ds]){pdoDays.push(ds.slice(5));totalWkd++}
    else totalWkd++;
  }
  let breakdown=`${monthLabel}: 平日${totalWkd}日`;
  if(holDays.length)breakdown+=` − 祝日${holDays.length}日(${holDays.join(', ')})`;
  if(pdoDays.length)breakdown+=` − 休み${pdoDays.length}日(${pdoDays.join(', ')})`;
  breakdown+=` = <strong>${wd}日</strong>`;

  return `<div style="font-family:'DM Sans',monospace;font-size:12px;line-height:1.8">
    <div style="font-weight:700;margin-bottom:4px">🚃 ${esc(FREEE_ROUTE)}（往復）</div>
    <div style="color:#92400E;font-size:10px;margin-bottom:8px">${breakdown}</div>
    <div style="background:#FEF3C7;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:.3px">
      合計: ¥${FREEE_ROUND_TRIP.toLocaleString()} × ${wd}日 = <span style="color:#D97706;font-size:15px">¥${total.toLocaleString()}</span>
    </div>
  </div>`;
}

async function freeeCopy(ev){
  const txt=freeeGenText();
  const btn=ev&&ev.target;
  try{await navigator.clipboard.writeText(txt);
    if(btn){btn.textContent='✓ Copied!';btn.style.background='#059669';btn.style.color='#fff';setTimeout(()=>{btn.textContent=btn.dataset.lbl||'📋 Copy';btn.style.background='';btn.style.color=''},1500)}
  }catch(e){
    const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;left:-9999px';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    if(btn){btn.textContent='✓ Copied!';setTimeout(()=>{btn.textContent=btn.dataset.lbl||'📋 Copy'},1500)}
  }
}
```

## CHANGE 10: Freee card in evening blocker (REPLACE ofcRenderBlLinks evening section)

In `ofcRenderBlLinks()`, the `if(eEl)` block currently renders all evening links as plain cards. Replace the evening forEach with:

```js
  if(eEl){let h='';ofcBlLinks.filter(l=>l.screen==='evening').filter(l=>l.id!=='bl_freee'||isFreeeDay()).forEach(l=>{
    if(l.id==='bl_freee'){
      // Rich Freee transport generator card
      h+='<div class="ofc-freee" style="margin:8px 0">';
      h+='<div class="ofc-freee-hdr"><span style="font-size:18px">💴</span><div class="ofc-freee-title">Transport Reimbursement</div><span class="ofc-freee-badge">'+(new Date().getMonth()+1)+'月</span></div>';
      h+='<div class="ofc-freee-gen" id="freeeGenBoxBl">'+freeeGenHTML()+'</div>';
      h+='<div class="ofc-freee-actions">';
      h+='<button class="ofc-freee-btn pri" data-lbl="📋 Copy" onclick="freeeCopy(event)">📋 Copy</button>';
      h+='<button class="ofc-freee-btn sec" onclick="window.open(\''+esc(ofcLinks.freee)+'\',\'_blank\')">Open Freee ↗</button>';
      h+='<button class="ofc-freee-btn sec" onclick="ofcFreeeDone=true;saveOfcState();renderPitch()">✓ Done</button>';
      h+='</div></div>';
    }else{
      const hasUrl=l.url&&l.url.trim();h+='<div class="ofc-bl-card"><div class="ofc-bl-card-ico">'+l.ico+'</div><div class="ofc-bl-card-info"><div class="ofc-bl-card-name">'+esc(l.name)+'</div><div class="ofc-bl-card-desc">'+esc(l.desc)+'</div></div>'+(hasUrl?'<button class="ofc-bl-btn go" onclick="window.open(\''+esc(l.url)+'\',\'_blank\')">Open &#8599;</button>':'<span style="font-size:9px;color:rgba(255,255,255,.4)">No URL</span>')+'</div>';
    }
  });eEl.innerHTML=h}
```

## CHANGE 11: Freee card in office dashboard (REPLACE the showFreee block in renderPitch)

Find the `if(showFreee)` block and replace it with:

```js
  if(showFreee){const wd=ofcWorkDays();
    h+=`<div class="ofc-freee"><div class="ofc-freee-hdr"><span style="font-size:20px">💴</span><div class="ofc-freee-title">Transport Reimbursement</div><span class="ofc-freee-badge">${(new Date().getMonth()+1)}月</span></div>`;
    h+=`<div class="ofc-freee-desc">This month has <strong>${wd} working days</strong> (holidays & days off subtracted).</div>`;
    h+=`<div class="ofc-freee-gen" id="freeeGenBox">${freeeGenHTML()}</div>`;
    h+=`<div class="ofc-freee-actions"><button class="ofc-freee-btn pri" data-lbl="📋 Copy Text" onclick="freeeCopy(event)">📋 Copy Text</button><button class="ofc-freee-btn sec" onclick="window.open('${ofcLinks.freee}','_blank')">Open Freee ↗</button><button class="ofc-freee-btn sec" onclick="ofcFreeeDone=true;saveOfcState();renderPitch()">✓ Done</button></div></div>`;
```

## CHANGE 12: Freee CSS tweaks (EDIT existing)

Change `.ofc-freee-gen` padding from `padding:20px;text-align:center` to `padding:14px 16px;text-align:left`.

After `.ofc-freee-btn.sec{...}` add:
```css
.ofc-blocker .ofc-freee{max-width:360px;width:100%}
```

## CHANGE 13: Reminder Player CSS (ADD new block)

Insert this CSS block (e.g. before `/* Critical surface */`):

```css
/* ===== REMINDER PLAYER ===== */
.rp-btn{position:fixed;bottom:124px;left:16px;width:42px;height:42px;border-radius:50%;border:none;background:linear-gradient(135deg,#0F766E,#14B8A6);color:white;font-size:18px;cursor:pointer;box-shadow:0 4px 16px rgba(15,118,110,.35);z-index:199;transition:all .3s;display:flex;align-items:center;justify-content:center}
.rp-btn:active{transform:scale(.9)}
.rp-btn-dot{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;border:2px solid #fff}
.rp-btn-dot.on{background:#22C55E}.rp-btn-dot.off{background:#EF4444}
.rp-ov{position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);display:none;align-items:flex-end;justify-content:center;padding:0}
.rp-ov.show{display:flex;animation:ofcFadeIn .2s ease}
.rp-sheet{background:var(--card);border-radius:20px 20px 0 0;width:100%;max-width:440px;max-height:75vh;overflow-y:auto;padding:20px 16px 24px;animation:rpSlideUp .3s ease;box-shadow:0 -8px 32px rgba(0,0,0,.25)}
@keyframes rpSlideUp{from{opacity:0;transform:translateY(80px)}to{opacity:1;transform:translateY(0)}}
.rp-hd{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.rp-title{font-family:'Fraunces',serif;font-size:17px;font-weight:700;flex:1}
.rp-close{border:none;background:var(--as);width:30px;height:30px;border-radius:10px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--text);flex-shrink:0}
.rp-master{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;margin-bottom:14px;cursor:pointer;transition:all .2s}
.rp-master.on{background:rgba(34,197,94,.08);border:1.5px solid rgba(34,197,94,.2)}
.rp-master.off{background:rgba(239,68,68,.06);border:1.5px solid rgba(239,68,68,.15)}
.rp-master-lbl{font-size:13px;font-weight:600;flex:1}
.rp-master-sw{width:38px;height:20px;border-radius:10px;border:none;cursor:pointer;transition:all .2s;position:relative;padding:0}
.rp-master-sw.on{background:#22C55E}.rp-master-sw.off{background:#CBD5E1}
.rp-master-sw::after{content:'';position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:white;transition:all .15s}
.rp-master-sw.on::after{left:20px}.rp-master-sw.off::after{left:2px}
.rp-section{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin:12px 0 6px;display:flex;align-items:center;gap:6px}
.rp-trig{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid var(--as);margin-bottom:6px;transition:all .2s}
.rp-trig.disabled{opacity:.45}
.rp-trig-ico{font-size:16px;flex-shrink:0}
.rp-trig-info{flex:1;min-width:0}
.rp-trig-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-trig-meta{font-size:9px;color:var(--text2);margin-top:1px}
.rp-trig-status{font-size:8px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap}
.rp-trig-status.active{background:rgba(34,197,94,.12);color:#16A34A}
.rp-trig-status.cooldown{background:rgba(245,158,11,.12);color:#D97706}
.rp-trig-status.disabled{background:rgba(239,68,68,.1);color:#EF4444}
.rp-link{display:block;text-align:center;padding:10px;margin-top:12px;font-size:11px;color:var(--accent);text-decoration:none;border:1.5px dashed var(--as);border-radius:10px;font-weight:600}
.rp-qa{margin-top:14px;border-top:1.5px solid var(--as);padding-top:14px}
.rp-qa-title{font-size:11px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.rp-qa-row{display:flex;gap:6px;margin-bottom:6px;align-items:center}
.rp-qa-lbl{font-size:10px;color:var(--text2);min-width:55px;flex-shrink:0}
.rp-qa-inp{flex:1;border:1.5px solid var(--as);border-radius:8px;padding:6px 8px;font-size:11px;font-family:'DM Sans',sans-serif;outline:none;background:var(--bg);color:var(--text);min-width:0}
.rp-qa-sel{flex:1;border:1.5px solid var(--as);border-radius:8px;padding:6px 8px;font-size:11px;font-family:'DM Sans',sans-serif;outline:none;background:var(--bg);color:var(--text);min-width:0}
.rp-qa-btn{border:none;background:var(--accent);color:white;border-radius:8px;padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;width:100%;margin-top:6px}
.rp-qa-btn:active{transform:scale(.97)}
body.tkv-active .rp-btn{display:none!important}
```

## CHANGE 14: Reminder Player HTML (ADD after emgBtn)

After the `<button class="emg-btn" ...>🚨</button>` line, add:

```html
<button class="rp-btn" id="rpBtn" onclick="rpOpen()" style="display:none" title="Reminder Player">🛰️<div class="rp-btn-dot on" id="rpBtnDot"></div></button>
<div class="rp-ov" id="rpOv" onclick="if(event.target===this)rpClose()">
  <div class="rp-sheet" id="rpSheet"></div>
</div>
```

## CHANGE 15: Reminder Player JS (ADD after gpsTriggerLoadPending())

After the lines `gpsTriggerLoadCooldowns();` and `gpsTriggerLoadPending();`, insert the full RP module:

```js
// ===== REMINDER PLAYER (Phase 3) =====
var rpMasterOn=(()=>{try{const v=localStorage.getItem('cc_rp_master');return v===null?true:v==='true'}catch(e){return true}})();

function rpSaveMaster(){localStorage.setItem('cc_rp_master',String(rpMasterOn))}

function rpUpdateDot(){
  const dot=document.getElementById('rpBtnDot');
  if(!dot)return;
  dot.className='rp-btn-dot '+(rpMasterOn?'on':'off');
}

function rpOpen(){
  rpRender();
  document.getElementById('rpOv').classList.add('show');
}
function rpClose(){
  document.getElementById('rpOv').classList.remove('show');
}

function rpTrigStatus(trig){
  if(!rpMasterOn)return{cls:'disabled',lbl:'Master OFF'};
  const now=Date.now();
  const lastFire=gpsTriggerCooldowns[trig.id]||0;
  const cooldownMs=(trig.cooldown_min||60)*60*1000;
  if(now-lastFire<cooldownMs){
    const rem=Math.ceil((cooldownMs-(now-lastFire))/60000);
    return{cls:'cooldown',lbl:'⏳ '+rem+'m'};
  }
  return{cls:'active',lbl:'Ready'};
}

function rpRender(){
  const sh=document.getElementById('rpSheet');
  let h='';
  h+='<div class="rp-hd"><div class="rp-title">🛰️ Reminder Player</div><button class="rp-close" onclick="rpClose()">✕</button></div>';
  h+='<div class="rp-master '+(rpMasterOn?'on':'off')+'" onclick="rpToggleMaster()">';
  h+='<div style="font-size:20px">'+(rpMasterOn?'🟢':'🔴')+'</div>';
  h+='<div class="rp-master-lbl">'+(rpMasterOn?'GPS Triggers Active':'GPS Triggers Off')+'</div>';
  h+='<div class="rp-master-sw '+(rpMasterOn?'on':'off')+'"></div>';
  h+='</div>';

  h+='<div class="rp-section">📍 GPS Triggers ('+gpsTriggers.length+')</div>';
  if(!gpsTriggers.length){
    h+='<div style="font-size:11px;color:var(--text2);padding:12px;text-align:center;opacity:.7">No triggers configured yet</div>';
  }
  gpsTriggers.forEach(trig=>{
    const st=rpTrigStatus(trig);
    const zoneName=rpZoneName(trig);
    const daysLbl=trig.days&&trig.days.length?trig.days.join(', '):'any day';
    h+='<div class="rp-trig'+(st.cls==='disabled'?' disabled':'')+'">';
    h+='<div class="rp-trig-ico">📍</div>';
    h+='<div class="rp-trig-info">';
    h+='<div class="rp-trig-name">'+esc(trig.name)+'</div>';
    h+='<div class="rp-trig-meta">'+esc(zoneName)+' · '+esc(trig.squad||'—')+' · '+esc(daysLbl)+' · '+esc(trig.start_on||'immediate')+'</div>';
    h+='</div>';
    h+='<div class="rp-trig-status '+st.cls+'">'+st.lbl+'</div>';
    h+='</div>';
  });

  h+='<a class="rp-link" href="manager.html">⚙️ Manage Triggers — full settings</a>';

  h+='<div class="rp-qa">';
  h+='<div class="rp-qa-title">⚡ Quick Add Trigger</div>';
  h+='<div class="rp-qa-row"><span class="rp-qa-lbl">Name</span><input class="rp-qa-inp" id="rpQaName" placeholder="e.g. Library Study"></div>';
  h+='<div class="rp-qa-row"><span class="rp-qa-lbl">Zone</span><select class="rp-qa-sel" id="rpQaZone">';
  gpsZones.forEach(z=>{h+='<option value="'+z.id+'">'+esc(z.name)+' ('+z.radius+'m)</option>'});
  if(!gpsZones.length)h+='<option value="">No zones</option>';
  h+='</select></div>';
  h+='<div class="rp-qa-row"><span class="rp-qa-lbl">Squad</span><select class="rp-qa-sel" id="rpQaSquad">';
  SQUADS.forEach(sq=>{h+='<option value="'+esc(sq.name)+'">'+esc(sq.name)+'</option>'});
  h+='</select></div>';
  h+='<div class="rp-qa-row"><span class="rp-qa-lbl">Start on</span><select class="rp-qa-sel" id="rpQaStart"><option value="immediate">Immediate</option><option value="app_open">App open</option><option value="manual">Manual</option></select></div>';
  h+='<button class="rp-qa-btn" onclick="rpQuickAdd()">+ Add Trigger</button>';
  h+='</div>';

  sh.innerHTML=h;
}

function rpZoneName(trig){
  for(const z of gpsZones){
    const d=gpsDistM(trig.lat,trig.lng,z.lat,z.lng);
    if(d<50)return z.name;
  }
  return trig.lat.toFixed(3)+', '+trig.lng.toFixed(3);
}

function rpToggleMaster(){
  rpMasterOn=!rpMasterOn;
  rpSaveMaster();
  rpUpdateDot();
  rpRender();
}

async function rpQuickAdd(){
  const name=(document.getElementById('rpQaName').value||'').trim();
  if(!name){alert('Name is required');return}
  const zoneId=document.getElementById('rpQaZone').value;
  const squad=document.getElementById('rpQaSquad').value;
  const startOn=document.getElementById('rpQaStart').value;
  const zone=gpsZones.find(z=>String(z.id)===String(zoneId));
  if(!zone){alert('Select a zone');return}
  const row={
    name:name,
    lat:zone.lat,
    lng:zone.lng,
    radius:zone.radius,
    type:'trigger',
    action:'takeover',
    squad:squad,
    start_on:startOn,
    time_from:null,
    time_to:null,
    days:['weekday'],
    cooldown_min:30,
    enabled:true,
    sort_order:10+gpsTriggers.length,
    updated_at:new Date().toISOString()
  };
  try{
    const{data,error}=await sb.from('command_centre_gps_locations').insert(row).select();
    if(error){console.error('RP quick add:',error);alert('Save failed');return}
    if(data&&data[0])gpsTriggers.push(data[0]);
    rpRender();
    const inp=document.getElementById('rpQaName');
    if(inp)inp.value='';
  }catch(e){console.error('RP quick add:',e);alert('Save failed')}
}

// Override gpsCheckTriggers to respect master toggle
const _origGpsCheckTriggers=gpsCheckTriggers;
gpsCheckTriggers=function(){
  if(!rpMasterOn)return; // master OFF — skip all GPS trigger checks
  _origGpsCheckTriggers();
};
```

## CHANGE 16: Init line — show rpBtn (EDIT existing)

In the init line that shows buttons, add after `emgBtn` display:

```js
document.getElementById('rpBtn').style.display='';rpUpdateDot();
```

---

## Notes for conflict resolution

- `holidayMap` / `personalDaysOff`: REPLACE the plain `let x={}` with the IIFE-cache version
- `ofcWorkDays`: REPLACE — the old one only counted weekdays, the new one subtracts holidays + personal days
- `ofcRenderBlLinks` evening section: REPLACE — the old one rendered Freee as plain "Open" link
- `body.tkv-active` hide-list: Claude Code already has `.rp-btn` in it — no conflict
- Everything else is ADD (new code in new locations)
