/* Serialized civilian commissions. Native contracts, travel, shops and rewards
 * remain authoritative; this module only issues bounded player-equivalent actions. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./civilian-service.js'),require('./auto-supply-service.js'),require('./auto-travel-service.js'),require('./original-contracts.js'),require('./story-bridge.js'),require('./original-story.js'),require('./original-transport.js'),require('./armory.js'));
  else root.HRAutoCommissions=factory(root.HRCivilianService,root.HRAutoSupplyService,root.HRAutoTravelService,root.OriginalContracts,root.OriginalStoryBridge,root.HR_ORIGINAL_STORY,root.OriginalTransport,root.HRArmory);
})(typeof globalThis==='object'?globalThis:this,function(Civil,Supply,Travel,Contracts,Bridge,Story,Transport,Armory){
  'use strict';
  const copy=v=>JSON.parse(JSON.stringify(v)),pending=s=>s.story?.event&&!['complete','tick-complete'].includes(s.story.event.type);
  const phases={idle:'待命',scan:'查看看板',travel:'運送中',patrol:'巡迴找案',rest:'駐留休整',wait:'等待合適委託',supply:'補給中',delivery:'交付中'};
  const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  function defaults(s,id){const q=s.squads[id],country=Travel.countryAt(s,Math.trunc(q.originalX10/10),Math.trunc(q.originalY10/10));return {countries:country>=0?[country]:[],cities:[],home:q.currentBase??q.at,medicine:40,target:3,stock:10,autoBuy:true,budget:500,startHealth:80,criticalHealth:50,patrol:true,returnHome:false,travel:0,deadlineBuffer:25};}
  function ensure(s){
    if(!s.automation)s.automation={version:1,running:false,cursor:0,ticks:0,reason:'尚未啟用',settings:{reserve:5000,payroll:true,budget:2000},daily:{day:s.day,spent:0,teams:Array(6).fill(0)},history:[],teams:s.squads.map((_,id)=>({enabled:false,config:defaults(s,id),runtime:{phase:'idle',reason:'尚未啟用',nextScan:0,visited:[],trip:null,job:null},totals:{completed:0,income:0,medicine:0}}))};
    return s.automation;
  }
  function validate(a,D){
    const bad=()=>{throw Error('自動委託存檔資料無效');};
    if(!a||a.version!==1||typeof a.running!=='boolean'||!integer(a.cursor,0,5)||!integer(a.ticks,0,1e12)||typeof a.reason!=='string'||a.reason.length>200)bad();
    const g=a.settings;if(!g||!integer(g.reserve,0,99999999)||!integer(g.budget,0,99999999)||typeof g.payroll!=='boolean')bad();
    if(!a.daily||!integer(a.daily.day,0,1e12)||!integer(a.daily.spent,0,1e12)||!Array.isArray(a.daily.teams)||a.daily.teams.length!==6||a.daily.teams.some(n=>!integer(n,0,1e12)))bad();
    if(!Array.isArray(a.teams)||a.teams.length!==6||!Array.isArray(a.history)||a.history.length>60)bad();
    for(const h of a.history)if(!h||!integer(h.day,0,1e12)||!integer(h.party,-1,5)||typeof h.text!=='string'||h.text.length>500)bad();
    for(const t of a.teams){
      const c=t?.config,r=t?.runtime,n=t?.totals;if(typeof t?.enabled!=='boolean'||!c||!r||!n)bad();
      for(const [key,max]of [['countries',10],['cities',D.bases.length-1]])if(!Array.isArray(c[key])||c[key].length>max+1||new Set(c[key]).size!==c[key].length||c[key].some(v=>!integer(v,0,max)))bad();
      if(!D.bases[c.home]||!integer(c.medicine,40,43)||!integer(c.target,1,20)||!integer(c.stock,0,99)||!integer(c.budget,0,99999999)||!integer(c.startHealth,1,100)||!integer(c.criticalHealth,1,c.startHealth)||!integer(c.deadlineBuffer,0,100)||![0,1,3].includes(c.travel)||typeof c.autoBuy!=='boolean'||typeof c.patrol!=='boolean'||typeof c.returnHome!=='boolean')bad();
      if(!Object.hasOwn(phases,r.phase)||typeof r.reason!=='string'||r.reason.length>200||!integer(r.nextScan,0,1e12)||!Array.isArray(r.visited)||r.visited.length>100||r.visited.some(v=>!D.bases[v]))bad();
      if(r.trip!==null&&(!r.trip||!D.bases[r.trip.to]||![0,1].includes(r.trip.mode)||!['job','patrol'].includes(r.trip.kind)||!integer(r.trip.started,0,1e12)||!integer(r.trip.limit,1,20000)||!Array.isArray(r.trip.cells)||r.trip.cells.length>12288||r.trip.cells.some(v=>!integer(v,0,12287))||typeof r.trip.world!=='string'||r.trip.world.length>3000))bad();
      if(r.job!==null&&(!r.job||!D.bases[r.job.to]||!D.bases[r.job.from]||typeof r.job.stamp!=='string'||r.job.stamp.length>200||typeof r.job.name!=='string'||r.job.name.length>100||!integer(r.job.reward,0,1e10)||!integer(r.job.ledger,0,0xffffffff)||!integer(r.job.cash,0,99999999)||typeof r.job.delivering!=='boolean'))bad();
      for(const key of ['completed','income','medicine'])if(!integer(n[key],0,1e12))bad();
    }
    return a;
  }
  function log(s,id,text){const a=ensure(s);a.history.unshift({day:s.day,party:id,text});a.history=a.history.slice(0,60);s.log.unshift({day:s.day,text:'自動委託'+(id>=0?' · 第'+(id+1)+'隊':'')+'：'+text});s.log=s.log.slice(0,80);}
  function commit(s,draft){const a=s.automation,selected=s.selectedSquad;Object.assign(s,draft);s.automation=a;s.selectedSquad=selected;}
  function task(s,D,id){return Contracts.decodeNativeTask(s.originalCampaign,Bridge.unitBytes(s.squads[id],D),id);}
  function stamp(t){return JSON.stringify([t.originId,t.destinationId,t.cargoSelector,t.originalDays,t.reward,t.dialogueType??t.style]);}
  function payroll(s,D){return s.squads.reduce((n,q)=>n+(q.active===1?Story.partyWage(Bridge.unitBytes(q,D)):0),0);}
  function funds(s,D,id){const a=ensure(s),t=a.teams[id];if(a.daily.day!==s.day)a.daily={day:s.day,spent:0,teams:Array(6).fill(0)};const wages=a.settings.payroll?payroll(s,D):0;return {wages,reserved:a.settings.reserve+wages,available:Math.max(0,Math.min(s.money-a.settings.reserve-wages,a.settings.budget-a.daily.spent,t.config.budget-a.daily.teams[id]))};}
  function configure(s,D,id,config,global){
    const a=ensure(s),draft=copy(a);if(!integer(id,0,5))throw Error('部隊不存在');
    Object.assign(draft.teams[id].config,copy(config||{}));if(global)Object.assign(draft.settings,copy(global));validate(draft,D);
    if(a.teams[id].enabled)pause(s,id,'設定已變更，請重新啟動');
    a.teams[id].config=draft.teams[id].config;a.settings=draft.settings;return a.teams[id];
  }
  function pause(s,id,reason='玩家接手'){if(!s.automation)return;const a=s.automation,t=a.teams[id];if(!t)return;t.enabled=false;t.runtime.reason=reason;if(!a.teams.some(t=>t.enabled)){a.running=false;a.reason=reason;}}
  function pauseAll(s,reason='玩家暫停'){if(!s.automation)return;s.automation.running=false;s.automation.reason=reason;}
  function suspendForLoad(s){if(!s.automation)return;s.automation.running=false;s.automation.reason='已讀檔，請確認後繼續自動委託';}
  function start(s,D,id){
    const a=ensure(s),t=a.teams[id];if(!t||s.mode!=='native-original'||s.ended)throw Error('目前不能自動委託');
    if(pending(s)||s.story?.pendingOpeningEvents||s.activeBattle?.phase==='active')throw Error('請先完成目前的劇情或戰鬥，再繼續自動委託');
    if(!t.config.countries.length)throw Error('至少選擇一個活動國家');
    const q=s.squads[id];if(q.active!==1)throw Error('此部隊目前尚未啟用');
    if(q.subtype!==0||q.tankId===7||q.moveMode===2)throw Error('請先結束特殊活動、特殊戰車指令或飛行，再啟用');
    if(!allowedPoint(s,t.config,Math.trunc(q.originalX10/10),Math.trunc(q.originalY10/10)))throw Error('部隊目前不在允許的活動區域內');
    const current=task(s,D,id).civilian;
    if(current){if(current.cargoSelector===5||!allowedBase(s,D,t.config,current.destinationId))throw Error('現有任務需由玩家處理，或目的地不在活動範圍內');if(!t.runtime.job)t.runtime.job=job(s,id,current);else if(t.runtime.job.stamp!==stamp(current))throw Error('任務已改變，請先手動完成現有任務');}
    else if(t.runtime.job&&!t.runtime.job.delivering)throw Error('原委託已消失或逾期，請先查看處理結果');
    if(q.order==='move'&&(!t.runtime.trip||q.destinationBase!==t.runtime.trip.to))throw Error('請先結束手動行軍，再啟用自動委託');
    t.enabled=true;t.runtime.reason='';t.runtime.nextScan=0;a.running=true;a.reason='';log(s,id,'已啟動；可隨時暫停接手。');return t;
  }
  function resetJob(s,id){const a=ensure(s),t=a.teams[id];if(t.enabled||a.running&&t.enabled)throw Error('請先暫停此隊');if(t.runtime.job)throw Error('仍保存委託紀錄；請先手動確認完成或逾期結果');t.runtime.trip=null;t.runtime.phase='idle';}
  function acknowledge(s,D,id){const t=ensure(s).teams[id];if(t.enabled)throw Error('請先暫停此隊');if(task(s,D,id).civilian)throw Error('原作委託仍有效，不能清除');t.runtime.job=null;t.runtime.trip=null;t.runtime.phase='idle';t.runtime.reason='已確認原作結果，可重新啟動';}
  function allowedPoint(s,c,x,y){return c.countries.includes(Travel.countryAt(s,x,y));}
  function allowedBase(s,D,c,id){const b=s.world?.bases?.find(b=>b.id===id);return !!b&&!!D.bases[id]&&[0,1].includes(b.kind)&&(!c.cities.length||c.cities.includes(id))&&allowedPoint(s,c,b.x,b.y);}
  function worldKey(s){return JSON.stringify(s.world.bases.map(b=>[b.kind,b.raw1A]));}
  function daysDuring(s,ticks){let clock={...s.clock},days=0;for(let i=0;i<ticks;i++){clock=Transport.clockStep(clock);if(clock.newDay)days++;}return days;}
  function plan(s,D,E,id,to,days=null){
    const t=ensure(s).teams[id],c=t.config;if(!allowedBase(s,D,c,to))return {ok:false,reason:'目的地不在允許的和平城鎮範圍內'};
    const options=E.movementOptions(s,D,id,to);if(options.requiresSpecialTankHook)return {ok:false,reason:'特殊載具需要玩家處理'};
    const modes=c.travel===3?[1,0]:[c.travel];
    for(const mode of modes){if(!options.choices.includes(mode))continue;const p=Travel.traceRoute(s,D,E,{partyId:id,to,mode});if(!p.ok)continue;
      if(!p.cells.every(cell=>allowedPoint(s,c,cell%128,Math.trunc(cell/128))))continue;
      if(days!==null&&daysDuring(s,Math.ceil(p.ticks*(1+c.deadlineBuffer/100))+8)>=days)continue;
      return {...p,mode};
    }
    return {ok:false,reason:'原作路線會越出活動區域、交通不通，或期限不足'};
  }
  function health(q){const living=q.members.filter(m=>m.hp>0);return {down:living.length!==q.members.length,hp:living.length?Math.min(...living.map(m=>m.hp/m.maxHp*100)):0,stamina:q.stamina};}
  function job(s,id,t){return {to:t.destinationId,from:t.originId,stamp:stamp(t),name:t.name||'民事運送',reward:t.reward,ledger:s.ledger[id*16+7],cash:s.money,delivering:false};}
  function depart(s,D,E,id,to,kind,p){const a=ensure(s),r=a.teams[id].runtime;E.command(s,D,{type:'move',squad:id,to,mode:p.mode});r.trip={to,mode:p.mode,kind,started:a.ticks,limit:Math.min(20000,Math.max(100,p.ticks*3+50)),cells:p.cells,world:worldKey(s)};r.phase=kind==='job'?'travel':'patrol';r.reason='前往'+D.bases[to].name;}
  function finishDelivery(s,D,id){const t=s.automation.teams[id],j=t.runtime.job;if(!j?.delivering)return false;
    const current=task(s,D,id).civilian;if(current)return false;
    const gross=((s.ledger[id*16+7]||0)-j.ledger)>>>0;if(!gross||gross>1e9){pauseAll(s,'交付結果需要玩家確認');t.runtime.reason='原作未產生可核對的任務入帳';return false;}
    t.totals.completed++;t.totals.income+=gross;log(s,id,j.name+'完成，原作帳目收入 '+gross.toLocaleString('en-US')+' G（已含 ×5）。');t.runtime.job=null;t.runtime.trip=null;t.runtime.phase='idle';t.runtime.reason='任務完成';t.runtime.nextScan=s.automation.ticks+1;return true;
  }
  function handleEvent(s,D,E){
    if(!pending(s))return true;const a=s.automation,info=Travel.inspectEvent(s,D),t=info.partyId!==null?a.teams[info.partyId]:null,r=t?.runtime;
    const owned=!!t?.enabled&&info.safe&&((info.kind==='arrival'&&r.trip?.to===info.destinationId)||(info.kind==='delivery'&&r.job?.to===info.destinationId));
    if(!owned){pauseAll(s,info.kind==='expiry'?'委託逾期，請處理原作通知':'遇到戰鬥或特殊事件，請先手動處理');return false;}
    if(info.kind==='delivery'&&!r.job.delivering){r.job.delivering=true;r.job.ledger=s.ledger[info.partyId*16+7];r.job.cash=s.money;r.phase='delivery';}
    E.storyResume(s,D,{});
    if(info.kind==='arrival'){r.visited=[...r.visited.filter(b=>b!==info.destinationId),info.destinationId].slice(-90);r.trip=null;r.nextScan=a.ticks+1;r.phase=r.job?'delivery':'idle';}
    if(info.kind==='delivery')finishDelivery(s,D,info.partyId);
    return true;
  }
  function supply(s,D,E,id){
    let a=s.automation,t=a.teams[id],c=t.config;
    let p=Armory.restockPlan(s,D,id,c.medicine,c.target);if(p.used)E.manageStock(s,D,{type:'restockMedicine',squad:id,item:c.medicine,target:c.target});
    p=Armory.restockPlan(s,D,id,c.medicine,c.target);const needed=Math.max(0,p.needed+c.stock-Armory.count(s.squads[id],c.medicine));
    if(!c.autoBuy||!needed)return;const budget=funds(s,D,id);if(budget.available<=0){t.runtime.reason='補給預算或保留金不足；先使用庫存';return;}
    const shop=Supply.inspect(s,D,E,id);if(!shop.ok){if(shop.requiresPlayer)pause(s,id,shop.message);return;}
    const offer=shop.offers.find(o=>o.itemId===c.medicine);if(!offer)return;
    const quantity=Math.min(99,needed,Math.floor(budget.available/offer.unitPrice));if(!quantity)return;
    const automation=a,selected=s.selectedSquad,result=Supply.buy(s,D,E,{partyId:id,itemId:c.medicine,quantity,maxSpend:budget.available});s.automation=automation;s.selectedSquad=selected;t=a.teams[id];
    if(!result.ok){if(result.requiresPlayer)pause(s,id,result.message);return;}
    a.daily.spent+=result.cost;a.daily.teams[id]+=result.cost;t.totals.medicine+=result.cost;log(s,id,'從'+shop.shopName+'採購 '+result.quantity+' 件膠囊，支出 '+result.cost+' G。');
    p=Armory.restockPlan(s,D,id,c.medicine,c.target);if(p.used)E.manageStock(s,D,{type:'restockMedicine',squad:id,item:c.medicine,target:c.target});
  }
  function scan(s,D,E,id){
    const a=s.automation,t=a.teams[id],r=t.runtime,c=t.config,draft=copy(s),action=E.townActions(draft,D,id).actions.find(x=>x.id===65);
    r.nextScan=a.ticks+100;r.phase='wait';if(!action){r.reason='本城未開放一般民事委託';return false;}
    E.storyEvent(draft,D,action.activateTask);const board=Civil.board(draft,D);
    if(!board&&Civil.emptyBoard(draft)){const closed=Civil.tryEmpty(draft,D,E,{partyId:id,baseId:s.squads[id].currentBase});if(closed.ok){commit(s,closed.state);r.reason='本城目前沒有一般民事委託';return false;}}
    if(!board){commit(s,draft);pauseAll(s,'民事看板出現特殊事件，請由玩家處理');return false;}
    const candidates=[];
    for(const offer of board.offers){if(offer.cargoSelector===5)continue;if(a.teams.some((other,index)=>index!==id&&other.runtime.job?.stamp===stamp(offer)))continue;const p=plan(draft,D,E,id,offer.destinationId,offer.days);if(p.ok)candidates.push({offer,p});}
    candidates.sort((x,y)=>(y.offer.reward/Math.max(1,y.p.ticks))-(x.offer.reward/Math.max(1,x.p.ticks)));
    if(candidates.length){const {offer,p}=candidates[0],result=Civil.tryAccept(draft,D,E,{partyId:id,offerId:offer.offerId,fingerprint:offer.fingerprint});if(!result.ok){const cancel=Civil.tryCancel(draft,D,E);if(cancel.ok)commit(s,cancel.state);else commit(s,draft);pauseAll(s,'原作接案流程需要玩家確認');return false;}
      commit(s,result.state);const current=task(s,D,id).civilian;r.job=job(s,id,current);log(s,id,'接取'+offer.name+' → '+offer.destinationName+'；基本報酬 '+(offer.reward*5).toLocaleString('en-US')+' G，提前獎勵依原作結算。');depart(s,D,E,id,offer.destinationId,'job',p);return true;
    }
    const canceled=Civil.tryCancel(draft,D,E);commit(s,canceled.ok?canceled.state:draft);if(!canceled.ok){pauseAll(s,'原作看板無法安全關閉');return false;}
    r.reason='沒有符合區域、交通與期限的普通運送';return false;
  }
  function patrol(s,D,E,id){const a=s.automation,t=a.teams[id],r=t.runtime,c=t.config;const q=s.squads[id],here=q.currentBase,base=D.bases[here];
    if(!c.patrol){if(c.returnHome&&here!==c.home){const p=plan(s,D,E,id,c.home);if(p.ok)depart(s,D,E,id,c.home,'patrol',p);else r.reason='待命據點路線不符合活動範圍';}return;}
    const candidates=D.bases.filter(b=>b.index!==here&&allowedBase(s,D,c,b.index)).map(b=>({b,visited:r.visited.indexOf(b.index),distance:Math.hypot(b.xCandidate-base.xCandidate,b.yCandidate-base.yCandidate)}));
    candidates.sort((x,y)=>(x.visited<0?0:1)-(y.visited<0?0:1)||x.visited-y.visited||x.distance-y.distance);
    for(const {b}of candidates.slice(0,6)){const p=plan(s,D,E,id,b.index);if(p.ok){depart(s,D,E,id,b.index,'patrol',p);return;}}
    r.reason='範圍內沒有可安全巡迴的其他城鎮';
  }
  function teamStep(s,D,E,id){
    const a=s.automation,t=a.teams[id],r=t.runtime,c=t.config,q=s.squads[id];if(!t.enabled)return;
    if(q.active!==1||q.subtype!==0||q.tankId===7||q.moveMode===2){pause(s,id,'部隊狀態改變，請由玩家確認');return;}
    const h=health(q);if(h.down){pause(s,id,'有成員倒下，請先手動治療或整備');return;}
    if(r.job){const current=task(s,D,id).civilian;if(r.job.delivering){finishDelivery(s,D,id);if(!a.running)return;}else if(!current||stamp(current)!==r.job.stamp){pauseAll(s,'原作委託已改變或逾期，請確認結果');return;}}
    if(q.order==='move'){
      if(!r.trip||q.destinationBase!==r.trip.to){pause(s,id,'行軍已由玩家改變');return;}
      if(a.ticks-r.trip.started>r.trip.limit){pauseAll(s,'自動行軍超過預估時間，請查看部隊狀態');return;}
      if(!allowedPoint(s,c,Math.trunc(q.originalX10/10),Math.trunc(q.originalY10/10))){pauseAll(s,'部隊偏離允許區域，請手動接管');return;}
      if(h.hp<c.criticalHealth||h.stamina<c.criticalHealth){pauseAll(s,'行軍部隊狀況低於安全門檻，請手動接管');return;}
      if(r.trip.world!==worldKey(s)){const p=plan(s,D,E,id,r.trip.to,task(s,D,id).civilian?.remainingDays??null);if(!p.ok){pauseAll(s,'世界狀態改變後，原路線不再符合活動區域');return;}r.trip.world=worldKey(s);r.trip.cells=p.cells;}
      return;
    }
    if(!E.atBase(q)){pause(s,id,'部隊停在野外，請先手動進城');return;}
    if(!allowedBase(s,D,c,q.currentBase)){pause(s,id,'目前城鎮已不在允許範圍或不是和平狀態');return;}
    if(r.job){const current=task(s,D,id).civilian;if(current&&q.currentBase===r.job.to){r.phase='delivery';return;}if(current){const p=plan(s,D,E,id,r.job.to,current.remainingDays);if(!p.ok){pauseAll(s,p.reason);return;}depart(s,D,E,id,r.job.to,'job',p);return;}}
    if(a.ticks<r.nextScan)return;
    supply(s,D,E,id);if(!t.enabled||!a.running)return;
    if(h.hp<c.startHealth||h.stamina<c.startHealth){r.phase='rest';r.reason='駐留回復至生命／體力 '+c.startHealth+'%';r.nextScan=a.ticks+10;return;}
    r.visited=[...r.visited.filter(b=>b!==q.currentBase),q.currentBase].slice(-90);if(!scan(s,D,E,id)&&a.running&&t.enabled&&!pending(s))patrol(s,D,E,id);
  }
  function pump(s,D,E){
    const a=s.automation;if(!a?.running||s.mode!=='native-original')return;
    if(s.ended||s.activeBattle?.phase==='active'||s.story?.pendingOpeningEvents){pauseAll(s,'請先處理劇情或戰鬥');return;}
    for(let i=0;pending(s)&&i<16&&a.running;i++)if(!handleEvent(s,D,E))return;
    if(pending(s)){pauseAll(s,'原作對話超出自動處理範圍');return;}
    if(!a.teams.some(t=>t.enabled)){pauseAll(s,'所有部隊均已暫停');return;}
    if(s.money<a.settings.reserve+(a.settings.payroll?payroll(s,D):0)){pauseAll(s,'已觸及資金保留線，請確認財務後繼續');return;}
    // One company can issue one service/travel transaction per turn. All six
    // native movements still advance together in the same source world tick.
    const id=a.cursor;a.cursor=(a.cursor+1)%6;teamStep(s,D,E,id);
  }
  function stepWorld(s,D,E,ticks=1){
    if(!s.automation?.running)return E.step(s,D,ticks);
    const selected=s.selectedSquad;
    for(let i=0;i<ticks;i++){const a=s.automation;if(!a.running)break;pump(s,D,E);if(!a.running||pending(s))break;
      // Validate every moving company before the shared world advances. This
      // also catches a changed road/occupation before its next native step.
      for(let id=0;id<6&&a.running;id++)if(a.teams[id].enabled&&s.squads[id].order==='move')teamStep(s,D,E,id);
      if(!a.running)break;E.step(s,D,1);a.ticks++;pump(s,D,E);if(!a.running||pending(s))break;}
    s.selectedSquad=selected;return s;
  }
  function view(s,id){const a=s.automation,t=a?.teams[id];if(!t)return {active:false,label:'手動指揮',reason:'',phase:'idle'};const active=a.running&&t.enabled;return {active,label:active?(phases[t.runtime.phase]||'自動委託'):t.enabled?'自動委託已暫停':'手動指揮',reason:active?t.runtime.reason:t.enabled?a.reason:t.runtime.reason,phase:t.runtime.phase};}
  return Object.freeze({defaults,ensure,validate,configure,start,pause,pauseAll,suspendForLoad,acknowledge,resetJob,payroll,funds,allowedPoint,allowedBase,plan,health,pump,stepWorld,view,wantsClock:s=>!!s.automation?.running&&s.automation.teams.some(t=>t.enabled),phases});
});
