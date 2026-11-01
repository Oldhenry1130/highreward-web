(function(){
  'use strict';
  const D=window.HR_DATA,E=window.HREngine,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Math.round(n).toLocaleString('en-US'),hex=n=>'0x'+n.toString(16).toUpperCase();
  const icon=window.HRUI.icon,Economy=window.HREconomy,H=window.HRHeraldry,G=window.HRFieldGuide,C=window.HRCharacterArt,W=window.HRWorldIntel;
  const redraw=window.HR_REDRAWN||{assets:[],reviewed:0,total:595,complete:false};
  D.assets.push(...redraw.assets);
  const KEY='highreward.native.v4',LEGACY_KEYS=['highreward.native.v2','highreward.native.v1'],PREF='highreward.preferences.v1';
  let prefs={theme:'hd',welcome:false};try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREF)||'{}')};}catch{}
  if(!prefs.artworkVersion){prefs.theme='redrawn';prefs.artworkVersion=3;try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}}
  if(window.HR_RELEASE?.online||!['hd','hd-ai','redrawn'].includes(prefs.theme))prefs.theme='redrawn';
  document.body.dataset.artwork=prefs.theme;
  let state,loadError=null,initialRaw=null;try{initialRaw=localStorage.getItem(KEY)||localStorage.getItem('highreward.native.v3');if(initialRaw){try{if(!localStorage.getItem(KEY+'.before-0.8.4'))localStorage.setItem(KEY+'.before-0.8.4',initialRaw);}catch{}}state=E.validateSave(JSON.parse(initialRaw||'null'),D);}catch(error){loadError=initialRaw?error.message:null;state=E.newGame(D);}
  try{if(!loadError&&!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(state));}catch{}
  const preferredSquad=state.story?.event?.type==='battle'?state.activeBattle?.squad:state.selectedSquad;
  const initialSquad=Number.isInteger(preferredSquad)&&preferredSquad>=0&&preferredSquad<6?preferredSquad:0;
  let ui={view:'command',tab:'city',selected:initialSquad,base:state.squads[initialSquad].at,speed:0,archive:'characters',limit:48,query:'',routes:false,zoom:1,panX:0,panY:0,hover:null,focusTarget:-1,focusUntil:0,facility:'roster',recruit:6,item:0,member:0};
  let battle=null,battleElapsed=0,autoBattle=true,battleInteracting=false,modalKind='',toastTimer,saveUnavailable=false;try{battle=E.restoreOriginalBattle(state);}catch(error){loadError=error.message;}
  let worldWorker=null,worldPending=false,worldGeneration=0,worldRequestView=null;
  function invalidateWorld(){worldGeneration++;}
  function requestWorld(ticks){
    if(worldPending)return;
    if(!worldWorker){
      worldWorker=new Worker('world-worker.js?v=0.8.4');
      worldWorker.onmessage=({data})=>{worldPending=false;if(data.generation!==worldGeneration)return;if(data.error){ui.speed=0;toast('世界運算已暫停：'+data.error);render();return;}const previousBase=state.squads[ui.selected].at,viewCountry=state.viewCountry;const preserveCountry=viewCountry!==worldRequestView?.country;state=data.state;state.selectedSquad=ui.selected;if(preserveCountry)state.viewCountry=viewCountry;if(!ui.point&&ui.base===previousBase&&state.squads[ui.selected].at!==previousBase){ui.base=state.squads[ui.selected].at;state.viewCountry=D.bases[ui.base].countryIndexCandidate;}render();if(state.story?.event&&!['complete','tick-complete'].includes(state.story.event.type)){ui.worldResumeSpeed=ui.speed||ui.worldResumeSpeed||1;save(true);renderStory();}};
      worldWorker.onerror=()=>{worldPending=false;ui.speed=0;worldWorker.terminate();worldWorker=null;toast('背景運算載入失敗，請重新整理後繼續。');render();};
    }
    worldPending=true;worldRequestView={country:state.viewCountry};worldWorker.postMessage({state,generation:worldGeneration,ticks});
  }
  const imageCache=new Map(),assetMap=new Map();
  for(const a of D.assets)for(const id of a.id.split(';'))assetMap.set(a.theme+':'+id,a);
  function asset(id){return assetMap.get(prefs.theme+':'+id)||assetMap.get('hd:'+id);}
  function url(id){return asset(id)?.url||'';}
  function portrait(i){return url('FACE.MRG:'+(D.classes.find(c=>c.index===i)?.spriteId??i))||url('FACE.MRG:0');}
  function faceHTML(i,label='',cls=''){return C.image(i,'portrait',label,cls)||`<img src="${esc(portrait(i))}" class="${esc(cls)}" alt="${esc(label)}">`;}
  function className(i){return C.name(i,D.classes.find(c=>c.index===i)?.name||'未知兵種');}
  function baseVisible(b){return state.mode!=='native-original'||state.world?.bases[b.index]?.kind!==5||ui.focusTarget===b.index&&performance.now()<ui.focusUntil;}
  function img(id,cls='',alt=''){const u=url(id);return u?`<img src="${esc(u)}" class="${cls}" alt="${esc(alt)}" loading="lazy">`:'';}
  function sprite(id,alt=''){
    const a=asset(id);if(!a)return '';
    const n=a.normalization||{scale:1,tx:0,ty:0,aspect:Number(a.w)/Number(a.h)};
    return `<span class="sprite-viewport" style="--sprite-ratio:${n.aspect};--asset-transform:translate(${n.tx*100}%,${n.ty*100}%) scale(${n.scale})"><img src="${esc(a.url)}" alt="${esc(alt)}"></span>`;
  }
  function getImage(id){const src=url(id);if(!src)return null;if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}return imageCache.get(src);}
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
  function save(silent=false){if(loadError){if(!silent)toast('原始存檔已保留，請先匯出或匯入有效備份');return;}try{localStorage.setItem(KEY,JSON.stringify(state));if(!silent)toast('已儲存在此瀏覽器。');}catch{saveUnavailable=true;if(!silent)toast('瀏覽器無法儲存，請使用匯出存檔。');}}
  function savePrefs(){try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}}
  function legacyBackup(){try{for(const key of LEGACY_KEYS){const raw=localStorage.getItem(key);if(raw)return raw;}}catch{}return null;}
  function exportLegacy(){const raw=legacyBackup();if(!raw){toast('沒有舊版試作存檔');return;}const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='highreward-v0.4-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function squad(){return state.squads[ui.selected];}
  const status=q=>q.originalOrder===undefined?(q.order==='move'?'行軍中':q.order==='rest'?'休息中':'待命'):({0:'行軍中',1:'退卻中',2:['駐留','公演中','施工中','商賣中','潛入中'][q.subtype||0],3:'休息中',4:'待機',5:'攻擊中',6:'偵察中',9:'執行任務'})[q.originalOrder]||'執行任務';
  const place=q=>E.atBase(q)?D.bases[q.at].name:q.order==='move'?'前往'+(q.route.length?D.bases[q.route[0]].name:`${q.targetX}，${q.targetY}`):'野外待命';
  function itemStats(item){const s=item.recoveredStats;if(!s)return '';return `<div class="item-stats"><span>${icon('sword')}威力<strong>${s.power}</strong></span><span>${icon('shield')}防護<strong>${s.protection}</strong></span>${item.equipmentSlot==='weapon'?`<span>${icon('clock')}射速係數<strong>${s.parameter39}</strong></span>`:''}</div><small class="stat-source">${state.mode==='native-original'?'原作裝備數值 · 實際傷害受能力、命中與防禦影響':'原檔數值 · 傷害換算仍為重製暫定'}</small>`;}
  function act(action){invalidateWorld();try{E.command(state,D,{squad:ui.selected,...action});save(true);render();if(state.story?.event&&!['complete','tick-complete'].includes(state.story.event.type)){renderStory();return false;}return true;}catch(e){toast(e.message);return false;}}
  function graphicButton(action,art,label,extra='',kind=''){
    return `<button class="graphic-action ${kind}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(art)}<span>${esc(label)}</span></button>`;
  }
  function facilityButton(key,art,label,disabled=false){
    return `<button class="facility-tile" data-facility="${key}" title="${esc(disabled?'先讓部隊抵達此處':label)}" aria-label="${esc(label)}" ${disabled?'disabled':''}><span class="facility-art">${icon(art)}</span><span>${esc(label)}</span></button>`;
  }
  const storyIcon=label=>/軍事|戰|攻|武器/.test(label)?'sword':/醫|病|回復/.test(label)?'heal':/酒店|酒館|傭兵|招募/.test(label)?'tavern':/商店|兵器|裝備/.test(label)?'forge':/金|銀行|支付|償還|薪|買|賣/.test(label)?'coin':/拒|不|結束|返回|離/.test(label)?'back':/民事|委託|佈告|情報/.test(label)?'scroll':/渡|船/.test(label)?'ferry':'book';
  function sourceTownActions(){if(state.mode==='native-original'&&(!E.atBase(squad())||!W.baseStatus(state,D,squad().at).canEnter))return [];try{return E.townActions(state,D,ui.selected).actions;}catch(e){return [];}}
  function townActionCards(filter=()=>true){
    return sourceTownActions().map((a,index)=>({...a,index})).filter(filter).map(a=>`<button class="facility-tile" data-original-town="${a.index}" aria-label="${esc(a.label.trim())}" title="${esc(a.label.trim())}"><span class="facility-art">${icon(storyIcon(a.label))}</span><span>${esc(a.label.trim())}</span></button>`).join('');
  }
  function beginStory(request){invalidateWorld();try{E.storyEvent(state,D,request);save(true);render();renderStory();}catch(e){toast(e.message);}}
  function continueStory(response={}){invalidateWorld();try{const previousBase=squad().at,receiptBefore=state.story?.incomeReceipt?.serial,event=E.storyResume(state,D,response);if(state.story?.incomeReceipt?.serial!==receiptBefore&&state.story?.incomeReceipt)toast(Economy.receiptText(state.story.incomeReceipt));if(!ui.point&&ui.base===previousBase&&squad().at!==previousBase){ui.base=squad().at;state.viewCountry=D.bases[ui.base].countryIndexCandidate;}if(event.type==='complete'&&event.ending?.id==='debtCleared'){state.ending={index:0,campaignBytes:event.ending.campaignBytes||state.originalCampaign,finished:false};save(true);render();showEnding();return;}if(state.story?.event?.type==='complete'){ui.speed=E.worldContinuationSpeed(state,ui.worldResumeSpeed||1);ui.worldResumeSpeed=0;}save(true);render();renderStory();}catch(e){toast(e.message);}}
  function showEnding(){
    if(!state.ending||!window.OriginalEnding)return;
    const sequence=window.OriginalEnding.buildEndingSequence(state.ending.campaignBytes),index=Math.max(0,Math.min(sequence.stages.length-1,state.ending.index)),stage=sequence.stages[index],credits=stage.id==='credits'||stage.preserveCreditSurface;
    const title=stage.id==='certificate'?'債務清償':stage.company||stage.id==='company-accounting'&&'傭兵團總帳'||(credits?'製作名單':'傭兵團的未來');
    if(prefs.music&&stage.musicFile)window.OriginalMusic?.play(stage.musicFile,{loop:credits});
    const scene=credits?`<div class="ending-credits ${stage.preserveCreditSurface?'ending-credits-finished':''}" style="background-image:url('${esc(url(stage.background||'ED7.GS'))}')">${img('ROLL.GS','ending-roll','原作製作名單')}</div>`:`<div class="ending-illustration">${img(stage.image,'','原作片尾場景')}</div>`;
    openModal(`<span class="eyebrow">HIGH REWARD · ORIGINAL ENDING ${index+1}/${sequence.stages.length}</span><h2>${esc(title)}</h2><div class="ending-stage ${credits?'credits-stage':''}">${scene}${stage.lines?.length?`<div class="ending-lines">${esc(stage.lines.join('\n'))}</div>`:''}</div><div class="modal-actions">${index?graphicButton('endingPrevious','back','上一幕'):''}${graphicButton(index===sequence.stages.length-1?'endingFinish':'endingNext',index===sequence.stages.length-1?'castle':'arrow',index===sequence.stages.length-1?'返回傭兵團':'下一幕','','primary')}</div>`,'ending');
  }
  function renderOriginalShop(e){
    if(armoryUI.renderShop(e))return;
    const options=e.options||[],shop=e.shopState||{},categories=options.filter(o=>o.id>=100&&o.id<104),offers=options.filter(o=>o.offerIndex!==undefined),members=options.filter(o=>o.originalSlot!==undefined),other=options.filter(o=>o.id!==-1&&!categories.includes(o)&&!offers.includes(o)&&!members.includes(o));
    const offer=offers.map(o=>{const item=D.items.find(x=>x.index===o.itemId),c=D.classes.find(c=>c.index===o.classId),label=item?(o.text||item.name):c?className(c.index):(o.text||'商品'),art=item?img('ITEM.MRG:'+item.iconIdCandidate,'',label):c?`${faceHTML(c.index,`${label}`,``)}`:icon('bag');return `<button class="native-shop-offer ${shop.selectedOfferIndex===o.offerIndex?'selected':''}" data-story-value="${o.id}">${art}<strong>${esc(label)}</strong>${o.price!==undefined?`<b>${money(o.price)} G</b>`:''}${item?itemStats(item):`<span>等級 ${o.experience??0}</span>`}</button>`;}).join('');
    const roster=members.map(o=>{const empty=o.classId===-1,raw=o.memberBytes,v=raw?new DataView(Uint8Array.from(raw).buffer):null,eligible=o.transactionEligibility?.eligible;return `<button class="native-shop-member ${eligible===false?'incompatible':''}" data-story-value="${o.id}" aria-label="${esc(o.text||'成員位置 '+(o.originalSlot+1))}" ${eligible===false?'disabled':''}>${empty?icon('people'):`${faceHTML(o.classId,``,``)}`}<strong>${esc(o.text||'空位')}</strong>${v&&!empty?`<small>HP ${v.getInt16(2,true)}/${v.getInt16(4,true)} · LV ${v.getInt16(6,true)}</small>`:'<small>＋</small>'}</button>`;}).join('');
    openModal(`<span class="eyebrow">HIGH REWARD · EQUIPMENT</span><h2>${shop.selectedCategory===3?'招募傭兵':shop.mode===2?'原作出售／解雇':'完成原作交易'}</h2><div class="native-shop-heading"><span>${icon('coin')} ${money(state.money)} G</span><b>${shop.mode===1?'選擇接收商品的成員':shop.mode===2?'選擇要出售的裝備':'選擇商品或成員'}</b>${shop.mode?`<strong>${shop.mode===2?'售價':'交易價'} ${money(shop.transactionPrice||0)} G</strong>`:''}</div><div class="native-shop-categories">${categories.map(o=>`<button data-story-value="${o.id}" class="${shop.selectedCategory===o.category?'selected':''}">${icon(storyIcon(o.text))}<span>${esc(o.text)}</span></button>`).join('')}</div><div class="native-shop-layout"><div class="native-shop-offers">${offer}</div><div class="native-shop-roster">${roster}</div></div><div class="native-shop-footer">${other.map(o=>`<button class="story-choice" data-story-value="${o.id}">${icon(storyIcon(o.text))}<span>${esc(o.text)}</span></button>`).join('')}<button class="story-choice" data-story-value="-1">${icon('back')}<span>${shop.mode?'取消選取':'離開商店'}</span></button></div>`,'story');
  }
  function renderStory(){
    const e=state.story?.event;if(!e||['complete','tick-complete'].includes(e.type)){if(modalKind==='story'){modal.close();modalKind='';}return;}
    if(e.type==='battle'){
      if(!battle||battle.storyEventKey!==state.activeBattle?.storyEventKey){
        try{battle=E.restoreOriginalBattle(state);battleElapsed=0;autoBattle=true;save(true);}catch(error){toast(error.message);return;}
      }openModal('','battle');renderBattle();return;
    }
    if(e.name==='shop.grid'){renderOriginalShop(e);return;}
    const speaker=e.title||state.story.speaker||'傭兵團',face=state.story.speakerFace,speakerId=C.speakerClass(face,speaker),faceImage=speakerId!==null?faceHTML(speakerId,speaker,'story-portrait'):Number.isInteger(face)&&asset('FACE.MRG:'+face)?`<img class="story-portrait" src="${esc(url('FACE.MRG:'+face))}" alt="${esc(speaker)}">`:`<span class="story-portrait story-silhouette">${icon('people')}</span>`;
    const choices=e.options||[],history=state.story.history.slice(-4),options=choices.map(o=>{
      const label=Economy.rewardText(o.text??(o.classId===-1?'空位 '+(o.id+1):'替換 '+(className(o.classId)||'成員')+' · 位置 '+(o.id+1)),/報酬/.test(e.title||''));
      return `<button class="story-choice" data-story-value="${o.id}" ${e.type==='selection'&&o.classId!==-1?'data-story-replace="true"':''}>${icon(storyIcon(label))}<span>${esc(label)}</span></button>`;
    }).join('');
    let controls=options;
    if(e.cancelValues?.includes(-1)&&!choices.some(o=>o.id===-1))controls+='<button class="story-choice" data-story-value="-1">'+icon('back')+'<span>返回</span></button>';
    if(['text','ending','quit'].includes(e.type))controls=graphicButton('storyNext','arrow',e.type==='quit'?'結束流程':'繼續','','primary');
    else if(e.type==='selection')controls+=`<button class="story-choice" data-story-value="65535">${icon('back')}<span>取消選擇</span></button>`;
    else if(['unresolved','fault'].includes(e.type))controls=`<p class="event-warning">事件已暫停，進度仍保留。請先備份存檔，以便修復接續。</p><p class="source">${esc(e.type+' · '+e.name+' · '+(e.message||''))}${e.source?' · '+esc(JSON.stringify(e.source)):''}</p><button data-action="export">備份目前存檔</button>`;
    openModal(`<span class="eyebrow">HIGH REWARD · ORIGINAL STORY</span>${eventLocationHTML()}<div class="story-stage">${img('MAP'+String((D.bases[squad().at].countryIndexCandidate??0)+1).padStart(2,'0')+'.PXZ','story-background','所在地景象')}${faceImage}<div class="story-speaker">${esc(e.title||speaker)}</div></div><div class="story-text">${esc(Economy.dialogueText(e.lines?.join('\n')||e.text||(['menu.choose','menu.window','vehicle.shop'].includes(e.name)?'請選擇行動。':history[history.length-1]?.text)||'請選擇行動。',Economy.dialogueContext(state.story)))}</div><div class="income-policy">任務／戰鬥／公演／劇情收益 ×5 · 支出與轉售維持原值</div><div class="story-choices">${controls}</div>`,'story');
  }
  function nativeDesk(){
    const q=squad();if(ui.tab==='missions')return `<div class="visual-heading">${icon('scroll')}<h3>原作委託</h3></div><div class="facility-grid">${townActionCards(a=>[65,66,67].includes(a.id))}</div>`;
    return `<div class="visual-heading">${icon('chest')}<h3>傭兵團金庫</h3></div><div class="treasury-art">${icon('chest')}${icon('coin')}${icon('bag')}</div><div class="treasury-stats"><div><span>資金</span><strong>${money(state.money)}</strong></div><div><span>債務</span><strong>${money(state.debt)}</strong></div></div>${state.ending?graphicButton('endingReplay','book','重看片尾','','primary'):graphicButton('originalBank','coin','雷奇法魯銀行','','primary')}<p>每週最低還款 ${money(state.minimumRepayment||5000)} G</p>`;
  }
  function nativeTasks(q){
    if(state.mode!=='native-original'||!window.OriginalContracts)return '';
    const decoded=window.OriginalContracts.decodeNativeTask(state.originalCampaign,window.OriginalStoryBridge.unitBytes(q,D),q.id);
    const tasks=decoded.tasks.concat(decoded.military.filter(m=>!decoded.tasks.some(t=>t.sourceOffset===m.sourceOffset)));
    return tasks.map(task=>`<article class="native-task"><span>${icon('scroll')}</span><div><strong>${esc(task.title||task.name||task.kind)}</strong>${task.scope==='campaign'?'<small>全團共同委託</small>':''}${Number.isInteger(task.destinationId)&&D.bases[task.destinationId]?`<button class="mission-target" data-mission-target="${task.destinationId}" aria-label="定位任務目的地 ${esc(task.destinationName||D.bases[task.destinationId].name)}">${icon('map')}<span>${esc(task.destinationName||D.bases[task.destinationId].name)}<small>點此定位並閃爍目的地</small></span>${icon('arrow')}</button>`:task.destinationName||task.targetName?`<p>${esc(task.destinationName||task.targetName)}</p>`:''}${task.remainingDays!==undefined&&task.remainingDays!==null?`<small>期限剩餘 ${task.remainingDays} 日</small>`:''}${Number.isFinite(task.currentDurability)&&Number.isFinite(task.targetDurability)?`<small>據點耐久 ${task.currentDurability} / ${task.targetDurability}</small>`:''}${task.reward!==null&&task.reward!==undefined?`<b>報酬 ${money(Economy.amount(task.reward))} G <small>收益 ×5</small></b>`:task.kind==='performance'?'<small>依演出結果結算</small>':''}</div></article>`).join('');
  }
  function showMember(slot){const m=squad().members.find((m,i)=>(m.originalSlot??i)===slot);if(!m)return;openModal(`<div class="modal-hero">${faceHTML(m.classId??m.face,`${m.name}`,``)}<div><h2>${esc(m.name)}</h2><p>生命 ${m.hp} / ${m.maxHp} · 等級 ${m.level} · 疲勞 ${m.fatigue??0}</p><p>基本攻擊 ${m.attack} · 基本防禦 ${m.defense}</p>${['weapon','armor','consumable'].map(key=>{const item=D.items.find(i=>i.index===m[key]);return `<h3>${{weapon:'武器',armor:'防具',consumable:'持物'}[key]}：${esc(item?.name||'未裝備')}</h3>${item?itemStats(item)+infoButton(item.index):''}`;}).join('')}</div></div>`,'member');}
  function showTransfers(){armoryUI.show(ui.selected,'formation');}
  function showMusic(){
    const music=window.OriginalMusic,status=music.getState(),tracks=music.list();ui.musicTrack??=tracks.find(t=>!t.empty)?.file;
    openModal(`<span class="eyebrow">HIGH REWARD · ORIGINAL MUSIC</span><h2>原作音樂</h2><p id="musicStatus">${status.enabled?'音樂已啟用':'音樂已關閉'}</p><label class="transfer-label">曲目<select id="musicTrack" aria-label="原作音樂曲目">${tracks.map(t=>`<option value="${esc(t.file)}" ${t.file===ui.musicTrack?'selected':''} ${t.empty?'disabled':''}>${esc(t.name||t.file)}${t.empty?' · 原檔空白':''}</option>`).join('')}</select></label><div class="modal-actions">${graphicButton('musicPlay','play','播放所選音樂','','primary')}${graphicButton('musicStop','stop','停止播放')}${graphicButton('musicToggle','music',status.enabled?'關閉音樂':'開啟音樂')}</div><p class="source">27 首原作 MIDI 旋律與節奏，由瀏覽器近似音色合成。片尾使用原作指定曲目。</p>`,'music');
  }
  async function playMusic(){try{await window.OriginalMusic.toggle(true);await window.OriginalMusic.play(ui.musicTrack);prefs.music=true;savePrefs();showMusic();$('#musicStatus').textContent='播放中：'+ui.musicTrack;}catch(e){toast('音樂無法播放：'+e.message);}}
  async function toggleMusic(){try{await window.OriginalMusic.toggle();prefs.music=window.OriginalMusic.getState().enabled;savePrefs();showMusic();}catch(e){toast(e.message);}}
  function showLoadRecovery(){openModal(`<h2>存檔暫時無法載入</h2><p>原始存檔已保留，不會以新戰役覆寫。請先匯出原始存檔，或匯入有效備份。</p><p class="source">${esc(loadError)}</p><div class="modal-actions"><button data-action="export">匯出原始存檔</button><button data-action="import">匯入備份</button><button data-action="reload">重試載入</button></div>`,'load-recovery');}
  function resumeScene(){
    if(loadError){showLoadRecovery();return;}
    if(E.recoverDefeatedCompany(state,D)){battle=null;ui.base=squad().at;save(true);render();toast('戰敗部隊已撤回安全據點，可休養或前往病院。');}
    if(state.story?.event?.type==='fault'){
      try{const source=window.HR_ORIGINAL_STORY.StoryVM.restore(state.story.snapshot);if(source.canRecoverPresentationFault()){continueStory();return;}}
      catch{/* Keep an unrecognized or damaged snapshot on the existing diagnostic/backup screen. */}
    }
    if(state.ending&&!state.ending.finished){showEnding();return;}
    if(state.mode==='native-original'&&state.story?.pendingOpeningEvents&&(!state.story.event||state.story.event.type==='complete')){E.step(state,D,1);save(true);}
    if(state.story?.event&&!['complete','tick-complete'].includes(state.story.event.type))renderStory();
  }
  function vehiclePanel(q,here){
    const t=D.original?.transport;if(!t)return '';
    const kinds={tank:['tank','車輛'],plane:['plane','飛機'],cannon:['sword','火砲']};
    const owned=Object.entries(kinds).map(([kind,[art,label]])=>{const v=t.vehicles.find(v=>v.kind===kind&&v.typeId===q[kind+'Id']);return `<div class="vehicle-owned">${icon(art)}<span>${label}<strong>${v?esc(v.name):'未配置'}</strong></span>${v?infoButton(v.itemId):''}${v&&kind!=='cannon'?`<b>${q[kind+'Durability']??0} / ${v.maxDurability}</b>`:''}</div>`;}).join('');
    const shops=E.vehiclesAt(D,q.at).map(shop=>{const v=t.vehicles.find(v=>v.kind===shop.kind&&v.typeId===shop.typeId),quote=window.OriginalTransport.tradeQuote(E.transportUnit(q,D),t.vehicles,shop.kind,shop.typeId,state.storyByte20??0),old=t.vehicles.find(v=>v.kind===shop.kind&&v.typeId===q[shop.kind+'Id']);return `<article class="vehicle-shop">${img('ITEM.MRG:'+D.items[v.itemId].iconIdCandidate,'',v.name)}<div><small>${esc(shop.name)}</small><strong>${esc(v.name)}</strong><span>耐久 ${v.maxDurability} · 威力 ${v.attack} · 防護 ${v.defense}</span>${infoButton(v.itemId)}<b>${quote.cost<0?'換購可取回':'換購價'} ${money(Math.abs(quote.cost??0))} G</b>${old?`<small>舊載具折抵 ${money(Math.trunc(old.price/2))} G</small>`:''}</div><button data-vehicle-buy="${shop.slot}" aria-label="購入${esc(v.name)}" ${!here?'disabled':''}>${icon('coin')}<span>${state.mode==='native-original'?'前往交易':old?'換購':'購入'}</span></button>${old?`<button data-vehicle-sell="${shop.slot}" aria-label="出售${esc(old.name)}" ${!here||!quote.ok?'disabled':''}>${icon('bag')}<span>出售 ${money(Math.trunc(old.price/2))}</span></button>`:''}</article>`;}).join('');
    return `<div class="vehicle-hangar">${owned}</div>${shops||'<p class="empty-state">此城鎮沒有原作載具商店。</p>'}`;
  }
  function transportControls(q,to){
    if(!D.original?.transport)return '';
    const options=E.movementOptions(state,D,q.id,to),labels=window.OriginalTransport.LABELS;
    if(!options.choices.includes(ui.travelMode??0))ui.travelMode=options.choices[0];
    const selectable=state.mode==='native-original'?E.commandAvailability(state,D,q.id).move:q.order!=='move';
    return `<div class="travel-modes" aria-label="交通方式">${[0,1,2].map(mode=>`<button data-travel-mode="${mode}" aria-label="${labels[mode]}" aria-pressed="${(ui.travelMode??0)===mode}" ${!selectable||!options.choices.includes(mode)?'disabled':''}>${icon(['move','tank','plane'][mode])}<span>${labels[mode]}</span></button>`).join('')}</div>`;
  }
  function worldOrders(q,to,point=null){
    const p=E.commandAvailability(state,D,q.id),target=point||D.bases[to],plan=E.routePlan(D,E.position(q,D),target,ui.travelMode??0,state),same=Math.trunc(E.position(q,D).x)===(target.xCandidate??target.x)&&Math.trunc(E.position(q,D).y)===(target.yCandidate??target.y),base=state.world?.bases[to],buttons=[];
    if(p.move)buttons.push(graphicButton(point?'moveToPoint':'move','move',same?'已在此處':'向此處行軍',same||!plan||state.ended?'disabled':'','primary'));
    if(p.scout&&base?.kind===2&&!point)buttons.push(graphicButton('scoutBase','map','偵察據點',state.ended?'disabled':''));
    if(p.standby)buttons.push(graphicButton('stop','stop','待機',state.ended?'disabled':''));
    if(p.rest)buttons.push(graphicButton('rest','camp','野外休息',state.ended?'disabled':''));
    if(p.enterBase)buttons.push(graphicButton('enterBase','castle','進入附近據點',state.ended?'disabled':''));
    if(p.occupy)buttons.push(graphicButton('occupy','flag','占領',state.ended?'disabled':''));
    if(p.attackSettings)buttons.push(graphicButton('attackSettings','sword','攻擊方式',state.ended?'disabled':''));
    if(p.retreat)buttons.push(graphicButton('retreatTravel','back','退卻',state.ended?'disabled':''));
    if(E.atBase(q))buttons.push(graphicButton('recoverInTown','camp','駐留回復',state.ended?'disabled':''));
    if(E.atBase(q)&&[27,28].includes(q.at))buttons.push(graphicButton('ferry','ferry','搭乘渡船',state.ended?'disabled':''));
    buttons.push(graphicButton('troops','people','部隊報告'));
    return `<div class="map-orders native-world-orders">${buttons.join('')}</div>`;
  }
  function pointDesk(q){
    const p=ui.point,country=E.countryAt(state,p.x,p.y),c=D.countries[country],background=c?'MAP'+String(country+1).padStart(2,'0')+'.PXZ':'GMAP.PXZ:0';
    return `<div class="location-panorama">${img(background,'','原作地圖')}<div class="location-caption"><small>${esc(c?.name||'大陸野外')}</small><h3>地圖座標 ${p.x}，${p.y}</h3></div></div>${transportControls(q,p)}${worldOrders(q,null,p)}<div class="travel-status">${icon('map')}<span>${esc(place(q))}</span></div>${nativeTasks(q)}<button class="rules-link" data-action="currentLocation">查看目前據點</button>`;
  }
  function townStateCard(id){const t=W.baseStatus(state,D,id);return `<section class="town-state ${t.tone}" role="status"><strong><span>${esc(t.symbol)}</span> ${esc(t.label)}</strong><p>${esc(t.detail)}</p></section>`;}
  function eventLocationHTML(){const n=W.notices(state,D)[0];if(!n?.pending)return '';return `<section class="event-location-card"><strong>${icon('map')}${esc(n.title)}位置</strong>${n.locations.map((p,i)=>`<button data-map-notice="0" data-map-location="${i}">${esc(p.label)}${p.evidence==='mentioned'?'<small>事件文字提及的地點</small>':''}<span>在地圖查看 →</span></button>`).join('')}</section>`;}
  function renderEventIntel(){
    const list=W.notices(state,D);if(ui.newestEventKey!==list[0]?.key){ui.newestEventKey=list[0]?.key;ui.eventNoticeIndex=0;}const n=list[ui.eventNoticeIndex||0]||list[0],panel=$('#worldEventPanel'),layer=$('#worldEventBeacons');
    if(n&&ui.lastEventKey!==n.key){ui.lastEventKey=n.key;ui.eventFlashUntil=performance.now()+15000;if(n.pending){const p=n.locations[0];ui.zoom=Math.max(1.4,ui.zoom);$('#zoomLabel').textContent=Math.round(ui.zoom*100)+'%';focusOnPoint(p);}}
    const html=list.length?`<strong>${icon('map')}事件定位</strong><div class="world-event-list">${list.map((entry,i)=>`<article><b>${esc(entry.title)}${entry.pending?' · 處理中':''}</b>${entry.locations.map((p,j)=>`<button data-map-notice="${i}" data-map-location="${j}">${esc(p.label)}${p.evidence==='mentioned'?' · 文中提及':''}<span>定位 ↗</span></button>`).join('')}</article>`).join('')}</div>${list.some(x=>x.pending)?'<button data-action="resumeEvent">返回目前事件</button>':''}`:'';
    $('#worldEventArea').hidden=ui.view!=='command'||!list.length;panel.hidden=!list.length;if(panel.dataset.content!==html){panel.innerHTML=html;panel.dataset.content=html;}
    const pins=n?n.locations.map((p,i)=>`<button class="world-event-beacon" data-map-notice="${Math.max(0,list.indexOf(n))}" data-map-location="${i}" aria-label="事件位置 ${esc(p.label)}"><b>!</b><span>${esc(p.label)}</span></button>`).join(''):'';
    if(layer.dataset.content!==pins){layer.innerHTML=pins;layer.dataset.content=pins;}
    $('#worldEventSummary').textContent=n?n.title+'：'+n.locations.map(p=>p.label).join('、'):'';
    $('#worldEventSummary').hidden=!n;
  }
  function focusOnPoint(p){const scale=mapScale();ui.panX=-(p.x*8-640)*scale;ui.panY=-(p.y*8-400)*scale;clampPan();}
  function locateMapEvent(index,location){
    const entry=W.notices(state,D)[index],p=entry?.locations[location];if(!p)return;
    invalidateWorld();ui.speed=0;if(battle?.phase==='active'){ui.battleMapWasRunning=autoBattle;ui.battleMapPeek=true;autoBattle=false;battleInteracting=false;}
    modal.close();guideModal.close();modalKind='';ui.eventNoticeIndex=index;ui.lastEventKey=entry.key;ui.eventFlashUntil=performance.now()+15000;
    ui.point=p.type==='field'?{x:Math.floor(p.x),y:Math.floor(p.y)}:null;if(Number.isInteger(p.baseId))ui.base=p.baseId;ui.tab='city';ui.zoom=Math.max(1.6,ui.zoom);$('#zoomLabel').textContent=Math.round(ui.zoom*100)+'%';setView('command');focusOnPoint(p);render();$('#world').scrollIntoView({behavior:'smooth',block:'center'});toast(entry.title+'：'+p.label+(state.story?.event&&!['complete','tick-complete'].includes(state.story.event.type)?'；可按「返回目前事件」接續。':''));
  }
  function render(){
    renderEventIntel();
    $('#resumeEventBtn').hidden=!state.story?.event||['complete','tick-complete'].includes(state.story.event.type);
    $('#money').textContent=money(state.money);$('#debt').textContent=money(state.debt);$('#date').textContent=state.calendar?`${state.calendar.year} 年 ${state.calendar.month} 月 ${state.calendar.day} 日 · ${String(state.hour).padStart(2,'0')}時`:`${String(state.day).padStart(3,'0')}日 · ${String(state.hour).padStart(2,'0')}:00`;
    $$('#speeds button').forEach(b=>{b.classList.toggle('selected',+b.dataset.speed===ui.speed);b.setAttribute('aria-pressed',String(+b.dataset.speed===ui.speed));});
    $('#squads').innerHTML=state.squads.map((q,i)=>{
      const hp=q.members.reduce((n,m)=>n+m.hp,0),max=q.members.reduce((n,m)=>n+m.maxHp,0);
      return `<button class="squad-card ${i===ui.selected?'active':''} ${q.order==='move'?'marching':''}" data-squad="${i}" aria-pressed="${i===ui.selected}" aria-label="第${i+1}隊 ${esc(q.leader)}" title="${esc(q.name)} · ${esc(place(q))} · ${status(q)}"><span class="portrait"><span class="sq-index squad-emblem">${H.svg(q.emblemId)}</span>${faceHTML(i,`${q.leader}頭像`,``)}<span class="sq-state">${icon(q.order==='move'?'move':q.order==='rest'?'camp':'shield')}</span></span><span class="sq-info"><strong>${esc(q.leader)}</strong><span class="unit-bars"><span class="hp-bar" title="生命 ${Math.round(hp/max*100)}%"><i style="width:${hp/max*100}%"></i></span><span class="stamina-bar" title="體力 ${Math.round(q.stamina)}%"><i style="width:${q.stamina}%"></i></span></span><small>${esc(place(q))}</small></span><span class="unit-count">${q.members.length}</span></button>`;
    }).join('');
    const q=squad(),hp=q.members.reduce((n,m)=>n+m.hp,0),max=q.members.reduce((n,m)=>n+m.maxHp,0);
    $('#selectedSquad').innerHTML=`<div class="commander"><div class="commander-portrait">${faceHTML(q.face,`部隊肖像`,``)}<span class="commander-emblem">${H.svg(q.emblemId)}</span></div><div class="commander-copy"><small>${esc(q.name)}</small><h3>${esc(q.leader)}</h3><div class="commander-meta"><span title="部隊人數">${icon('people')} ${q.members.length}/11</span><span title="部隊體力">${icon('heart')} ${Math.round(q.stamina)}%</span><b class="order-badge">${status(q)}</b></div><div class="unit-bars"><span class="hp-bar"><i style="width:${hp/max*100}%"></i></span><span class="stamina-bar"><i style="width:${q.stamina}%"></i></span></div><button class="change-emblem" data-change-emblem>${H.svg(q.emblemId)}<span>更換隊徽<small>${esc(H.get(q.emblemId).name)}</small></span></button></div></div>`;
    $$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(ui.tab===b.dataset.tab)));
    renderDesk();$('#log').innerHTML=state.log.slice(0,30).map(e=>`<div class="log-entry"><time>DAY ${String(e.day).padStart(3,'0')}</time><span>${esc(e.text)}</span></div>`).join('');
    $('#latestReport').textContent=state.log[0]?.text||'等待新的軍情…';
    window.HRUI.decorate();
  }
  function renderDesk(){
    const q=squad(),b=D.bases[ui.base],here=E.atBase(q)&&q.at===ui.base&&q.order!=='move';
    const section=(art,title,meta='')=>`<div class="visual-heading">${icon(art)}<h3>${title}</h3>${meta?`<span>${meta}</span>`:''}</div>`;
    let content='';
    if(state.mode==='native-original'&&ui.point&&ui.tab==='city'){$('#deskContent').innerHTML=pointDesk(q);window.HRUI.decorate();return;}
    if(state.mode==='native-original'&&['missions','finance'].includes(ui.tab)){$('#deskContent').innerHTML=nativeDesk()+nativeTasks(q);window.HRUI.decorate();return;}
    if(ui.tab==='city'){
      const controls=transportControls(q,b.index);
      const ci=b.countryIndexCandidate??0,c=D.countries[ci],p=E.routePlan(D,E.position(q,D),b.index,ui.travelMode??0,state),distance=p?p.cells.length-1:0;
      content=`<div class="location-panorama">${img('MAP'+String(ci+1).padStart(2,'0')+'.PXZ','',c.name+'原作地圖')}<div class="location-caption"><small>${esc(c.name)}</small><h3>${esc(b.name)}</h3></div><button class="scene-info" data-country="${ci}" aria-label="查看國家介紹" title="查看國家介紹">${icon('book')}</button><span class="scene-stamp">${here?'部隊駐留':'目的地'}</span></div>${state.mode==='native-original'?`<div class="base-condition">${icon('shield')}<span>據點耐久 <strong>${state.world.bases[b.index].raw1A}</strong></span>${state.world.bases[b.index].kind===3?'<b>要道封鎖中</b>':''}</div>`:''}${state.mode==='native-original'?townStateCard(b.index):''}<button class="town-dossier-button" data-town-guide="${b.index}">${icon('book')}<span>查看城鎮詳細情報<small>設施 · 駐軍 · 載具 · 路線</small></span>${icon('arrow')}</button><div class="facility-grid">${state.mode==='native-original'?(here&&W.baseStatus(state,D,b.index).canEnter?townActionCards()+facilityButton('vehicles','tank','載具整備'): '<p class="empty-state">'+(W.baseStatus(state,D,b.index).canEnter?'抵達並駐留後可查看設施。':'此據點目前無法直接進城採購。')+'</p>') :facilityButton('board','scroll','委託看板',!here)+facilityButton('recruit','tavern','酒館招募',!here)+facilityButton('shop','forge','武器商店',!here)+facilityButton('clinic','heal','醫院治療',!here)+facilityButton('camp','camp','紮營休息',!here)+facilityButton('finance','chest','金庫',!here)+facilityButton('vehicles','tank','載具商店',!here)}</div>${controls}${state.mode==='native-original'?worldOrders(q,b.index):`<div class="map-orders">${graphicButton('move','move',here?'駐留中':'向此處行軍',here||q.order==='move'||!distance?'disabled':'','primary')}${graphicButton('stop','stop','停止行軍',q.order!=='move'||q.moveMode===2?'disabled':'')}${state.mode==='native-original'&&!E.atBase(q)?graphicButton('enterBase','castle','進入附近據點',window.OriginalTransport.enterBaseCommand(E.transportUnit(q,D),state.world?.bases||D.original.transport.bases).ok?'':'disabled'):''}${state.mode==='native-original'&&q.order==='move'?graphicButton('retreatTravel','back','退卻'):''}${here&&[27,28].includes(q.at)?graphicButton('ferry','ferry','搭乘渡船','','primary'):''}</div>`}<details class="location-picker"><summary>${icon('map')}選擇其他據點<span>⌄</span></summary><select id="baseSelect" aria-label="選擇據點">${D.countries.map(country=>`<optgroup label="${esc(country.name)}">${D.bases.filter(x=>x.countryIndexCandidate===country.index&&baseVisible(x)).map(x=>`<option value="${x.index}" ${x.index===b.index?'selected':''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select></details><div class="travel-status">${icon(q.order==='move'?'move':'flag')}<span>${esc(q.order==='move'?'行軍目的地：'+(q.route.length?D.bases[q.route[q.route.length-1]].name:'座標 '+q.targetX+'，'+q.targetY):place(q))}</span>${q.order==='move'?`<b>${q.travel?.original?'移動 '+q.travel.steps+' 次':Math.round(q.progress*100)+'%'}</b>`:`<b>${distance?distance+' 格'+window.OriginalTransport.LABELS[ui.travelMode??0]:here?'駐留中':'目前無可行路線；地形或據點封鎖尚未解除'}</b>`}</div>`;
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
      if(ui.facility==='vehicles'){content+=section('tank','載具整備',esc(D.bases[q.at].name))+vehiclePanel(q,E.atBase(q)&&q.order!=='move');
      }else if(ui.facility==='recruit'){
        const recruits=D.classes.filter(c=>c.index>=6&&c.index<25),selected=recruits.find(c=>c.index===ui.recruit)||recruits[0];
        content+=section('tavern','酒館',q.members.length+'/11')+`<div class="recruit-gallery">${recruits.map(c=>`<button class="recruit-card ${c.index===ui.recruit?'selected':''}" data-recruit="${c.index}" aria-label="選擇${esc(className(c.index))}" title="${esc(className(c.index))} · ${money(1200+c.index*70)} G">${faceHTML(c.index,`${c.name}頭像`,``)}<strong>${esc(className(c.index))}</strong><small>${money(1200+c.index*70)} G</small></button>`).join('')}</div><div class="selection-summary">${faceHTML(selected.index,``,``)}<div><strong>${esc(className(selected.index))}</strong><small>${money(1200+selected.index*70)} G</small></div>${graphicButton('hire','people','雇用至本隊',q.order==='move'||q.members.length>=11||state.money<1200+selected.index*70?'disabled':'','primary')}</div>`;
      }else if(ui.facility==='shop'){
        const items=(D.items||[]).filter(i=>i.equipmentSlot&&i.priceCandidate>0),selected=items.find(i=>i.index===ui.item)||items[0];ui.member=Math.min(ui.member,q.members.length-1);const recipient=q.members[ui.member];
        content+=section('forge','武器與防具',esc(recipient.name))+`<label class="equipment-recipient">裝備對象<select id="equipmentMember" aria-label="裝備對象">${q.members.map((m,i)=>`<option value="${i}" ${i===ui.member?'selected':''}>${esc(m.name)}${i===0?' · 隊長':''}</option>`).join('')}</select></label><div class="selection-summary item-summary">${img('ITEM.MRG:'+selected.iconIdCandidate,'','選取裝備')}<div><strong>${esc(selected.name)}</strong><small>${money(selected.priceCandidate)} G · ${selected.equipmentSlot==='weapon'?'武器':'防具'}</small></div>${graphicButton('buy','coin','購買並裝備',q.order==='move'||!E.atBase(q)||state.money<selected.priceCandidate?'disabled':'','primary')}</div>${itemStats(selected)}<div class="equipped-summary">${['weapon','armor'].map(slot=>{const e=D.items.find(x=>x.index===recipient[slot]);return `<span>${slot==='weapon'?'武器':'防具'}：${e?esc(e.name):'未裝備'}</span>`;}).join('')}</div><div class="inventory-grid">${items.map(i=>`<button class="inventory-slot ${i.index===ui.item?'selected':''} ${recipient[i.equipmentSlot]===i.index?'equipped':''}" data-item="${i.index}" aria-label="選擇${esc(i.name)}" title="${esc(i.name)} · ${money(i.priceCandidate)} G">${img('ITEM.MRG:'+i.iconIdCandidate,'',i.name+'圖示')}<span>${money(i.priceCandidate)}</span>${recipient[i.equipmentSlot]===i.index?'<b>✓</b>':''}</button>`).join('')}</div>`;
      }else{
        const slots=Array.from({length:Math.max(11,q.members.length)},(_,i)=>{const m=state.mode==='native-original'?q.members.find((m,j)=>(m.originalSlot??j)===i):q.members[i];return m?`<button data-member-slot="${i}" class="roster-slot" title="${esc(m.name)} · HP ${m.hp}/${m.maxHp} · 基本攻擊 ${m.attack} · 武器威力 ${E.equipmentStats(D,m).power} · 基本防禦 ${m.defense} · 防具防護 ${E.equipmentStats(D,m).protection} · 武器 ${esc(D.items.find(x=>x.index===m.weapon)?.name||'未裝備')} · 防具 ${esc(D.items.find(x=>x.index===m.armor)?.name||'未裝備')}">${faceHTML(m.classId??m.face,`${m.name}肖像`,``)}${i===0?'<span class="leader-crown">♛</span>':''}<span class="member-hp">${m.hp}/${m.maxHp}</span><span class="hp-bar"><i style="width:${m.hp/m.maxHp*100}%"></i></span><small>${esc(m.name)}</small><span class="roster-gear">${icon('sword')}${E.equipmentStats(D,m).power} ${icon('shield')}${E.equipmentStats(D,m).protection}</span></button>`:`<button class="roster-slot empty-slot" data-facility="recruit" aria-label="招募新成員" title="招募新成員">${icon('people')}<span>＋</span></button>`;});
        content+=section('people','部隊編制',q.members.length+'/11')+`${state.mode==='native-original'?formationUI.render(q.id):`<div class="roster-grid">${slots.join('')}</div>`}<div class="formation">${window.OriginalCombat.originalData.formations.map((formation,i)=>{const t=formation.name.trim();return `<button data-formation="${i}" ${state.mode==='native-original'&&!E.commandAvailability(state,D,q.id).formation?'disabled':''} class="${q.formation===i?'selected':''}" aria-pressed="${q.formation===i}" title="${t}陣形" aria-label="${t}陣形"><svg viewBox="0 0 100 70" aria-hidden="true">${formation.positions.map(([x,y])=>`<circle cx="${90-x/3}" cy="${(y-145)/3}" r="3" fill="#ead399"/>`).join('')}</svg><span>${t}</span></button>`;}).join('')}</div><div class="map-orders">${graphicButton('heal','heal','醫院治療',q.order==='move'?'disabled':'')}${state.mode==='native-original'?(E.atBase(q)?graphicButton('recoverInTown','camp','駐留回復'):graphicButton('rest','camp','野外休息',E.commandAvailability(state,D,q.id).rest?'':'disabled')):graphicButton('rest','camp','休息回復',q.order==='move'?'disabled':'')}${state.mode==='native-original'?graphicButton('armory','chest','裝備與部隊倉庫',E.atBase(q)?'':'disabled')+graphicButton('transfers','people','拖曳調整隊伍',E.atBase(q)?'':'disabled'):''}</div>`;
      }
      content+='<button class="rules-link" data-action="evidence" title="原作能力、裝備與交易對照">ⓘ 原作規則與驗證</button>';
    }else{
      content=section('chest','傭兵團金庫')+`<div class="treasury-art">${icon('chest')}${icon('coin')}${icon('bag')}</div><div class="treasury-stats"><div>${icon('coin')}<span>資金</span><strong>${money(state.money)}</strong></div><div>${icon('bag')}<span>債務</span><strong>${money(state.debt)}</strong></div></div><div class="finance-progress" title="債務餘額"><i style="width:${Math.min(100,state.debt/2500000*100)}%"></i></div><div class="repayment-grid">${[10000,50000,100000].map(n=>`<button data-repay="${n}" aria-label="還款${money(n)} G" title="還款 ${money(n)} G" ${state.money<Math.min(n,state.debt)||!state.debt?'disabled':''}>${icon('bag')}<strong>${money(n)}</strong><span>還款</span></button>`).join('')}</div><button class="graphic-action all-repay" data-repay="${Math.min(state.money,state.debt)}" ${!state.money||!state.debt?'disabled':''}>${icon('chest')}<span>可用資金全數還款</span></button><div class="achievement-row"><span title="完成委託">${icon('scroll')} ${state.completed.length}</span><span title="聲望">${icon('flag')} ${state.rep}</span></div><button class="rules-link" data-action="evidence">ⓘ 經濟數值仍採重製暫定規則</button>${state.ended?'<h3 class="gold">債務已清償！</h3>':''}`;
    }
    $('#deskContent').innerHTML=content;
    if(state.mode==='native-original')$('#deskContent').insertAdjacentHTML('beforeend',nativeTasks(q));
    window.HRUI.decorate();
  }
  function setView(view){ui.view=view;$('#commandView').hidden=view!=='command';$('#atlasView').hidden=view!=='atlas';$('#archiveView').hidden=view!=='archive';$('#unitDeck').hidden=view!=='command';$('#worldEventArea').hidden=view!=='command'||!W.notices(state,D).length;$$('.main-nav button').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));if(view==='atlas')renderAtlas();if(view==='archive')renderArchive();}
  function renderAtlas(){
    $('#atlas').innerHTML=D.countries.map(c=>`<button class="atlas-card" data-country="${c.index}">${img('MAP'+String(c.index+1).padStart(2,'0')+'.PXZ','',c.name+'地圖')}<div class="atlas-copy"><span class="eyebrow">NATION ${String(c.index+1).padStart(2,'0')} · ${(c.baseIndicesCandidate||[]).length} LOCATIONS</span><h3>${esc(c.name)}</h3><p>${esc(c.text.replace(c.name,'').trim()).slice(0,100)}…</p></div></button>`).join('');
  }
  function renderArchive(){
    $$('#archiveTabs button').forEach(b=>b.classList.toggle('selected',b.dataset.archive===ui.archive));
    const query=ui.query.toLowerCase();let rows=[],html='';
    if(ui.archive==='characters')rows=D.classes.filter(c=>!c.reserved&&c.index!==78&&className(c.index).toLowerCase().includes(query));
    if(ui.archive==='items')rows=(D.items||[]).filter(c=>c.name.toLowerCase().includes(query));
    if(ui.archive==='art')rows=D.assets.filter(a=>a.theme===prefs.theme&&(a.id+' '+a.kind).toLowerCase().includes(query));
    if(ui.archive==='text')rows=[...D.strings,...Object.values(D.textArchives).flat()].filter(s=>(s.id+' '+s.text).toLowerCase().includes(query));
    if(ui.archive==='text')html=rows.slice(0,ui.limit).map(s=>`<div class="text-row"><code>${esc(s.id)}<br>file ${hex(s.offset)}</code><span>${esc(s.text)}</span></div>`).join('');
    else html=`<div class="archive-grid">${rows.slice(0,ui.limit).map(r=>{
      if(ui.archive==='characters')return `<button class="archive-card" data-class="${r.index}">${faceHTML(r.index,`索引 ${r.index} 的頭像`,``)}<h3>${esc(className(r.index))}</h3><small>INDEX ${r.index} · ${hex(r.offset)}</small></button>`;
      if(ui.archive==='items')return `<button class="archive-card" data-inspect-item="${r.index}">${img('ITEM.MRG:'+r.iconIdCandidate,'',r.name+'圖示')}<h3>${esc(r.name)}</h3><small>${money(r.priceCandidate)} G（原作基準價）<br>${hex(r.offset)}</small></button>`;
      return `<button class="archive-card art-card" data-art="${esc(r.id)}"><img src="${esc(r.url)}" alt="${esc(r.id)}" loading="lazy"><h3>${esc(r.id)}</h3><small>${r.w} × ${r.h} · ${esc(r.kind)}</small></button>`;
    }).join('')}</div>`;
    $('#archiveResults').innerHTML=`<p class="count-label">共 ${rows.length} 項 · 已顯示 ${Math.min(ui.limit,rows.length)} 項${ui.archive==='characters'?' · 原作分類索引':''}</p>${html||'<div class="empty">沒有符合的資料</div>'}${rows.length>ui.limit?'<button class="load-more" id="loadMore">再顯示 48 項 ↓</button>':''}`;
  }
  const modal=$('#modal');
  const formationUI=window.HRFormationUI.create({data:D,esc,icon,portrait,faceHTML,rekey:C.rekey,state:()=>state,save:()=>save(true),render,inspect:showMember,toast,pause:()=>{ui.speed=0;invalidateWorld();$$('#speeds button').forEach(b=>{const active=+b.dataset.speed===0;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}});
  const armoryUI=window.HRArmoryUI.create({data:D,engine:E,esc,icon,img,portrait,faceHTML,rekey:C.rekey,itemStats,state:()=>state,selected:()=>ui.selected,open:openModal,toast,save:()=>save(true),renderMain:render,invalidate:invalidateWorld,resumeStory:continueStory});
  function openModal(html,kind='info'){invalidateWorld();ui.speed=0;modalKind=kind;modal.dataset.kind=kind;$('#modalContent').innerHTML=html;if(!modal.open)modal.showModal();render();}
  function exitBattle(){
    const finished=battle;if(!finished||finished.phase==='active')return;
    ui.selected=finished.squad;ui.point=null;ui.base=state.squads[finished.squad].at;
    battle=null;ui.battleError='';ui.battleInspect=null;ui.battleClosePrompt=false;ui.battleReturnAfterRetreat=false;modal.close();modalKind='';armoryUI.clear();
    if(finished.original&&state.story?.event?.type==='battle')continueStory({value:finished.core.outcome,unitBytes:Array.from(finished.core.unitBytes),encounterBytes:Array.from(finished.core.encounterBytes),randomSeed:state.seed});else render();
  }
  function requestRetreat(returnAfter=false){try{E.finishBattle(state,battle,false);ui.battleClosePrompt=false;ui.battleReturnAfterRetreat=returnAfter;ui.battleError='';autoBattle=true;save(true);renderBattle();}catch(error){ui.battleError=error.message;autoBattle=false;renderBattle();}}
  const battleActions=new Set(['battlePause','battleStep','retreat','withdrawMember','confirmBattleRetreat','cancelBattleClose','battleClose']);
  // Handle controls inside the dialog, before unrelated document click handlers.
  modal.addEventListener('click',event=>{
    const button=event.composedPath().find(node=>node instanceof HTMLButtonElement);
    if(modalKind!=='battle'||!button)return;
    if(button.dataset.battleInspect!==undefined){event.preventDefault();event.stopPropagation();ui.battleInspect={side:button.dataset.battleSide,index:+button.dataset.battleInspect};battleInteracting=false;renderBattle();return;}
    if(!battleActions.has(button.dataset.action))return;
    event.preventDefault();event.stopPropagation();invalidateWorld();battleInteracting=false;
    try{switch(button.dataset.action){
      case 'battlePause':autoBattle=!autoBattle;break;
      case 'battleStep':autoBattle=false;E.battleStep(state,battle);save(true);render();break;
      case 'retreat':requestRetreat();return;
      case 'confirmBattleRetreat':requestRetreat(true);return;
      case 'cancelBattleClose':ui.battleClosePrompt=false;autoBattle=ui.battleResumeAfterClose??true;break;
      case 'withdrawMember':{const result=E.battleCommand(state,battle,{type:'withdraw-member',index:ui.battleInspect.index});if(!result?.accepted)throw Error('此成員目前無法個別撤退');save(true);break;}
      case 'battleClose':exitBattle();return;
    }ui.battleError='';}catch(error){autoBattle=false;ui.battleError=error.message;}
    renderBattle();
  },true);
  function closeModal(){
    if(loadError){showLoadRecovery();return;}
    if(battle?.phase==='active'){if(!ui.battleClosePrompt)ui.battleResumeAfterClose=autoBattle;ui.battleClosePrompt=true;autoBattle=false;renderBattle();return;}
    if(modalKind==='battle'&&battle){exitBattle();return;}
    if(modalKind==='story'&&state.story?.event&&!['complete','tick-complete'].includes(state.story.event.type)){
      if(['text','ending','quit'].includes(state.story.event.type)){continueStory();return;}
      if(!['fault','unresolved'].includes(state.story.event.type)){const warning=document.createElement('p');warning.className='event-warning';warning.textContent='請選擇下方的行動或返回按鈕，以完成目前事件。';document.querySelector('.event-warning')?.remove();$('#modalContent').append(warning);return;}
    }
    modal.close();modalKind='';battle=null;armoryUI.clear();
  }
  function showWelcome(){openModal(`<div class="game-splash">${img('GMAP.PXS','splash-map','原作大陸全圖')}<div class="splash-copy"><span class="eyebrow">HIGH REWARD · WEB 0.8</span><h2>傭兵團，再次出發。</h2><div class="splash-portraits">${[0,1,2,3,4,5].map(i=>`${faceHTML(i,`傭兵團隊長`,``)}`).join('')}</div><p>六支部隊、十一個國家。從薩蘭特城出發，履行委託、整備部隊，償清家族債務。</p><div class="modal-actions">${graphicButton('welcomeStart','sword','開始征戰','','primary')}${graphicButton('welcomeAtlas','map','探索世界')}</div><small>原作規則與劇情 · 現代瀏覽器介面</small></div></div>`,'welcome');}
  function showEvidence(){openModal(`<span class="eyebrow">RESTORATION NOTES · 0.8</span><h2>原作還原與驗證</h2><p>0.6 新增圖像拖曳編制、部隊倉庫採購／配裝、放大城鎮標記與 Shift＋G 密技。倉庫與密技是本重製版的擴充操作；0.5 原作戰役進度會自動接續。</p><p>原作主程式與 138 個程式區塊轉為受限的 JavaScript 執行模型，保留世界時鐘、六隊狀態、事件旗標、劇情與交易流程。戰鬥以獨立的原作規則移植呈現。</p><h3>戰鬥與世界</h3><p>原作能力成長、命中、傷害、射速、16 種陣形、個別與全隊撤退、勝敗結算；世界攻城、守軍、載具故障、交通資格、128×96 地形及自由座標行軍。</p><h3>劇情與設施</h3><p>民事、軍事、公演、建築、銀行與主線事件由原作程式控制；裝備、招募及載具交易使用原作商店流程，償債後接入六隊結局、總帳與製作名單。</p><h3>對照證據</h3><p>603 個世界循環逐一比對全部 31,848 個戰役位元組、亂數與遭遇資料；99 處據點的 337 個入口、2,398 個分支節點通過操作檢查。戰鬥、交通、交易與任務另有原程式差異測試。</p><h3>瀏覽器呈現</h3><p>${redraw.reviewed}/${redraw.total} 項基礎素材完成重繪；另有 ${C.records.length} 套角色新圖，每套含肖像、準備、射擊及受擊畫面。戰鬥人物寬高縮至原版面的 70%，原作戰鬥能力與規則維持不變。對話、行軍、戰鬥及片尾採新版畫面與操作節奏；27 首原作 MIDI 使用瀏覽器合成音色。Web JSON 與 DOS 存檔格式分開。測試覆蓋列出的案例，並不代表所有可能的長期遊玩組合都已窮舉。</p><div class="modal-actions"><button data-action="help">操作說明</button></div>`,'evidence');}
  function showHelp(){openModal(`<span class="eyebrow">FIELD MANUAL</span><h2>指揮官手冊</h2><div class="help-grid"><div>${icon('people')}<h3>六支部隊</h3><p>點選下方部隊或按 1–6 切換。整備頁可查看每名成員能力、裝備、陣形與同城移交。</p></div><div>${icon('forge')}<h3>原作商店</h3><p>在駐留城鎮選擇商店或酒店。裝備先購買到部隊倉庫，再拖到成員身上；舊裝備自動回倉庫。也可先點物品，再點成員。載具商店提供原作換購、出售與劇情限制。</p></div><div>${icon('scroll')}<h3>委託與主線</h3><p>民事與軍事看板保留原作條件及對話。接任後的目的地、期限與進度會顯示在部隊與委託頁；點目的地可定位並閃爍該城鎮 10 秒。</p></div><div>${icon('move')}<h3>自由行軍</h3><p>點選據點或地圖空白處，選步行、車輛或飛機後出發。偵察、占領、攻擊設定與退卻依原作資格開放。空白鍵暫停。</p></div><div>${icon('sword')}<h3>遭遇戰</h3><p>可暫停、逐步推進、查看能力、個別撤退或全隊撤退。戰鬥結束後返回原作事件，勝敗與傷亡持續保存。</p></div><div>${icon('chest')}<h3>存檔與還款</h3><p>金庫可拜訪銀行。進度自動保存在此瀏覽器；設定中可匯出、匯入 JSON。舊版試作存檔保留為獨立備份。</p></div></div><p class="small muted">時間暫停時可安心下達命令；城鎮休養需要推進時間。原作每月 28 日。音樂需先點上方音符啟用。Shift＋G 每次增加 50,000 G；長按不會連續觸發。</p>`,'help');}
  function showSettings(){
    const themes=window.HR_RELEASE?.online?['redrawn']:['redrawn','hd','hd-ai'];
    const names={redrawn:`高清重繪 · ${redraw.reviewed}/${redraw.total}`,hd:'原作 HD','hd-ai':'套件 AI 風格'};
    openModal(`<span class="eyebrow">SYSTEM</span><h2>設定與存檔</h2><div class="cheat-tip">${icon('coin')}密技補給：<kbd>Shift</kbd> ＋ <kbd>G</kbd>，每次增加 50,000 G。</div><div class="settings-row"><span>美術風格</span><select id="themeSelect">${themes.map(t=>`<option value="${t}" ${prefs.theme===t?'selected':''}>${names[t]}</option>`).join('')}</select></div><p class="small muted">${redraw.complete?'595項基礎素材已完成重繪驗收；另有 84 套角色肖像與動作圖。':`已驗收 ${redraw.reviewed}/${redraw.total} 項，其餘暫用原作素材；未完成項目不計為重繪。`}</p><div class="settings-row"><span>本機存檔</span><button data-action="save">儲存目前進度</button></div><div class="settings-row"><span>備份進度</span><button data-action="export">匯出 JSON</button></div>${legacyBackup()?'<div class="settings-row"><span>舊版試作進度</span><button data-action="exportLegacy">下載舊版備份</button></div>':''}<div class="settings-row"><span>恢復備份</span><button data-action="import">匯入 JSON</button></div><div class="settings-row"><span>原作戰役</span><button data-action="resetConfirm">重新開始</button></div><p class="small">${saveUnavailable?'此瀏覽器無法使用本機儲存，請使用匯出備份。':'進度只保存在目前瀏覽器，跨裝置請匯出JSON備份。'}</p><div class="modal-actions"><button data-action="evidence">還原進度</button><button data-action="help">操作說明</button></div>`,'settings');
  }
  function showCountry(i){const c=D.countries[i];openModal(`<span class="eyebrow">NATION ${i+1} / ORIGINAL ATLAS</span><h2>${esc(c.name)}</h2>${img('MAP'+String(i+1).padStart(2,'0')+'.PXZ','country-detail-img',c.name+'原作地圖')}<p>${esc(c.text)}</p><div class="base-tags">${D.bases.filter(b=>b.countryIndexCandidate===i&&baseVisible(b)).map(b=>`<button data-jumpbase="${b.index}">${esc(b.name)}</button>`).join('')}</div><p class="source">original/COUNTRY.MES · file ${hex(c.offset)} · CP950</p>`,'country');}
  function characterPoses(i){return C.get(i)?`<h3>動作預覽</h3><div class="character-poses">${[['ready','準備'],['firing','射擊'],['hit','受擊']].map(([key,label])=>`<div class="character-pose-card">${C.image(i,key,className(i)+' '+label)}<span>${label}</span></div>`).join('')}</div>`:'';}
  function inspectClass(i){const c=D.classes.find(c=>c.index===i);if(!c)return;openModal(`<div class="modal-hero">${faceHTML(i,`索引 ${i} 頭像`,``)}<div><span class="eyebrow">CHARACTER / TYPE ${i}</span><h2>${esc(className(c.index))}</h2><p>人物及兵種資料取自原作。下列數值依序為生命、攻擊、防禦、三項上限、武器／交通技能及三項技能上限；實際能力依原作等級公式計算。</p><p class="source">original/MAIN.EXE · ${hex(c.offset)}<br>${esc(c.ida)} · record ${c.recordSize} bytes</p><h3>原始 16-bit 數值</h3><p>${c.u16FieldsAt22.map(n=>esc(n)).join(' · ')}</p></div></div>${characterPoses(i)}`,'class');}

  const guideModal=$('#guideModal');
  const infoButton=id=>`<button class="item-info-button" data-guide-item="${id}" aria-label="查看${esc(D.items[id]?.name||'道具')}說明">${icon('book')}<span>用途說明</span></button>`;
  function openGuide(html){invalidateWorld();$('#guideContent').innerHTML=html;if(!guideModal.open)guideModal.showModal();}
  function inspectItem(id){const g=G.item(D,id);if(!g)return;const type=D.items[id].categoryCandidate,skill=type===10?0:type===11?2:1,bonus=g.bonus||0,users=id>=52&&id<62?state.squads.flatMap(q=>q.members.filter(m=>(m.skills?.[skill]||0)>0&&window.HRArmory.compatible(D,id,m)).map(m=>q.name+' · '+m.name+'（基本 '+m.skills[skill]+' → '+(m.skills[skill]+bonus)+'）')):[];openGuide(`<span class="eyebrow">FIELD GUIDE · ${esc(g.category)}</span><div class="guide-hero">${img('ITEM.MRG:'+D.items[id].iconIdCandidate,'',g.name)}<div><h2>${esc(g.name)}</h2><p>${esc(g.summary)}</p><div class="guide-tags"><span>原價 ${money(g.price)} G</span><span>半價出售 ${money(g.resale)} G</span></div></div></div><div class="guide-stats">${g.stats.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div><section class="guide-section"><h3>效果與條件</h3><p>${esc(g.effect)}</p></section><section class="guide-section"><h3>如何使用</h3><p>${esc(g.use)}</p></section>${id>=52&&id<62?`<section class="guide-section"><h3>目前可獲加成的成員</h3>${users.length?`<div class="guide-tags">${users.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:'<p>本團目前沒有具備對應能力且可配備的成員。</p>'}</section>`:''}${g.compatible.length?`<details class="guide-section"><summary>可配備角色／兵種（${g.compatible.length}）</summary><div class="guide-tags">${g.compatible.map(c=>`<span>${esc(className(c.id))}</span>`).join('')}</div></details>`:''}${g.notes.length?`<section class="guide-section"><h3>使用提醒</h3>${g.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</section>`:''}<p class="source">${esc(g.source)} · 物品 #${id}。說明不改變原作效果。</p>`);}
  function showTown(id){state.selectedSquad=ui.selected;const t=G.town(state,D,id,E);if(!t)return;openGuide(`<span class="eyebrow">TOWN DOSSIER · ${esc(t.country)}</span><h2>${esc(t.name)}</h2>${townStateCard(id)}<div class="town-guide-panorama">${img('MAP'+String(D.bases[id].countryIndexCandidate+1).padStart(2,'0')+'.PXZ','',t.country)}</div><div class="guide-stats"><div><span>所在地</span><strong>${esc(t.country)}</strong></div><div><span>地圖座標</span><strong>${t.x}, ${t.y}</strong></div><div><span>據點耐久</span><strong>${t.durability} / ${t.maxDurability}</strong></div><div><span>通行狀態</span><strong>${esc(t.status.label)}</strong></div></div><section class="guide-section"><h3>駐留部隊</h3>${t.stationed.length?t.stationed.map(q=>`<button class="town-company" data-guide-squad="${q.id}">${H.svg(state.squads[q.id].emblemId)}<span>${esc(q.name)} · ${q.members} 人</span>${icon('arrow')}</button>`).join(''):'<p>目前沒有我方部隊駐留。</p>'}</section><section class="guide-section"><h3>設施與服務</h3>${t.visited?`<div class="guide-tags">${t.services.map(n=>`<span>${esc(n)}</span>`).join('')||'<span>無可用服務</span>'}</div>`:'<p>部隊抵達並駐留後，才能確認當下開放的原作服務。</p>'}<details><summary>原檔登錄的商家與場所</summary><div class="guide-tags">${t.shops.map(n=>`<span>${esc(n)}</span>`).join('')}</div><p>此名錄不代表所有店家目前開放，實際服務依城鎮事件與劇情判定。</p></details></section><section class="guide-section"><h3>載具／火砲交易</h3>${t.vehicles.length?t.vehicles.map(v=>`<div class="town-vehicle"><div><small>${esc(v.shop)}</small><strong>${esc(v.name)}</strong><span>原價 ${money(v.price)} G</span></div>${infoButton(v.itemId)}</div>`).join(''):'<p>原作載具商店表未在此處登錄商品。</p>'}</section><section class="guide-section"><h3>由目前小隊位置規劃路線</h3><div class="guide-tags">${t.routes.map(r=>`<span>${window.OriginalTransport.LABELS[r.mode]}：${r.cells===null?'無地形路線':r.cells+' 格'}</span>`).join('')}</div><p>上方為地形路線預覽；是否能下令，仍須符合載具、起降、國界與劇情條件。${t.flightRestricted?'此據點另有原作飛行限制。':''}${[27,28].includes(id)?'此處可使用原作渡船流程。':''}</p></section><button class="primary" data-guide-target="${id}">${icon('map')}在地圖上查看</button>`);}
  function showEmblems(){const q=squad();openGuide(`<span class="eyebrow">COMPANY HERALDRY · 20 DESIGNS</span><h2>更換隊徽</h2><p>${esc(q.name)} · 目前為「${esc(H.get(q.emblemId).name)}」。隊徽是外觀設計，不改變能力，可隨存檔匯出。</p><div class="emblem-grid">${H.designs.map(d=>`<button data-emblem="${d.id}" aria-label="選擇${d.name}隊徽" aria-pressed="${q.emblemId===d.id}">${H.svg(d.id)}<strong>${d.name}</strong><small>${d.meaning}</small></button>`).join('')}</div>`);}
  $('#closeGuide').addEventListener('click',()=>guideModal.close());
  // Guide controls use a separate dialog, preserving an open shop/armory and its selection.
  document.addEventListener('click',event=>{const b=event.target.closest('[data-guide-item],[data-town-guide],[data-change-emblem],[data-emblem],[data-guide-target],[data-guide-squad]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();
    if(b.dataset.guideItem!==undefined){inspectItem(+b.dataset.guideItem);return;}
    if(b.dataset.townGuide!==undefined){showTown(+b.dataset.townGuide);return;}
    if(b.hasAttribute('data-change-emblem')){showEmblems();return;}
    if(b.dataset.emblem){invalidateWorld();H.set(squad(),b.dataset.emblem);save(true);render();showEmblems();toast('隊徽已更新並儲存');return;}
    guideModal.close();if(b.dataset.guideSquad!==undefined){ui.selected=+b.dataset.guideSquad;state.selectedSquad=ui.selected;ui.base=squad().at;}else ui.base=+b.dataset.guideTarget;ui.point=null;ui.tab='city';state.viewCountry=D.bases[ui.base].countryIndexCandidate;setView('command');focusOnBase(ui.base);render();
  },true);


  function showArt(id){const a=asset(id);if(!a)return;openModal(`<span class="eyebrow">ORIGINAL ASSET</span><h2>${esc(id)}</h2><img src="${esc(a.url)}" class="country-detail-img" alt="${esc(id)}"><p class="source">${esc(a.url)}<br>catalog ${a.w} × ${a.h} · ${esc(a.kind)} · ${esc(a.pal)} palette<br>PNG SHA-256: ${esc(a.fileSha256)}</p>`,'art');}
  function original(){if(window.HR_RELEASE?.online){toast('原版DOS對照僅於本機提供。');return;}if(location.protocol==='file:'){toast('請先執行「啟動網頁版.bat」，原版模擬器需要本機 HTTP 伺服器。');return;}window.open('/original/','_blank','noopener');}
  function startBattle(){try{battle=E.beginBattle(state,D,ui.selected);battleElapsed=0;autoBattle=true;openModal('','battle');renderBattle();}catch(e){toast(e.message);}}
  function renderBattle(){if(!battle)return;const b=battle;
    const team=(members,side)=>`<div class="battle-team ${side}">${members.map((m,i)=>`<div class="battle-unit ${m.hp?'':'dead'}">${sprite('BC32.MRG:'+(side==='allies'?i%4*3:9),m.name)}<div class="mini-bar"><i style="width:${m.hp/Math.max(1,m.maxHp)*100}%"></i></div><small>${m.hp}/${m.maxHp}</small></div>`).join('')}</div>`;
    let controls=b.phase==='active'
      ? graphicButton('battlePause',autoBattle?'pause':'play',autoBattle?'暫停戰鬥':'繼續戰鬥')+graphicButton('battleStep','arrow','單步推進')+graphicButton('retreat','back','撤退')
      : graphicButton('battleClose','castle',b.phase==='lost'?'撤回安全據點':'返回本部','','primary');
    if(b.original&&ui.battleInspect){const selected=ui.battleInspect,actor=b.core[selected.side]?.[selected.index];if(selected.side==='friendly'&&b.phase==='active'&&actor?.hp>0&&actor.state<28)controls+=graphicButton('withdrawMember','back','個別撤退');}
    if(ui.battleClosePrompt&&b.phase==='active')controls=`<div class="battle-close-prompt"><strong>戰鬥尚未結束，要下令撤退並返回事件嗎？</strong><small>撤退依原作規則結算，不會直接略過戰鬥。</small><div>${graphicButton('confirmBattleRetreat','back','撤退並返回','','primary')}${graphicButton('cancelBattleClose','sword','留在戰鬥')}</div></div>`;
    if(!$('#battleDisplay'))$('#modalContent').innerHTML='<div id="battleEventLocation"></div><div id="battleDisplay"></div><div id="battleInspector"></div><details class="battle-details"><summary>戰鬥紀錄</summary><div id="battleLog" class="battle-log"></div></details><div id="battleControls" class="battle-controls"><p id="battleStatus" role="status"></p><div id="battleButtons" class="battle-buttons"></div></div><p id="battleRule" class="battle-rule"></p>';
    const mapHTML=eventLocationHTML();if($('#battleEventLocation').innerHTML!==mapHTML)$('#battleEventLocation').innerHTML=mapHTML;
    if(b.original){
      if(!$('#nativeBattleActors'))$('#battleDisplay').innerHTML=`<span class="eyebrow">HIGH REWARD · BATTLE</span><h2 class="battle-company-title"></h2><div class="battle-scene original-scene battle-v2 battle-v3"><img class="battle-landscape" src="${window.HRBattleArt.background}" alt="重繪原野戰場"><span class="battle-side-label friendly">我方部隊</span><span class="battle-side-label enemy">敵方部隊</span><span class="battle-title"></span><span class="battle-turn"></span><div id="nativeBattleActors" class="native-actor-layer"></div><div id="nativeBattleEffects" class="native-effect-layer"></div></div><div id="nativeBattleResults"></div>`;
      const stage=$('#battleDisplay .battle-scene'),list=[],effects=[];
      stage.classList.toggle('is-active',b.phase==='active');$('#battleDisplay .battle-company-title').textContent=state.squads[b.squad].name;
      stage.querySelector('.battle-title').textContent=b.phase==='active'?'ENGAGED':b.phase==='won'?'VICTORY':'WITHDRAWAL';stage.querySelector('.battle-turn').textContent='TURN '+String(b.turn).padStart(2,'0');
      for(const [members,side]of [[b.allies,'friendly'],[b.enemies,'enemy']])members.forEach((m,index)=>{
        if(m.classId===-1)return;const position=window.HRBattleArt.layout(m);if(position.hidden)return;
        const layers=window.OriginalCombat.battleSpriteLayers(m,side,b.core.effects,window.OriginalCombat.originalData.classes),name=(side==='friendly'?state.squads[b.squad].members.find(a=>(a.originalSlot??0)===m.slot)?.name:null)||className(m.classId)||m.name;
        list.push({id:m.classId,index,side,name,position,pose:C.pose(m),visible:layers.some(l=>l.archive.toLowerCase()==='bc32.mrg'),hp:m.hp,maxHp:m.maxHp});
        for(const l of layers.filter(l=>l.archive.toLowerCase()!=='bc32.mrg'))effects.push(`<span class="original-battle-layer" style="left:${l.x/640*100}%;top:${l.y/400*100}%">${sprite(l.archive.toUpperCase()+':'+l.index,'戰鬥效果')}</span>`);
      });
      C.updateActors($('#nativeBattleActors'),list);$('#nativeBattleEffects').innerHTML=effects.join('');
      const result=$('#nativeBattleResults');if(result.dataset.phase!==b.phase){result.dataset.phase=b.phase;result.innerHTML=b.phase==='active'?'':`<div class="battle-result">${b.phase==='won'?'VICTORY':'RETREAT'}</div><p style="text-align:center">${b.phase==='won'?`${icon('coin')} ${money(b.reward)} G`:'戰鬥已結束，完成後續事件即可撤回安全據點。'}</p>`;}
    }else{
    $('#battleDisplay').innerHTML=`<span class="eyebrow">HIGH REWARD · BATTLE</span><h2>${esc(state.squads[b.squad].name)}</h2><div class="battle-scene ${b.original?'original-scene battle-v2':''} ${b.phase==='active'?'is-active':''}"><img class="battle-landscape" src="${window.HRBattleArt.background}" alt="重繪原野戰場"><span class="battle-side-label friendly">我方部隊</span><span class="battle-side-label enemy">敵方部隊</span><span class="battle-title">${esc(b.phase==='active'?'ENGAGED':b.phase==='won'?'VICTORY':'WITHDRAWAL')}</span><span class="battle-turn">TURN ${String(b.turn).padStart(2,'0')}</span>${team(b.allies,'allies')}${team(b.enemies,'enemies')}</div>${b.phase==='active'?'':`<div class="battle-result">${b.phase==='won'?'VICTORY':'RETREAT'}</div><p style="text-align:center">${b.phase==='won'?`${icon('coin')} ${money(b.reward)} G`:'戰鬥已結束，完成後續事件即可撤回安全據點。'}</p>`}`;
    }
    $('#battleInspector').innerHTML='<p class="battle-visual-note">點選角色查看能力 · 立繪為外觀，實際武器依能力欄</p>'+(b.original&&ui.battleInspect?battleInspection(b):'')+(ui.battleError?`<p class="event-warning">戰鬥已暫停：${esc(ui.battleError)}。可先備份存檔，再重新整理。</p>`:'');
    $('#battleLog').innerHTML=b.log.slice(0,8).map(l=>`<div>${esc(l)}</div>`).join('');
    if($('#battleButtons').dataset.content!==controls){$('#battleButtons').innerHTML=controls;$('#battleButtons').dataset.content=controls;}
    const retreating=b.original&&(b.core.leaderDown||b.core.friendly.some(a=>a.classId>=0&&a.classId<=5&&a.state>=28));
    const statusText=ui.battleError?'已暫停：'+ui.battleError:b.phase!=='active'?(b.phase==='lost'?'戰鬥結束，請撤回安全據點。':'戰鬥結束，請接續事件。'):ui.battleClosePrompt?'請選擇撤退或留在戰鬥。':!autoBattle?'已暫停；按繼續戰鬥，或單步推進一回合。':retreating?'撤退中，正在等待部隊退場。':'戰鬥進行中';if($('#battleStatus').textContent!==statusText)$('#battleStatus').textContent=statusText;
    $('#battleRule').textContent=b.original?'原作命中、射速、傷害、陣形與退場規則':'戰鬥試作 · 暫定規則';
  }
  function battleInspection(b){const selected=ui.battleInspect,a=b.core[selected.side]?.[selected.index];if(!a||a.classId===-1)return '';return `<div class="battle-inspection"><strong>${esc((selected.side==='friendly'?state.squads[b.squad].members.find(m=>m.originalSlot===a.slot)?.name:null)||className(a.classId)||b.names[selected.side][selected.index])}</strong><span>生命 ${a.hp}/${a.maxHp} · 等級 ${a.level} · 攻擊 ${a.attack} · 防禦 ${a.defense}</span><span>武器威力 ${a.power} · 防護 ${a.armor} · 射速 ${a.rate} · 累積 ${a.counter}</span></div>`;}
  document.addEventListener('pointerdown',event=>{if(modalKind==='battle'&&event.target.closest('button'))battleInteracting=true;},true);
  for(const name of ['pointerup','pointercancel'])document.addEventListener(name,()=>{battleInteracting=false;},true);
  window.addEventListener('blur',()=>{battleInteracting=false;});
  // All dynamic strings from binary data or imported saves are escaped before insertion.
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.mapLocation!==undefined){locateMapEvent(+b.dataset.mapNotice,+b.dataset.mapLocation);return;}
    if(b.dataset.view){setView(b.dataset.view);return;}
    if(b.dataset.speed!==undefined){invalidateWorld();ui.worldResumeSpeed=0;ui.speed=+b.dataset.speed;render();return;}
    if(b.dataset.squad!==undefined){ui.point=null;ui.selected=+b.dataset.squad;state.selectedSquad=ui.selected;ui.base=squad().at;state.viewCountry=D.bases[ui.base].countryIndexCandidate;focusOnBase(ui.base);render();return;}
    if(b.dataset.tab){ui.tab=b.dataset.tab;ui.facility='roster';render();return;}
    invalidateWorld();
    if(b.dataset.facility){
      const f=b.dataset.facility;
      if(state.mode==='native-original'&&['shop','recruit','clinic'].includes(f)){const ids={shop:64,recruit:67,clinic:68},action=sourceTownActions().find(a=>a.id===ids[f]);if(action)beginStory(action.activateTask);else toast('此處沒有該原作設施');return;}
      if(f==='clinic'){if(act({type:'heal'}))toast('部隊已完成治療');return;}
      if(f==='camp'){act({type:'rest'});return;}
      if(f==='board')ui.tab='missions';else if(f==='finance')ui.tab='finance';else{ui.tab='troops';ui.facility=f;}
      render();return;
    }
    if(b.dataset.recruit!==undefined){ui.recruit=+b.dataset.recruit;renderDesk();return;}
    if(b.dataset.item!==undefined){ui.item=+b.dataset.item;renderDesk();return;}
    if(b.dataset.missionTarget!==undefined){focusMission(+b.dataset.missionTarget);return;}
    if(b.dataset.travelMode!==undefined){ui.travelMode=+b.dataset.travelMode;renderDesk();return;}
    if(b.dataset.vehicleBuy!==undefined){act({type:'vehicleBuy',slot:+b.dataset.vehicleBuy});return;}
    if(b.dataset.vehicleSell!==undefined){act({type:'vehicleSell',slot:+b.dataset.vehicleSell});return;}
    if(b.dataset.originalTown!==undefined){const a=sourceTownActions()[+b.dataset.originalTown];if(a)beginStory(a.activateTask);return;}
    if(b.dataset.storyValue!==undefined){continueStory({value:+b.dataset.storyValue,replaceConfirmed:b.dataset.storyReplace==='true'});return;}
    if(b.dataset.transferKind){if(act({type:'transfer',kind:b.dataset.transferKind,target:ui.transferTarget,fromSlot:ui.transferFromSlot,toSlot:ui.transferToSlot})){showTransfers();toast('移交完成');}return;}
    if(b.dataset.battleInspect!==undefined){ui.battleInspect={side:b.dataset.battleSide,index:+b.dataset.battleInspect};renderBattle();return;}
    if(b.dataset.country!==undefined){showCountry(+b.dataset.country);return;}
    if(b.dataset.class!==undefined){inspectClass(+b.dataset.class);return;}
    if(b.dataset.inspectItem!==undefined){inspectItem(+b.dataset.inspectItem);return;}
    if(b.dataset.art){showArt(b.dataset.art);return;}
    if(b.dataset.archive){ui.archive=b.dataset.archive;ui.limit=48;renderArchive();return;}
    if(b.dataset.accept){act({type:'accept',id:b.dataset.accept});return;}
    if(b.dataset.memberSlot!==undefined){showMember(+b.dataset.memberSlot);return;}
    if(b.dataset.formation!==undefined){act({type:'formation',value:+b.dataset.formation});return;}
    if(b.dataset.repay){act({type:'repay',amount:+b.dataset.repay});return;}
    if(b.dataset.jumpbase!==undefined){ui.point=null;ui.base=+b.dataset.jumpbase;state.viewCountry=D.bases[ui.base].countryIndexCandidate;ui.tab='city';closeModal();setView('command');render();return;}
    switch(b.dataset.action){
      case 'resumeEvent':if(ui.battleMapPeek){autoBattle=ui.battleMapWasRunning??true;ui.battleMapPeek=false;battleElapsed=0;}renderStory();break;
      case 'move':if(act({type:'move',to:ui.base,mode:ui.travelMode??0})){ui.speed=1;render();toast('已開始移動，時間自動播放。');}break;
      case 'ferry':if(act({type:'ferry'})){ui.base=squad().at;focusOnBase(ui.base);render();}break;
      case 'rest':act({type:'rest'});break;
      case 'enterBase':if(act({type:'enterBase'})){ui.base=squad().at;render();}break;
      case 'moveToPoint':if(ui.point&&act({type:'moveToPoint',x:ui.point.x,y:ui.point.y,mode:ui.travelMode??0})){ui.speed=1;render();}break;
      case 'scoutBase':if(act({type:'scoutBase',to:ui.base,mode:ui.travelMode??0})){ui.speed=1;render();}break;
      case 'occupy':act({type:'occupy'});break;
      case 'attackSettings':act({type:'attackSettings'});break;
      case 'recoverInTown':ui.speed=1;render();break;
      case 'currentLocation':ui.point=null;ui.base=squad().at;state.viewCountry=D.bases[ui.base].countryIndexCandidate;focusOnBase(ui.base);render();break;
      case 'retreatTravel':if(act({type:'retreatTravel',to:ui.base})){ui.speed=1;render();}break;
      case 'originalBank':beginStory({kind:'bank'});break;
      case 'transfers':showTransfers();break;
      case 'armory':armoryUI.show(ui.selected,'equipment');break;
      case 'storyNext':continueStory();break;
      case 'endingNext':state.ending.index++;save(true);showEnding();break;
      case 'endingPrevious':state.ending.index=Math.max(0,state.ending.index-1);save(true);showEnding();break;
      case 'endingFinish':state.ending.finished=true;save(true);closeModal();render();break;
      case 'endingReplay':state.ending.index=0;state.ending.finished=false;showEnding();break;
      case 'stop':act({type:'stop'});break;
      case 'heal':if(state.mode==='native-original'){const a=sourceTownActions().find(a=>a.id===68);if(a)beginStory(a.activateTask);else toast('此處沒有原作病院');}else act({type:'heal'});break;
      case 'localMissions':ui.tab='missions';render();break;
      case 'troops':ui.tab='troops';ui.facility='roster';render();break;
      case 'journal':openModal('<h2>行動紀錄</h2>'+$('#log').innerHTML,'journal');break;
      case 'hire':act({type:'hire',classId:ui.recruit});break;
      case 'buy':act({type:'buy',item:ui.item,member:ui.member});break;
      case 'missionMove':{const m=state.taken.find(m=>m.squad===ui.selected);if(m){ui.base=m.to;act({type:'move',to:m.to});ui.speed=1;render();}break;}
      case 'battle':startBattle();break;
      case 'battlePause':autoBattle=!autoBattle;renderBattle();break;
      case 'withdrawMember':{const result=E.battleCommand(state,battle,{type:'withdraw-member',index:ui.battleInspect.index});if(!result?.accepted)toast('此成員目前無法個別撤退');save(true);renderBattle();break;}
      case 'battleStep':E.battleStep(state,battle);renderBattle();save(true);render();break;
      case 'retreat':requestRetreat();break;
      case 'confirmBattleRetreat':requestRetreat(true);break;
      case 'cancelBattleClose':ui.battleClosePrompt=false;autoBattle=ui.battleResumeAfterClose??true;renderBattle();break;
      case 'reload':location.reload();break;
      case 'resumeEvent':renderStory();break;
      case 'battleClose':exitBattle();break;
      case 'welcomeStart':prefs.welcome=true;savePrefs();closeModal();resumeScene();break;
      case 'welcomeAtlas':prefs.welcome=true;savePrefs();closeModal();setView('atlas');break;
      case 'musicPlay':playMusic();break;
      case 'musicToggle':toggleMusic();break;
      case 'musicStop':window.OriginalMusic.stop();showMusic();break;
      case 'exportLegacy':exportLegacy();break;
      case 'help':showHelp();break;
      case 'evidence':showEvidence();break;
      case 'original':original();break;
      case 'save':save();break;
      case 'export':{const file=new Blob([loadError?initialRaw:JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=`highreward-web-day${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('已匯出 Web 存檔。');break;}
      case 'import':$('#importFile').click();break;
      case 'resetConfirm':openModal('<h2>重新開始戰役</h2><p>目前瀏覽器中的原生重製進度會被覆寫。可先匯出 JSON 留存。</p><div class="modal-actions"><button data-action="export">先匯出</button><button class="primary" data-action="reset">確定重新開始</button></div>','reset');break;
      case 'reset':state=E.newGame(D);ui.selected=0;ui.base=state.squads[0].at;ui.speed=0;ui.point=null;ui.battleMapPeek=false;ui.eventNoticeIndex=0;ui.lastEventKey=null;ui.newestEventKey=null;battle=null;save(true);closeModal();render();resumeScene();toast('已建立新的原作戰役。');break;
    }
    if(b.id==='loadMore'){ui.limit+=48;renderArchive();}
  });
  document.addEventListener('change',e=>{invalidateWorld();
    if(e.target.id==='musicTrack'){ui.musicTrack=e.target.value;}
    if(e.target.id==='equipmentMember'){ui.member=+e.target.value;renderDesk();}
    if(e.target.id==='transferTarget'){ui.transferTarget=+e.target.value;showTransfers();}
    if(e.target.id==='transferFromSlot'){ui.transferFromSlot=+e.target.value;}
    if(e.target.id==='transferToSlot'){ui.transferToSlot=+e.target.value;}
    if(e.target.id==='baseSelect'){ui.point=null;ui.base=+e.target.value;state.viewCountry=D.bases[ui.base].countryIndexCandidate;focusOnBase(ui.base);renderDesk();}
    if(e.target.id==='themeSelect'){prefs.theme=e.target.value;document.body.dataset.artwork=prefs.theme;savePrefs();imageCache.clear();render();if(ui.view==='atlas')renderAtlas();if(ui.view==='archive')renderArchive();toast('已切換美術風格。');}
  });
  $('#importFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2*1024*1024)throw Error('存檔大小超過 2 MB');const restored=E.validateSave(JSON.parse(await f.text()),D),restoredBattle=E.restoreOriginalBattle(restored);if(restored.mode!=='native-original')throw Error('這是舊版試作存檔；請保留備份，0.6 使用原作戰役存檔');modal.close();modalKind='';armoryUI.clear();state=restored;loadError=null;battle=restoredBattle;ui.battleClosePrompt=false;ui.battleReturnAfterRetreat=false;ui.battleInspect=null;ui.battleError='';ui.battleMapPeek=false;ui.eventNoticeIndex=0;ui.lastEventKey=null;ui.newestEventKey=null;autoBattle=true;ui.point=null;ui.selected=0;ui.base=squad().at;ui.speed=0;save(true);render();resumeScene();toast('已恢復 Web 存檔。');}catch(err){toast('無法匯入：'+err.message);}finally{e.target.value='';}});
  $('#search').addEventListener('input',e=>{ui.query=e.target.value;ui.limit=48;renderArchive();});
  $('#musicBtn').onclick=showMusic;$('#saveBtn').onclick=()=>save();$('#menuBtn').onclick=showSettings;$('#evidenceBtn').onclick=showEvidence;$('#helpBtn').onclick=showHelp;$('#originalBtn').onclick=original;$('#closeModal').onclick=closeModal;
  modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  document.addEventListener('keydown',e=>{if(guideModal.open)return;if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;if(e.code==='KeyG'&&e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();if(e.repeat)return;invalidateWorld();try{const amount=E.cheatMoney(state);save(true);render();if(modalKind==='story')renderStory();else if(modalKind==='armory')armoryUI.refresh();toast('密技補給 ＋'+money(amount)+' G');}catch(error){toast(error.message);}return;}if(e.code==='Space'&&!modal.open){e.preventDefault();invalidateWorld();ui.worldResumeSpeed=0;ui.speed=ui.speed?0:1;render();}if(/^[1-6]$/.test(e.key)&&!modal.open){ui.point=null;ui.selected=+e.key-1;state.selectedSquad=ui.selected;ui.base=squad().at;state.viewCountry=D.bases[ui.base].countryIndexCandidate;render();}});
  $('.brand').onclick=e=>{e.preventDefault();setView('command');};
  // Canvas is projected in the original 160x100 world coordinate candidates.
  const canvas=$('#world'),ctx=canvas.getContext('2d');let hitBases=[],hitSquads=[],pointer=null,lastDraw=0;
  function mapScale(){return ui.zoom*Math.max(1,canvas.height/800);}
  function clampPan(){const scale=mapScale(),maxX=Math.max(0,(1280*scale-1280)/2),maxY=Math.max(0,(800*scale-canvas.height)/2);ui.panX=Math.max(-maxX,Math.min(maxX,ui.panX));ui.panY=Math.max(-maxY,Math.min(maxY,ui.panY));}
  function focusMission(id){if(!Number.isInteger(id)||!D.bases[id]){toast('此任務沒有可定位的目的地');return;}ui.point=null;ui.base=id;ui.tab='city';ui.focusTarget=id;ui.focusUntil=performance.now()+10000;ui.zoom=Math.max(1.6,ui.zoom);$('#zoomLabel').textContent=Math.round(ui.zoom*100)+'%';state.viewCountry=D.bases[id].countryIndexCandidate;setView('command');focusOnBase(id);render();$('#world').scrollIntoView({behavior:'smooth',block:'center'});$('#mapHint').textContent='任務目的地：'+D.bases[id].name+'（閃爍中）';$('#missionBeacon span').textContent='任務目的地：'+D.bases[id].name;toast('已定位任務目的地：'+D.bases[id].name);}
  function focusOnBase(id){const b=D.bases[id],scale=mapScale();ui.panX=-(b.xCandidate*8-640)*scale;ui.panY=-(b.yCandidate*8-400)*scale;clampPan();}
  function project(x,y){const scale=mapScale();return {x:(x*8-640)*scale+640+ui.panX,y:(y*8-400)*scale+canvas.height/2+ui.panY};}
  function selectWorldPoint(p){const scale=mapScale(),x=Math.floor(((p.x-640-ui.panX)/scale+640)/8),y=Math.floor(((p.y-canvas.height/2-ui.panY)/scale+400)/8);if(x<0||x>=128||y<0||y>=96)return;ui.point={x,y};ui.tab='city';const country=E.countryAt(state,x,y);if(country>=0&&D.countries[country])state.viewCountry=country;}
  function drawMap(now){
    const box=canvas.getBoundingClientRect();
    if(box.width<1||box.height<1)return;
    const height=Math.max(1,Math.round(1280*box.height/box.width));
    if(canvas.height!==height){const oldScale=mapScale();canvas.height=height;const ratio=mapScale()/oldScale;ui.panX*=ratio;ui.panY*=ratio;}
    clampPan();
    ctx.clearRect(0,0,1280,canvas.height);ctx.fillStyle='#13251c';ctx.fillRect(0,0,1280,canvas.height);
    const bg=getImage('GMAP.PXS');
    if(bg?.complete&&bg.naturalWidth){ctx.save();ctx.translate(640+ui.panX,canvas.height/2+ui.panY);ctx.scale(mapScale(),mapScale());ctx.imageSmoothingEnabled=prefs.theme!=='hd';ctx.imageSmoothingQuality='high';ctx.globalAlpha=.9;ctx.drawImage(bg,-640,-400,1280,800);ctx.fillStyle='#0d241d';ctx.globalAlpha=.12;ctx.fillRect(-640,-400,1280,800);ctx.restore();}
    if(ui.focusTarget>=0&&now>=ui.focusUntil){ui.focusTarget=-1;$('#mapHint').textContent='點選據點或空白處下達行軍 · 滾輪縮放 · 拖曳平移';}
    const beacon=$('#missionBeacon');beacon.hidden=!(ui.focusTarget>=0&&now<ui.focusUntil);if(!beacon.hidden){const target=D.bases[ui.focusTarget],p=project(target.xCandidate,target.yCandidate);beacon.style.left=(p.x/1280*100)+'%';beacon.style.top=(p.y/canvas.height*100)+'%';if(p.x<0||p.x>1280||p.y<0||p.y>canvas.height)beacon.hidden=true;}
    hitBases=[];hitSquads=[];
    const selected=squad(),plan=selected.travel?.original?E.routePlan(D,E.position(selected,D),selected.travel.to===null?selected.fieldDestination:selected.travel.to,selected.moveMode,state):selected.travel?{cells:selected.travel.cells.slice(selected.travel.cursor)}:ui.routes?E.routePlan(D,E.position(selected,D),ui.base,ui.travelMode??0,state):null;
    if(plan?.cells.length){ctx.strokeStyle='#f4d885';ctx.lineWidth=3;ctx.setLineDash([9,7]);ctx.beginPath();const w=D.mechanics.movement.width;plan.cells.map(i=>project(i%w,Math.floor(i/w))).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
    D.bases.forEach(b=>{if(!baseVisible(b))return;
      const p=project(b.xCandidate,b.yCandidate);if(p.x<0||p.x>1280||p.y<0||p.y>canvas.height)return;
      const chosen=b.index===ui.base,hover=b.index===ui.hover,townState=W.baseStatus(state,D,b.index);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillStyle=townState.color;ctx.strokeStyle='#423d22';ctx.lineWidth=2.2;const marker=Math.max(7,Math.min(26,8*1280/box.width));ctx.fillRect(-marker,-marker,marker*2,marker*2);ctx.strokeRect(-marker,-marker,marker*2,marker*2);ctx.restore();if(townState.tone==='hostile'||townState.tone==='blocked'||townState.tone==='unknown'){ctx.save();ctx.fillStyle='#171a17';ctx.font='bold '+Math.max(17,14*1280/box.width)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(townState.tone==='hostile'?'!':townState.tone==='blocked'?'×':'?',p.x,p.y);ctx.restore();}
      if(ui.focusTarget===b.index&&now<ui.focusUntil){const phase=(now%700)/700;ctx.save();ctx.globalAlpha=.45+.55*Math.abs(Math.sin(now/140));ctx.fillStyle='#ffe289';ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff9c2';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,25+phase*24,0,Math.PI*2);ctx.stroke();ctx.restore();}
      if(chosen){ctx.beginPath();ctx.strokeStyle='#ffe7a0';ctx.lineWidth=2;ctx.arc(p.x,p.y,20+Math.sin(now/500)*2,0,Math.PI*2);ctx.stroke();}
      if(chosen||hover){ctx.font='bold 17px "Microsoft JhengHei",sans-serif';const mapName=b.name+' · '+townState.label,w=ctx.measureText(mapName).width;ctx.fillStyle='#0f1b15ed';ctx.fillRect(p.x-w/2-9,p.y-36,w+18,26);ctx.fillStyle='#f0ddb2';ctx.textAlign='center';ctx.fillText(mapName,p.x,p.y-17);}
      hitBases.push({id:b.index,...p});
    });
    state.squads.forEach((q,i)=>{
      const {x,y}=E.position(q,D);
      const near=o=>Math.hypot(E.position(o,D).x-x,E.position(o,D).y-y)<.5,same=state.squads.slice(0,i).filter(near).length,scale=1280/box.width,p=H.marker(project(x,y),same,state.squads.filter(near).length,canvas.width,canvas.height,scale),size=p.size;
      const src=H.dataURL(q.emblemId);if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}const emblem=imageCache.get(src);
      ctx.save();if(i===ui.selected){ctx.shadowColor='#ffe7a0';ctx.shadowBlur=15*scale;ctx.strokeStyle='#ffe7a0';ctx.lineWidth=2*scale;ctx.beginPath();ctx.arc(p.x,p.y,size*.6,0,Math.PI*2);ctx.stroke();}if(emblem.complete&&emblem.naturalWidth)ctx.drawImage(emblem,p.x-size/2,p.y-size*.55,size,size*1.1);ctx.restore();hitSquads.push({id:i,...p});
    });
    const eventNotice=W.notices(state,D)[ui.eventNoticeIndex||0]||W.notices(state,D)[0];$$('#worldEventBeacons .world-event-beacon').forEach((el,i)=>{const loc=eventNotice?.locations[i];if(!loc){el.hidden=true;return;}const p=project(loc.x,loc.y);el.hidden=!(eventNotice.pending||now<(ui.eventFlashUntil||0))||p.x<0||p.x>1280||p.y<0||p.y>canvas.height;el.style.left=p.x/1280*100+'%';el.style.top=p.y/canvas.height*100+'%';});
    if(ui.speed===0){ctx.fillStyle='#102219de';ctx.fillRect(20,canvas.height-56,125,30);ctx.fillStyle='#e6d18d';ctx.font='12px "Microsoft JhengHei"';ctx.textAlign='left';ctx.fillText('Ⅱ  時間已暫停',32,canvas.height-36);}
  }
  function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*1280,y:(e.clientY-r.top)/r.height*canvas.height};}
  canvas.addEventListener('pointerdown',e=>{pointer={...canvasPoint(e),clientX:e.clientX,clientY:e.clientY,px:ui.panX,py:ui.panY,drag:false};canvas.setPointerCapture(e.pointerId);});
  function baseHitRadius(){return Math.max(28,18*1280/canvas.getBoundingClientRect().width);}
  canvas.addEventListener('pointermove',e=>{const p=canvasPoint(e);if(pointer){if(Math.hypot(e.clientX-pointer.clientX,e.clientY-pointer.clientY)>4)pointer.drag=true;if(pointer.drag){ui.panX=Math.max(-1000,Math.min(1000,pointer.px+p.x-pointer.x));ui.panY=Math.max(-650,Math.min(650,pointer.py+p.y-pointer.y));}}else{ui.hover=hitBases.find(b=>Math.hypot(p.x-b.x,p.y-b.y)<baseHitRadius())?.id??null;}});
  canvas.addEventListener('pointerup',e=>{if(!pointer)return;const p=canvasPoint(e);if(!pointer.drag){const q=hitSquads.find(q=>Math.hypot(q.x-p.x,q.y-p.y)<q.radius),b=hitBases.reduce((best,b)=>{const d=Math.hypot(b.x-p.x,b.y-p.y);return d<baseHitRadius()&&(!best||d<best.d)?{...b,d}:best;},null);if(q){ui.point=null;ui.selected=q.id;state.selectedSquad=q.id;ui.base=squad().at;state.viewCountry=D.bases[ui.base].countryIndexCandidate;}else if(b){ui.point=null;ui.base=b.id;state.viewCountry=D.bases[b.id].countryIndexCandidate;ui.tab='city';}else if(state.mode==='native-original')selectWorldPoint(p);render();}pointer=null;});
  canvas.addEventListener('pointercancel',()=>pointer=null);
  function zoom(delta){ui.zoom=Math.max(1,Math.min(3,ui.zoom+delta));$('#zoomLabel').textContent=Math.round(ui.zoom*100)+'%';if(ui.zoom===1){ui.panX=0;ui.panY=0;}}
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?-.15:.15);},{passive:false});$('#zoomIn').onclick=()=>zoom(.25);$('#zoomOut').onclick=()=>zoom(-.25);$('#resetMap').onclick=()=>{ui.zoom=1;ui.panX=0;ui.panY=0;$('#zoomLabel').textContent='100%';};
  $('#toggleRoutes').onclick=()=>{ui.routes=!ui.routes;$('#toggleRoutes').setAttribute('aria-pressed',String(ui.routes));$('#toggleRoutes').textContent=ui.routes?'隱藏步行路線':'預覽步行路線';};
  let previous=performance.now(),elapsed=0,saveElapsed=0;
  function frame(now){const dt=Math.min(.2,(now-previous)/1000);previous=now;
    if(battle?.phase==='active'&&autoBattle&&!battleInteracting){battleElapsed+=dt;if(battleElapsed>=(battle.original ? 0.08 : 0.8)){battleElapsed=0;try{E.battleStep(state,battle);renderBattle();if(battle.phase!=='active'){save(true);render();if(ui.battleReturnAfterRetreat)exitBattle();}}catch(error){autoBattle=false;ui.battleError=error.message;save(true);renderBattle();}}}
    if(ui.speed&&!modal.open&&!guideModal.open&&!state.ended){const tickDuration=state.mode==='native-original' ? 0.08 : 0.8;elapsed=Math.min(8*tickDuration,elapsed+dt*ui.speed);if(elapsed>=tickDuration&&!worldPending){const ticks=Math.min(state.mode==='native-original'?2:8,Math.floor(elapsed/tickDuration));elapsed-=ticks*tickDuration;if(state.mode==='native-original')requestWorld(ticks);else{E.step(state,D,ticks);render();}}}
    saveElapsed+=dt;if(saveElapsed>=15){saveElapsed=0;if(!battle||battle.phase!=='active')save(true);}
    if(ui.view==='command'&&now-lastDraw>33){drawMap(now);lastDraw=now;}
    requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide',()=>{invalidateWorld();worldWorker?.terminate();worldWorker=null;worldPending=false;save(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){invalidateWorld();ui.speed=0;autoBattle=false;battleInteracting=false;save(true);render();if(modalKind==='battle')renderBattle();}});
  render();renderAtlas();drawMap(performance.now());requestAnimationFrame(frame);if(loadError)showLoadRecovery();else if(!prefs.welcome&&!state.story?.event)showWelcome();else resumeScene();
})();
