(function(){
  'use strict';
  const D=window.HR_DATA,E=window.HREngine,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Math.round(n).toLocaleString('en-US'),hex=n=>'0x'+n.toString(16).toUpperCase();
  const icon=window.HRUI.icon;
  const redraw=window.HR_REDRAWN||{assets:[],reviewed:0,total:595,complete:false};
  D.assets.push(...redraw.assets);
  const KEY='highreward.native.v1',PREF='highreward.preferences.v1';
  let prefs={theme:'hd',welcome:false};try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREF)||'{}')};}catch{}
  if(!prefs.artworkVersion){prefs.theme='redrawn';prefs.artworkVersion=3;try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}}
  if(window.HR_RELEASE?.online||!['hd','hd-ai','redrawn'].includes(prefs.theme))prefs.theme='redrawn';
  document.body.dataset.artwork=prefs.theme;
  let state;try{state=E.validateSave(JSON.parse(localStorage.getItem(KEY)||'null'),D);}catch{state=E.newGame(D);}
  let ui={view:'command',tab:'city',selected:0,base:state.squads[0].at,speed:0,archive:'characters',limit:48,query:'',routes:false,zoom:1,panX:0,panY:0,hover:null,facility:'roster',recruit:6,item:0,member:0};
  let battle=null,battleElapsed=0,autoBattle=true,modalKind='',toastTimer,saveUnavailable=false;
  const imageCache=new Map(),assetMap=new Map();
  for(const a of D.assets)for(const id of a.id.split(';'))assetMap.set(a.theme+':'+id,a);
  function asset(id){return assetMap.get(prefs.theme+':'+id)||assetMap.get('hd:'+id);}
  function url(id){return asset(id)?.url||'';}
  function portrait(i){return url('FACE.MRG:'+i)||url('FACE.MRG:0');}
  function img(id,cls='',alt=''){const u=url(id);return u?`<img src="${esc(u)}" class="${cls}" alt="${esc(alt)}" loading="lazy">`:'';}
  function sprite(id,alt=''){
    const a=asset(id);if(!a)return '';
    const n=a.normalization||{scale:1,tx:0,ty:0,aspect:Number(a.w)/Number(a.h)};
    return `<span class="sprite-viewport" style="--sprite-ratio:${n.aspect};--asset-transform:translate(${n.tx*100}%,${n.ty*100}%) scale(${n.scale})"><img src="${esc(a.url)}" alt="${esc(alt)}"></span>`;
  }
  function getImage(id){const src=url(id);if(!src)return null;if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}return imageCache.get(src);}
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
  function save(silent=false){try{localStorage.setItem(KEY,JSON.stringify(state));if(!silent)toast('已儲存在此瀏覽器。');}catch{saveUnavailable=true;if(!silent)toast('瀏覽器無法儲存，請使用匯出存檔。');}}
  function savePrefs(){try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}}
  function squad(){return state.squads[ui.selected];}
  const status=q=>q.order==='move'?'行軍中':q.order==='rest'?'休息中':'待命';
  const place=q=>E.atBase(q)?D.bases[q.at].name:q.order==='move'?'前往'+D.bases[q.route[0]].name:'野外待命';
  function itemStats(item){const s=item.recoveredStats;if(!s)return '';return `<div class="item-stats"><span>${icon('sword')}威力<strong>${s.power}</strong></span><span>${icon('shield')}防護<strong>${s.protection}</strong></span>${item.equipmentSlot==='weapon'?`<span>${icon('clock')}射速係數<strong>${s.parameter39}</strong></span>`:''}</div><small class="stat-source">原檔數值 · 傷害換算仍為重製暫定</small>`;}
  function act(action){try{E.command(state,D,{squad:ui.selected,...action});save(true);render();return true;}catch(e){toast(e.message);return false;}}
  function graphicButton(action,art,label,extra='',kind=''){
    return `<button class="graphic-action ${kind}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(art)}<span>${esc(label)}</span></button>`;
  }
  function facilityButton(key,art,label,disabled=false){
    return `<button class="facility-tile" data-facility="${key}" title="${esc(disabled?'先讓部隊抵達此處':label)}" aria-label="${esc(label)}" ${disabled?'disabled':''}><span class="facility-art">${icon(art)}</span><span>${esc(label)}</span></button>`;
  }
  function render(){
    $('#money').textContent=money(state.money);$('#debt').textContent=money(state.debt);$('#date').textContent=`${String(state.day).padStart(3,'0')}日 · ${String(state.hour).padStart(2,'0')}:00`;
    $$('#speeds button').forEach(b=>{b.classList.toggle('selected',+b.dataset.speed===ui.speed);b.setAttribute('aria-pressed',String(+b.dataset.speed===ui.speed));});
    $('#squads').innerHTML=state.squads.map((q,i)=>{
      const hp=q.members.reduce((n,m)=>n+m.hp,0),max=q.members.reduce((n,m)=>n+m.maxHp,0);
      return `<button class="squad-card ${i===ui.selected?'active':''} ${q.order==='move'?'marching':''}" data-squad="${i}" aria-pressed="${i===ui.selected}" aria-label="第${i+1}隊 ${esc(q.leader)}" title="${esc(q.name)} · ${esc(place(q))} · ${status(q)}"><span class="portrait"><span class="sq-index">${['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][i]}</span><img src="${esc(portrait(i))}" alt="${esc(q.leader)}頭像候選"><span class="sq-state">${icon(q.order==='move'?'move':q.order==='rest'?'camp':'shield')}</span></span><span class="sq-info"><strong>${esc(q.leader)}</strong><span class="unit-bars"><span class="hp-bar" title="生命 ${Math.round(hp/max*100)}%"><i style="width:${hp/max*100}%"></i></span><span class="stamina-bar" title="體力 ${Math.round(q.stamina)}%"><i style="width:${q.stamina}%"></i></span></span><small>${esc(place(q))}</small></span><span class="unit-count">${q.members.length}</span></button>`;
    }).join('');
    const q=squad(),hp=q.members.reduce((n,m)=>n+m.hp,0),max=q.members.reduce((n,m)=>n+m.maxHp,0);
    $('#selectedSquad').innerHTML=`<div class="commander"><div class="commander-portrait"><img src="${esc(portrait(q.face))}" alt="部隊肖像候選"><b>${['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][q.id]}</b></div><div class="commander-copy"><small>${esc(q.name)}</small><h3>${esc(q.leader)}</h3><div class="commander-meta"><span title="部隊人數">${icon('people')} ${q.members.length}/11</span><span title="部隊體力">${icon('heart')} ${Math.round(q.stamina)}%</span><b class="order-badge">${status(q)}</b></div><div class="unit-bars"><span class="hp-bar"><i style="width:${hp/max*100}%"></i></span><span class="stamina-bar"><i style="width:${q.stamina}%"></i></span></div></div></div>`;
    $$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(ui.tab===b.dataset.tab)));
    renderDesk();$('#log').innerHTML=state.log.slice(0,30).map(e=>`<div class="log-entry"><time>DAY ${String(e.day).padStart(3,'0')}</time><span>${esc(e.text)}</span></div>`).join('');
    $('#latestReport').textContent=state.log[0]?.text||'等待新的軍情…';
    window.HRUI.decorate();
  }
  function renderDesk(){
    const q=squad(),b=D.bases[ui.base],here=E.atBase(q)&&q.at===ui.base&&q.order!=='move';
    const section=(art,title,meta='')=>`<div class="visual-heading">${icon(art)}<h3>${title}</h3>${meta?`<span>${meta}</span>`:''}</div>`;
    let content='';
    if(ui.tab==='city'){
      const ci=b.countryIndexCandidate??0,c=D.countries[ci],p=E.routePlan(D,E.position(q,D),b.index),distance=p?p.cells.length-1:0;
      content=`<div class="location-panorama">${img('MAP'+String(ci+1).padStart(2,'0')+'.PXZ','',c.name+'原作地圖')}<div class="location-caption"><small>${esc(c.name)}</small><h3>${esc(b.name)}</h3></div><button class="scene-info" data-country="${ci}" aria-label="查看國家介紹" title="查看國家介紹">${icon('book')}</button><span class="scene-stamp">${here?'部隊駐留':'目的地'}</span></div><div class="facility-grid">${facilityButton('board','scroll','委託看板',!here)}${facilityButton('recruit','tavern','酒館招募',!here)}${facilityButton('shop','forge','武器商店',!here)}${facilityButton('clinic','heal','醫院治療',!here)}${facilityButton('camp','camp','紮營休息',!here)}${facilityButton('finance','chest','金庫',!here)}</div><div class="map-orders">${graphicButton('move','move',here?'駐留中':'向此處行軍',here||q.order==='move'||!distance?'disabled':'','primary')}${graphicButton('stop','stop','停止行軍',q.order!=='move'?'disabled':'')}</div><details class="location-picker"><summary>${icon('map')}選擇其他據點<span>⌄</span></summary><select id="baseSelect" aria-label="選擇據點">${D.countries.map(country=>`<optgroup label="${esc(country.name)}">${D.bases.filter(x=>x.countryIndexCandidate===country.index).map(x=>`<option value="${x.index}" ${x.index===b.index?'selected':''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select></details><div class="travel-status">${icon(q.order==='move'?'move':'flag')}<span>${esc(q.order==='move'?'行軍目的地：'+D.bases[q.route[q.route.length-1]].name:place(q))}</span>${q.order==='move'?`<b>${Math.round(q.progress*100)}%</b>`:`<b>${distance?distance+' 格步行路線':here?'駐留中':'地形或封鎖不可通行'}</b>`}</div>`;
    }else if(ui.tab==='missions'){
      const active=state.taken.find(m=>m.squad===q.id),base=D.bases[q.at];
      content=section('scroll','委託看板',esc(base.name));
      const card=(m,taken)=>`<article class="quest-card ${taken?'accepted':''}"><span class="quest-pin"></span><div class="quest-type">${icon(m.kind==='battle'?'sword':'bag')}<span>${m.kind==='battle'?'軍事委託':'民事委託'}</span><b>${taken?'進行中':m.days+'日'}</b></div><div class="quest-illustration">${m.kind==='battle'?img('BC32.MRG:0','','原作戰鬥精靈')+img('BC32.MRG:9','','原作戰鬥精靈'):icon('scroll')+icon('bag')}</div><h3>${esc(m.title)}</h3><div class="quest-destination">${icon('flag')} ${esc(D.bases[m.to].name)}</div><div class="quest-bounty">${icon('coin')}<strong>${money(m.reward)}</strong><small>G</small></div>${taken?graphicButton(m.kind==='battle'?'battle':'missionMove',m.kind==='battle'?'sword':'move',m.kind==='battle'?'出擊':'出發',q.order==='move'||(m.kind==='battle'&&q.at!==m.to)?'disabled':'','primary'):`<button class="quest-accept" data-accept="${esc(m.id)}" aria-label="承接${esc(m.title)}" title="承接委託" ${active||q.order==='move'?'disabled':''}>${icon('scroll')}<span>接受委託</span></button>`}<small class="quest-fineprint">${taken?'期限：第 '+m.due+' 日':'報酬與流程採重製暫定規則'}</small></article>`;
      if(active)content+=card(active,true);
      let available=0;
      for(const m of E.offers(D,q.at)){if(state.completed.includes(m.id)||active?.id===m.id)continue;content+=card(m,false);available++;}
      if(!active&&!available)content+=`<div class="visual-empty">${icon('scroll')}<p>此處的委託已完成</p><button data-tab="city">前往其他城鎮</button></div>`;
    }else if(ui.tab==='troops'){
      content=`<div class="equipment-tabs" aria-label="整備設施"><button data-facility="roster" class="${ui.facility==='roster'?'selected':''}" title="部隊編制" aria-label="部隊編制">${icon('people')}<span>編制</span></button><button data-facility="recruit" class="${ui.facility==='recruit'?'selected':''}" title="酒館招募" aria-label="酒館招募">${icon('tavern')}<span>招募</span></button><button data-facility="shop" class="${ui.facility==='shop'?'selected':''}" title="武器商店" aria-label="武器商店">${icon('forge')}<span>商店</span></button></div>`;
      if(ui.facility==='recruit'){
        const recruits=D.classes.filter(c=>c.index>=6&&c.index<25),selected=recruits.find(c=>c.index===ui.recruit)||recruits[0];
        content+=section('tavern','酒館',q.members.length+'/11')+`<div class="recruit-gallery">${recruits.map(c=>`<button class="recruit-card ${c.index===ui.recruit?'selected':''}" data-recruit="${c.index}" aria-label="選擇${esc(c.name)}" title="${esc(c.name)} · ${money(1200+c.index*70)} G"><img src="${esc(portrait(c.index))}" alt="${esc(c.name)}頭像候選"><strong>${esc(c.name)}</strong><small>${money(1200+c.index*70)} G</small></button>`).join('')}</div><div class="selection-summary"><img src="${esc(portrait(selected.index))}" alt=""><div><strong>${esc(selected.name)}</strong><small>${money(1200+selected.index*70)} G</small></div>${graphicButton('hire','people','雇用至本隊',q.order==='move'||q.members.length>=11||state.money<1200+selected.index*70?'disabled':'','primary')}</div>`;
      }else if(ui.facility==='shop'){
        const items=(D.items||[]).filter(i=>i.equipmentSlot&&i.priceCandidate>0),selected=items.find(i=>i.index===ui.item)||items[0];ui.member=Math.min(ui.member,q.members.length-1);const recipient=q.members[ui.member];
        content+=section('forge','武器與防具',esc(recipient.name))+`<label class="equipment-recipient">裝備對象<select id="equipmentMember" aria-label="裝備對象">${q.members.map((m,i)=>`<option value="${i}" ${i===ui.member?'selected':''}>${esc(m.name)}${i===0?' · 隊長':''}</option>`).join('')}</select></label><div class="selection-summary item-summary">${img('ITEM.MRG:'+selected.iconIdCandidate,'','選取裝備')}<div><strong>${esc(selected.name)}</strong><small>${money(selected.priceCandidate)} G · ${selected.equipmentSlot==='weapon'?'武器':'防具'}</small></div>${graphicButton('buy','coin','購買並裝備',q.order==='move'||!E.atBase(q)||state.money<selected.priceCandidate?'disabled':'','primary')}</div>${itemStats(selected)}<div class="equipped-summary">${['weapon','armor'].map(slot=>{const e=D.items.find(x=>x.index===recipient[slot]);return `<span>${slot==='weapon'?'武器':'防具'}：${e?esc(e.name):'未裝備'}</span>`;}).join('')}</div><div class="inventory-grid">${items.map(i=>`<button class="inventory-slot ${i.index===ui.item?'selected':''} ${recipient[i.equipmentSlot]===i.index?'equipped':''}" data-item="${i.index}" aria-label="選擇${esc(i.name)}" title="${esc(i.name)} · ${money(i.priceCandidate)} G">${img('ITEM.MRG:'+i.iconIdCandidate,'',i.name+'圖示候選')}<span>${money(i.priceCandidate)}</span>${recipient[i.equipmentSlot]===i.index?'<b>✓</b>':''}</button>`).join('')}</div>`;
      }else{
        const slots=Array.from({length:Math.max(11,q.members.length)},(_,i)=>{const m=q.members[i];return m?`<div class="roster-slot" title="${esc(m.name)} · HP ${m.hp}/${m.maxHp} · 攻擊 ${m.attack}＋${E.equipmentStats(D,m).power} · 防禦 ${m.defense}＋${E.equipmentStats(D,m).protection} · 武器 ${esc(D.items.find(x=>x.index===m.weapon)?.name||'未裝備')} · 防具 ${esc(D.items.find(x=>x.index===m.armor)?.name||'未裝備')}"><img src="${esc(portrait(m.face))}" alt="${esc(m.name)}肖像候選">${i===0?'<span class="leader-crown">♛</span>':''}<span class="member-hp">${m.hp}/${m.maxHp}</span><span class="hp-bar"><i style="width:${m.hp/m.maxHp*100}%"></i></span><small>${esc(m.name)}</small><span class="roster-gear">${icon('sword')}${E.equipmentStats(D,m).power} ${icon('shield')}${E.equipmentStats(D,m).protection}</span></div>`:`<button class="roster-slot empty-slot" data-facility="recruit" aria-label="招募新成員" title="招募新成員">${icon('people')}<span>＋</span></button>`;});
        content+=section('people','部隊編制',q.members.length+'/11')+`<div class="roster-grid">${slots.join('')}</div><div class="formation">${['橫列','突擊','防守'].map((t,i)=>`<button data-formation="${i}" class="${q.formation===i?'selected':''}" aria-pressed="${q.formation===i}" title="${t}陣形" aria-label="${t}陣形">${img('SPOINT.MRG:'+i,'',t+'陣形示意')}<span>${t}</span></button>`).join('')}</div><div class="map-orders">${graphicButton('heal','heal','醫院治療',q.order==='move'?'disabled':'')}${graphicButton('rest','camp','休息回復',q.order==='move'?'disabled':'')}</div>`;
      }
      content+='<button class="rules-link" data-action="evidence" title="人物能力與裝備效果仍採重製暫定規則">ⓘ 重製暫定規則</button>';
    }else{
      content=section('chest','傭兵團金庫')+`<div class="treasury-art">${icon('chest')}${icon('coin')}${icon('bag')}</div><div class="treasury-stats"><div>${icon('coin')}<span>資金</span><strong>${money(state.money)}</strong></div><div>${icon('bag')}<span>債務</span><strong>${money(state.debt)}</strong></div></div><div class="finance-progress" title="債務餘額"><i style="width:${Math.min(100,state.debt/2500000*100)}%"></i></div><div class="repayment-grid">${[10000,50000,100000].map(n=>`<button data-repay="${n}" aria-label="還款${money(n)} G" title="還款 ${money(n)} G" ${state.money<Math.min(n,state.debt)||!state.debt?'disabled':''}>${icon('bag')}<strong>${money(n)}</strong><span>還款</span></button>`).join('')}</div><button class="graphic-action all-repay" data-repay="${Math.min(state.money,state.debt)}" ${!state.money||!state.debt?'disabled':''}>${icon('chest')}<span>可用資金全數還款</span></button><div class="achievement-row"><span title="完成委託">${icon('scroll')} ${state.completed.length}</span><span title="聲望">${icon('flag')} ${state.rep}</span></div><button class="rules-link" data-action="evidence">ⓘ 經濟數值仍採重製暫定規則</button>${state.ended?'<h3 class="gold">債務已清償！</h3>':''}`;
    }
    $('#deskContent').innerHTML=content;
    window.HRUI.decorate();
  }
  function setView(view){ui.view=view;$('#commandView').hidden=view!=='command';$('#atlasView').hidden=view!=='atlas';$('#archiveView').hidden=view!=='archive';$('#unitDeck').hidden=view!=='command';$$('.main-nav button').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));if(view==='atlas')renderAtlas();if(view==='archive')renderArchive();}
  function renderAtlas(){
    $('#atlas').innerHTML=D.countries.map(c=>`<button class="atlas-card" data-country="${c.index}">${img('MAP'+String(c.index+1).padStart(2,'0')+'.PXZ','',c.name+'地圖')}<div class="atlas-copy"><span class="eyebrow">NATION ${String(c.index+1).padStart(2,'0')} · ${(c.baseIndicesCandidate||[]).length} LOCATIONS</span><h3>${esc(c.name)}</h3><p>${esc(c.text.replace(c.name,'').trim()).slice(0,100)}…</p></div></button>`).join('');
  }
  function renderArchive(){
    $$('#archiveTabs button').forEach(b=>b.classList.toggle('selected',b.dataset.archive===ui.archive));
    const query=ui.query.toLowerCase();let rows=[],html='';
    if(ui.archive==='characters')rows=D.classes.filter(c=>c.name.toLowerCase().includes(query));
    if(ui.archive==='items')rows=(D.items||[]).filter(c=>c.name.toLowerCase().includes(query));
    if(ui.archive==='art')rows=D.assets.filter(a=>a.theme===prefs.theme&&(a.id+' '+a.kind).toLowerCase().includes(query));
    if(ui.archive==='text')rows=[...D.strings,...Object.values(D.textArchives).flat()].filter(s=>(s.id+' '+s.text).toLowerCase().includes(query));
    if(ui.archive==='text')html=rows.slice(0,ui.limit).map(s=>`<div class="text-row"><code>${esc(s.id)}<br>file ${hex(s.offset)}</code><span>${esc(s.text)}</span></div>`).join('');
    else html=`<div class="archive-grid">${rows.slice(0,ui.limit).map(r=>{
      if(ui.archive==='characters')return `<button class="archive-card" data-class="${r.index}"><img src="${esc(portrait(r.index))}" alt="索引 ${r.index} 的頭像候選" loading="lazy"><h3>${esc(r.name)}</h3><small>INDEX ${r.index} · ${hex(r.offset)}</small></button>`;
      if(ui.archive==='items')return `<button class="archive-card" data-inspect-item="${r.index}">${img('ITEM.MRG:'+r.iconIdCandidate,'',r.name+'圖示候選')}<h3>${esc(r.name)}</h3><small>${money(r.priceCandidate)} G（欄位候選）<br>${hex(r.offset)}</small></button>`;
      return `<button class="archive-card art-card" data-art="${esc(r.id)}"><img src="${esc(r.url)}" alt="${esc(r.id)}" loading="lazy"><h3>${esc(r.id)}</h3><small>${r.w} × ${r.h} · ${esc(r.kind)}</small></button>`;
    }).join('')}</div>`;
    $('#archiveResults').innerHTML=`<p class="count-label">共 ${rows.length} 項 · 已顯示 ${Math.min(ui.limit,rows.length)} 項${ui.archive==='characters'?' · 頭像與人物完整索引關係尚待驗證':''}</p>${html||'<div class="empty">沒有符合的資料</div>'}${rows.length>ui.limit?'<button class="load-more" id="loadMore">再顯示 48 項 ↓</button>':''}`;
  }
  const modal=$('#modal');
  function openModal(html,kind='info'){ui.speed=0;modalKind=kind;modal.dataset.kind=kind;$('#modalContent').innerHTML=html;if(!modal.open)modal.showModal();render();}
  function closeModal(){if(battle?.phase==='active'){toast('請先撤退或完成戰鬥。');return;}modal.close();modalKind='';battle=null;}
  function showWelcome(){openModal(`<div class="game-splash">${img('GMAP.PXS','splash-map','原作大陸全圖')}<div class="splash-copy"><span class="eyebrow">HIGH REWARD · WEB REMAKE</span><h2>傭兵團，再次出發。</h2><div class="splash-portraits">${[0,1,2,3,4,5].map(i=>`<img src="${esc(portrait(i))}" alt="原作人物頭像候選">`).join('')}</div><p>六支部隊。一片大陸。未完的傭兵之旅。</p><div class="modal-actions">${graphicButton('welcomeStart','sword','開始征戰','','primary')}${graphicButton('welcomeAtlas','map','探索世界')}</div><small>開發試作 · 戰役規則尚未完成原作驗證</small></div></div>`,'welcome');}
  function showEvidence(){openModal(`<span class="eyebrow">RESTORATION NOTES</span><h2>忠實重製的目前進度</h2><h3>從原檔恢復</h3><p>11 國介紹、99 個據點名稱、6 隊原作名稱、83 項人物／兵種、86 項裝備／載具，以及 1,314 段主程式文字。主程式文字雜湊逐項吻合套件清冊；原作套件含 HD／AI 各 595 項；本次素材已驗收 ${redraw.reviewed}/${redraw.total} 項（圖像重繪與向量重製）。</p><h3>0.4 已接入</h3><p>原作 128×96 地形、四向步行搜尋與通行係數；裝備威力、防護與射速數值；每名成員分開保存武器與防具。原作每隊 11 槽，舊檔超額成員保留。城鎮關聯指標不再當作道路。</p><h3>有來源支持，仍待驗證</h3><p>據點座標、據點關聯指標、國別資料結構、頭像索引、裝備價格及屬性欄位。它們可追溯原檔，但尚未完成執行期驗證。</p><h3>尚未移植完成</h3><p>原作完整戰鬥公式、行軍與時鐘對拍、跨國及載具資格、敵軍 AI、軍事／民事劇情、銀行追債、隱藏事件、結局與 DOS 存檔相容。本開發版中的可玩戰役採明示的暫定規則，不能當成原作通關或完整重寫。</p><p class="source">MAIN.EXE SHA-256<br>${esc(D.mainSha256)}<br>IDA segment × 16 + offset − 0xB600<br>${D.mapping.verifiedRows} / ${D.mapping.totalRows} indexed string hashes verified</p><div class="modal-actions"><button data-action="help">操作說明</button>${window.HR_RELEASE?.online?'':'<button data-action="original">開啟原版對照</button>'}</div>`,'evidence');}
  function showHelp(){openModal(`<span class="eyebrow">FIELD MANUAL</span><h2>指揮官手冊</h2><div class="help-grid"><div>${icon('people')}<h3>選擇部隊</h3><p>點選下方肖像，查看生命與體力條。1–6 可快速切換。</p></div><div>${icon('tavern')}<h3>招募與整備</h3><p>點酒館選兵種卡，再按雇用；商店先選裝備對象，再選武器或防具；兩個槽位分開保留。</p></div><div>${icon('scroll')}<h3>接受委託</h3><p>點看板上的懸賞卡。運送按「出發」，軍事委託按「出擊」。</p></div><div>${icon('play')}<h3>推進時間</h3><p>選目的城鎮，按「向此處行軍」便會自動播放。空白鍵暫停；停止行軍會保留途中位置。</p></div><div>${icon('heal')}<h3>休整部隊</h3><p>在城鎮點醫院或營帳；編制頁可點陣形圖切換戰術。</p></div><div>${icon('chest')}<h3>金庫與存檔</h3><p>點錢袋還款。上方磁碟圖示儲存，齒輪內可匯入或匯出進度。</p></div></div><p class="small muted">重製開發版的戰役數值與流程尚待原作驗證。原生 Web 存檔與 DOS 原版分開，不能互通。完整研究說明可由「還原進度」查看。</p>`,'help');}
  function showSettings(){
    const themes=window.HR_RELEASE?.online?['redrawn']:['redrawn','hd','hd-ai'];
    const names={redrawn:`高清重繪 · ${redraw.reviewed}/${redraw.total}`,hd:'原作 HD','hd-ai':'套件 AI 風格'};
    openModal(`<span class="eyebrow">SYSTEM</span><h2>設定與存檔</h2><div class="settings-row"><span>美術風格</span><select id="themeSelect">${themes.map(t=>`<option value="${t}" ${prefs.theme===t?'selected':''}>${names[t]}</option>`).join('')}</select></div><p class="small muted">${redraw.complete?'595項素材已完成重繪驗收。':`已驗收 ${redraw.reviewed}/${redraw.total} 項，其餘暫用原作素材；未完成項目不計為重繪。`}</p><div class="settings-row"><span>本機存檔</span><button data-action="save">儲存目前進度</button></div><div class="settings-row"><span>備份進度</span><button data-action="export">匯出 JSON</button></div><div class="settings-row"><span>恢復備份</span><button data-action="import">匯入 JSON</button></div><div class="settings-row"><span>開發測試戰役</span><button data-action="resetConfirm">重新開始</button></div><p class="small">${saveUnavailable?'此瀏覽器無法使用本機儲存，請使用匯出備份。':'進度只保存在目前瀏覽器，跨裝置請匯出JSON備份。'}</p><div class="modal-actions"><button data-action="evidence">還原進度</button><button data-action="help">操作說明</button></div>`,'settings');
  }
  function showCountry(i){const c=D.countries[i];openModal(`<span class="eyebrow">NATION ${i+1} / ORIGINAL ATLAS</span><h2>${esc(c.name)}</h2>${img('MAP'+String(i+1).padStart(2,'0')+'.PXZ','country-detail-img',c.name+'原作地圖')}<p>${esc(c.text)}</p><div class="base-tags">${D.bases.filter(b=>b.countryIndexCandidate===i).map(b=>`<button data-jumpbase="${b.index}">${esc(b.name)}</button>`).join('')}</div><p class="source">original/COUNTRY.MES · file ${hex(c.offset)} · CP950</p>`,'country');}
  function inspectClass(i){const c=D.classes.find(c=>c.index===i);if(!c)return;openModal(`<div class="modal-hero"><img src="${esc(portrait(i))}" alt="索引 ${i} 頭像候選"><div><span class="eyebrow">CHARACTER / TYPE ${i}</span><h2>${esc(c.name)}</h2><p>原版名稱直接從 MAIN.EXE 讀取。頭像依索引候選呈現，數值欄位仍待反組譯或執行期驗證，暫不將未知欄位標成確定的能力。</p><p class="source">original/MAIN.EXE · ${hex(c.offset)}<br>${esc(c.ida)} · record ${c.recordSize} bytes</p><h3>原始 16-bit 數值</h3><p>${c.u16FieldsAt22.map(n=>esc(n)).join(' · ')}</p></div></div>`,'class');}
  function inspectItem(i){const r=D.items.find(r=>r.index===i);if(!r)return;openModal(`<span class="eyebrow">ORIGINAL ITEM ${i}</span><h2>${esc(r.name)}</h2>${img('ITEM.MRG:'+r.iconIdCandidate,'country-detail-img','裝備圖示候選')}${itemStats(r)}<p>原檔價格：${money(r.priceCandidate)} G · 類別：${r.categoryCandidate}。</p><p>耐久欄位：${r.recoveredStats?.durability??'未確認'} · 回復代碼：${r.recoveredStats?.recoveryCode??'未確認'}</p><p>這些數字取自原作紀錄。威力、防護與射速係數已有原碼使用證據；商店實際價格、國別販售與完整傷害流程仍待還原。</p><p class="source">original/MAIN.EXE · file ${hex(r.offset)} · record ${r.recordSize} bytes</p>`,'item');}
  function showArt(id){const a=asset(id);if(!a)return;openModal(`<span class="eyebrow">ORIGINAL ASSET</span><h2>${esc(id)}</h2><img src="${esc(a.url)}" class="country-detail-img" alt="${esc(id)}"><p class="source">${esc(a.url)}<br>catalog ${a.w} × ${a.h} · ${esc(a.kind)} · ${esc(a.pal)} palette<br>PNG SHA-256: ${esc(a.fileSha256)}</p>`,'art');}
  function original(){if(window.HR_RELEASE?.online){toast('原版DOS對照僅於本機提供。');return;}if(location.protocol==='file:'){toast('請先執行「啟動網頁版.bat」，原版模擬器需要本機 HTTP 伺服器。');return;}window.open('/original/','_blank','noopener');}
  function startBattle(){try{battle=E.beginBattle(state,D,ui.selected);battleElapsed=0;autoBattle=true;openModal('','battle');renderBattle();}catch(e){toast(e.message);}}
  function renderBattle(){if(!battle)return;const b=battle;
    const team=(members,side)=>`<div class="battle-team ${side}">${members.map((m,i)=>`<div class="battle-unit ${m.hp?'':'dead'}">${sprite('BC32.MRG:'+(side==='allies'?i%4*3:9),m.name)}<div class="mini-bar"><i style="width:${m.hp/m.maxHp*100}%"></i></div><small>${m.hp}/${m.maxHp}</small></div>`).join('')}</div>`;
    const controls=b.phase==='active'
      ? graphicButton('battlePause',autoBattle?'pause':'play',autoBattle?'暫停戰鬥':'繼續戰鬥')+graphicButton('battleStep','arrow','單步推進')+graphicButton('retreat','back','撤退')
      : graphicButton('battleClose','castle','返回本部','','primary');
    $('#modalContent').innerHTML=`<span class="eyebrow">HIGH REWARD · BATTLE</span><h2>${esc(state.squads[b.squad].name)}</h2>
      <div class="battle-scene ${b.phase==='active'?'is-active':''}">${img('BSTAGE.MRG:1','battle-ground','原作戰鬥舞台')}<span class="battle-title">${esc(b.phase==='active'?'ENGAGED':b.phase==='won'?'VICTORY':'WITHDRAWAL')}</span><span class="battle-turn">TURN ${String(b.turn).padStart(2,'0')}</span>${team(b.allies,'allies')}${team(b.enemies,'enemies')}</div>
      ${b.phase==='active'?'':`<div class="battle-result">${b.phase==='won'?'VICTORY':'RETREAT'}</div><p style="text-align:center">${b.phase==='won'?`${icon('coin')} ${money(b.reward)} G`:'部隊已撤回'}</p>`}
      <details class="battle-details"><summary>戰鬥紀錄</summary><div class="battle-log">${b.log.slice(0,8).map(l=>`<div>${esc(l)}</div>`).join('')}</div></details>
      <div class="modal-actions">${controls}</div><p class="battle-rule">戰鬥試作 · 暫定規則</p>`;
  }
  // All dynamic strings from binary data or imported saves are escaped before insertion.
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.view){setView(b.dataset.view);return;}
    if(b.dataset.speed!==undefined){ui.speed=+b.dataset.speed;render();return;}
    if(b.dataset.squad!==undefined){ui.selected=+b.dataset.squad;ui.base=squad().at;focusOnBase(ui.base);render();return;}
    if(b.dataset.tab){ui.tab=b.dataset.tab;ui.facility='roster';render();return;}
    if(b.dataset.facility){
      const f=b.dataset.facility;
      if(f==='clinic'){if(act({type:'heal'}))toast('部隊已完成治療');return;}
      if(f==='camp'){act({type:'rest'});return;}
      if(f==='board')ui.tab='missions';else if(f==='finance')ui.tab='finance';else{ui.tab='troops';ui.facility=f;}
      render();return;
    }
    if(b.dataset.recruit!==undefined){ui.recruit=+b.dataset.recruit;renderDesk();return;}
    if(b.dataset.item!==undefined){ui.item=+b.dataset.item;renderDesk();return;}
    if(b.dataset.country!==undefined){showCountry(+b.dataset.country);return;}
    if(b.dataset.class!==undefined){inspectClass(+b.dataset.class);return;}
    if(b.dataset.inspectItem!==undefined){inspectItem(+b.dataset.inspectItem);return;}
    if(b.dataset.art){showArt(b.dataset.art);return;}
    if(b.dataset.archive){ui.archive=b.dataset.archive;ui.limit=48;renderArchive();return;}
    if(b.dataset.accept){act({type:'accept',id:b.dataset.accept});return;}
    if(b.dataset.formation!==undefined){act({type:'formation',value:+b.dataset.formation});return;}
    if(b.dataset.repay){act({type:'repay',amount:+b.dataset.repay});return;}
    if(b.dataset.jumpbase!==undefined){ui.base=+b.dataset.jumpbase;ui.tab='city';closeModal();setView('command');render();return;}
    switch(b.dataset.action){
      case 'move':if(act({type:'move',to:ui.base})){ui.speed=1;render();toast('已開始步行，時間自動播放。');}break;
      case 'rest':act({type:'rest'});break;
      case 'stop':act({type:'stop'});break;
      case 'heal':act({type:'heal'});break;
      case 'localMissions':ui.tab='missions';render();break;
      case 'troops':ui.tab='troops';ui.facility='roster';render();break;
      case 'journal':openModal('<h2>行動紀錄</h2>'+$('#log').innerHTML,'journal');break;
      case 'hire':act({type:'hire',classId:ui.recruit});break;
      case 'buy':act({type:'buy',item:ui.item,member:ui.member});break;
      case 'missionMove':{const m=state.taken.find(m=>m.squad===ui.selected);if(m){ui.base=m.to;act({type:'move',to:m.to});ui.speed=1;render();}break;}
      case 'battle':startBattle();break;
      case 'battlePause':autoBattle=!autoBattle;renderBattle();break;
      case 'battleStep':E.battleStep(state,battle);renderBattle();save(true);render();break;
      case 'retreat':E.finishBattle(state,battle,false);renderBattle();save(true);render();break;
      case 'battleClose':closeModal();render();break;
      case 'welcomeStart':prefs.welcome=true;savePrefs();closeModal();break;
      case 'welcomeAtlas':prefs.welcome=true;savePrefs();closeModal();setView('atlas');break;
      case 'help':showHelp();break;
      case 'evidence':showEvidence();break;
      case 'original':original();break;
      case 'save':save();break;
      case 'export':{const file=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=`highreward-web-day${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('已匯出 Web 存檔。');break;}
      case 'import':$('#importFile').click();break;
      case 'resetConfirm':openModal('<h2>重新開始測試戰役</h2><p>目前瀏覽器中的原生重製進度會被覆寫。可先匯出 JSON 留存。</p><div class="modal-actions"><button data-action="export">先匯出</button><button class="primary" data-action="reset">確定重新開始</button></div>','reset');break;
      case 'reset':state=E.newGame(D);ui.selected=0;ui.base=state.squads[0].at;ui.speed=0;save(true);closeModal();render();toast('已建立新的原生測試戰役。');break;
    }
    if(b.id==='loadMore'){ui.limit+=48;renderArchive();}
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='equipmentMember'){ui.member=+e.target.value;renderDesk();}
    if(e.target.id==='baseSelect'){ui.base=+e.target.value;focusOnBase(ui.base);renderDesk();}
    if(e.target.id==='themeSelect'){prefs.theme=e.target.value;document.body.dataset.artwork=prefs.theme;savePrefs();imageCache.clear();render();if(ui.view==='atlas')renderAtlas();if(ui.view==='archive')renderArchive();toast('已切換美術風格。');}
  });
  $('#importFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2*1024*1024)throw Error('存檔大小超過 2 MB');const restored=E.validateSave(JSON.parse(await f.text()),D);state=restored;ui.selected=0;ui.base=squad().at;ui.speed=0;save(true);closeModal();render();toast('已恢復 Web 存檔。');}catch(err){toast('無法匯入：'+err.message);}finally{e.target.value='';}});
  $('#search').addEventListener('input',e=>{ui.query=e.target.value;ui.limit=48;renderArchive();});
  $('#saveBtn').onclick=()=>save();$('#menuBtn').onclick=showSettings;$('#evidenceBtn').onclick=showEvidence;$('#helpBtn').onclick=showHelp;$('#originalBtn').onclick=original;$('#closeModal').onclick=closeModal;
  modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.code==='Space'&&!modal.open){e.preventDefault();ui.speed=ui.speed?0:1;render();}if(/^[1-6]$/.test(e.key)&&!modal.open){ui.selected=+e.key-1;ui.base=squad().at;render();}});
  $('.brand').onclick=e=>{e.preventDefault();setView('command');};
  // Canvas is projected in the original 160x100 world coordinate candidates.
  const canvas=$('#world'),ctx=canvas.getContext('2d');let hitBases=[],hitSquads=[],pointer=null,lastDraw=0;
  function mapScale(){return ui.zoom*Math.max(1,canvas.height/800);}
  function clampPan(){const scale=mapScale(),maxX=Math.max(0,(1280*scale-1280)/2),maxY=Math.max(0,(800*scale-canvas.height)/2);ui.panX=Math.max(-maxX,Math.min(maxX,ui.panX));ui.panY=Math.max(-maxY,Math.min(maxY,ui.panY));}
  function focusOnBase(id){const b=D.bases[id],scale=mapScale();ui.panX=-(b.xCandidate*8-640)*scale;ui.panY=-(b.yCandidate*8-400)*scale;clampPan();}
  function project(x,y){const scale=mapScale();return {x:(x*8-640)*scale+640+ui.panX,y:(y*8-400)*scale+canvas.height/2+ui.panY};}
  function drawMap(now){
    const box=canvas.getBoundingClientRect();
    if(box.width<1||box.height<1)return;
    const height=Math.max(1,Math.round(1280*box.height/box.width));
    if(canvas.height!==height){const oldScale=mapScale();canvas.height=height;const ratio=mapScale()/oldScale;ui.panX*=ratio;ui.panY*=ratio;}
    clampPan();
    ctx.clearRect(0,0,1280,canvas.height);ctx.fillStyle='#13251c';ctx.fillRect(0,0,1280,canvas.height);
    const bg=getImage('GMAP.PXS');
    if(bg?.complete&&bg.naturalWidth){ctx.save();ctx.translate(640+ui.panX,canvas.height/2+ui.panY);ctx.scale(mapScale(),mapScale());ctx.imageSmoothingEnabled=prefs.theme!=='hd';ctx.imageSmoothingQuality='high';ctx.globalAlpha=.9;ctx.drawImage(bg,-640,-400,1280,800);ctx.fillStyle='#0d241d';ctx.globalAlpha=.12;ctx.fillRect(-640,-400,1280,800);ctx.restore();}
    hitBases=[];hitSquads=[];
    const selected=squad(),plan=selected.travel?{cells:selected.travel.cells.slice(selected.travel.cursor)}:ui.routes?E.routePlan(D,E.position(selected,D),ui.base):null;
    if(plan?.cells.length){ctx.strokeStyle='#f4d885';ctx.lineWidth=3;ctx.setLineDash([9,7]);ctx.beginPath();const w=D.mechanics.movement.width;plan.cells.map(i=>project(i%w,Math.floor(i/w))).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
    D.bases.forEach(b=>{
      const p=project(b.xCandidate,b.yCandidate);if(p.x<0||p.x>1280||p.y<0||p.y>canvas.height)return;
      const chosen=b.index===ui.base,hover=b.index===ui.hover;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillStyle=chosen?'#ffdd80':'#e1ce91';ctx.strokeStyle='#423d22';ctx.lineWidth=1.7;ctx.fillRect(-3,-3,6,6);ctx.strokeRect(-3,-3,6,6);ctx.restore();
      if(chosen){ctx.beginPath();ctx.strokeStyle='#ffe7a0';ctx.lineWidth=2;ctx.arc(p.x,p.y,11+Math.sin(now/500)*2,0,Math.PI*2);ctx.stroke();}
      if(chosen||hover){ctx.font='bold 17px "Microsoft JhengHei",sans-serif';const w=ctx.measureText(b.name).width;ctx.fillStyle='#0f1b15ed';ctx.fillRect(p.x-w/2-9,p.y-36,w+18,26);ctx.fillStyle='#f0ddb2';ctx.textAlign='center';ctx.fillText(b.name,p.x,p.y-17);}
      hitBases.push({id:b.index,...p});
    });
    state.squads.forEach((q,i)=>{
      const {x,y}=E.position(q,D);
      const p=project(x,y),same=state.squads.slice(0,i).filter(o=>o.at===q.at&&o.order!=='move'&&q.order!=='move').length;p.x+=18+same*20;p.y-=10;
      const radius=i===ui.selected?16:12;ctx.beginPath();ctx.fillStyle=i===ui.selected?'#e1c17b':'#243c2b';ctx.strokeStyle=i===ui.selected?'#fff0b6':'#c2d9a5';ctx.lineWidth=2;ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=i===ui.selected?'#17251a':'#e4edcf';ctx.font='bold 13px Consolas,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x,p.y+1);ctx.textBaseline='alphabetic';hitSquads.push({id:i,...p});
    });
    if(ui.speed===0){ctx.fillStyle='#102219de';ctx.fillRect(20,canvas.height-56,125,30);ctx.fillStyle='#e6d18d';ctx.font='12px "Microsoft JhengHei"';ctx.textAlign='left';ctx.fillText('Ⅱ  時間已暫停',32,canvas.height-36);}
  }
  function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*1280,y:(e.clientY-r.top)/r.height*canvas.height};}
  canvas.addEventListener('pointerdown',e=>{pointer={...canvasPoint(e),clientX:e.clientX,clientY:e.clientY,px:ui.panX,py:ui.panY,drag:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{const p=canvasPoint(e);if(pointer){if(Math.hypot(e.clientX-pointer.clientX,e.clientY-pointer.clientY)>4)pointer.drag=true;if(pointer.drag){ui.panX=Math.max(-1000,Math.min(1000,pointer.px+p.x-pointer.x));ui.panY=Math.max(-650,Math.min(650,pointer.py+p.y-pointer.y));}}else{ui.hover=hitBases.find(b=>Math.hypot(p.x-b.x,p.y-b.y)<12)?.id??null;}});
  canvas.addEventListener('pointerup',e=>{if(!pointer)return;const p=canvasPoint(e);if(!pointer.drag){const q=hitSquads.find(q=>Math.hypot(q.x-p.x,q.y-p.y)<18),b=hitBases.reduce((best,b)=>{const d=Math.hypot(b.x-p.x,b.y-p.y);return d<18&&(!best||d<best.d)?{...b,d}:best;},null);if(q){ui.selected=q.id;ui.base=squad().at;}else if(b){ui.base=b.id;ui.tab='city';}render();}pointer=null;});
  canvas.addEventListener('pointercancel',()=>pointer=null);
  function zoom(delta){ui.zoom=Math.max(1,Math.min(3,ui.zoom+delta));$('#zoomLabel').textContent=Math.round(ui.zoom*100)+'%';if(ui.zoom===1){ui.panX=0;ui.panY=0;}}
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?-.15:.15);},{passive:false});$('#zoomIn').onclick=()=>zoom(.25);$('#zoomOut').onclick=()=>zoom(-.25);$('#resetMap').onclick=()=>{ui.zoom=1;ui.panX=0;ui.panY=0;$('#zoomLabel').textContent='100%';};
  $('#toggleRoutes').onclick=()=>{ui.routes=!ui.routes;$('#toggleRoutes').setAttribute('aria-pressed',String(ui.routes));$('#toggleRoutes').textContent=ui.routes?'隱藏步行路線':'預覽步行路線';};
  let previous=performance.now(),elapsed=0,saveElapsed=0;
  function frame(now){const dt=Math.min(.2,(now-previous)/1000);previous=now;
    if(battle?.phase==='active'&&autoBattle){battleElapsed+=dt;if(battleElapsed>=.8){battleElapsed=0;E.battleStep(state,battle);renderBattle();if(battle.phase!=='active'){save(true);render();}}}
    if(ui.speed&&!modal.open&&!state.ended){elapsed+=dt*ui.speed;if(elapsed>=.8){const hours=Math.floor(elapsed/.8);elapsed-=hours*.8;E.step(state,D,hours);render();}}
    saveElapsed+=dt;if(saveElapsed>=15){saveElapsed=0;if(!battle||battle.phase!=='active')save(true);}
    if(ui.view==='command'&&now-lastDraw>33){drawMap(now);lastDraw=now;}
    requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide',()=>save(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){ui.speed=0;autoBattle=false;save(true);render();}});
  render();renderAtlas();drawMap(performance.now());requestAnimationFrame(frame);if(!prefs.welcome)showWelcome();
})();
