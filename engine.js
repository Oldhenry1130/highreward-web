/* Native campaign adapter. Published games use the original source runtime;
 * historical playtest saves have a separate, explicitly labelled compatibility path. */
(function (scope) {
  'use strict';
  const VERSION = 4;
  const Heraldry=typeof module!=='undefined'&&module.exports?require('./heraldry.js'):scope.HRHeraldry;
  const Economy=typeof module!=='undefined'&&module.exports?require('./economy.js'):scope.HREconomy;
  const Armory=typeof module!=='undefined'&&module.exports?require('./armory.js'):scope.HRArmory;
  const Transport=typeof module!=='undefined'&&module.exports?require('./original-transport.js'):scope.OriginalTransport;
  const Combat=typeof module!=='undefined'&&module.exports?require('./original-combat.js'):scope.OriginalCombat;
  const BattleBridge=typeof module!=='undefined'&&module.exports?require('./battle-bridge.js'):scope.OriginalBattleBridge;
  const StoryBridge=typeof module!=='undefined'&&module.exports?require('./story-bridge.js'):scope.OriginalStoryBridge;
  const clone = value => JSON.parse(JSON.stringify(value));
  const dist = (a,b) => Math.hypot(a.xCandidate-b.xCandidate,a.yCandidate-b.yCandidate);
  function rng(s) {s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  function record(s,text) {s.log.unshift({day:s.day,text});s.log=s.log.slice(0,80);}
  function newGame(data, seed=1496) {
    const starts=[0,3,25,44,57,64];
    const s={version:VERSION,mode:'native-playtest',day:1,hour:8,money:150000,debt:2500000,
      seed:seed>>>0,rep:0,completed:[],taken:[],inventory:[],log:[],ended:null,squads:[]};
    s.squads=data.companies.map((c,i)=>({id:i,name:c.name,leader:c.leader,face:i,
      at:starts[i],route:[],progress:0,position:null,travel:null,order:'idle',members:[{name:c.leader,face:i,hp:100,maxHp:100,attack:18+i,defense:7,weapon:null,armor:null}],
      stamina:100,formation:0,equipment:null,kills:0}));
    if(data.original){s.mode='native-original';StoryBridge.initial(s,data,seed);record(s,'原作戰役開始，六支部隊駐留薩蘭特城。');}
    else record(s,'原生重製測試戰役開始。經濟、行軍、戰鬥與任務規則尚待原版對拍。');
    s.squads.forEach(q=>Heraldry.normalize(q));
    return s;
  }
  const pathCaches=new WeakMap();
  function movementGrid(s,data){
    if(!s?.world)return data.mechanics.movement;
    const blocked=[];for(const base of s.world.bases)if(base.kind===3)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=base.x+dx,y=base.y+dy;if(x>=0&&x<128&&y>=0&&y<96)blocked.push(y*128+x);}
    return {...data.mechanics.movement,blockedCells:[...new Set(blocked)]};
  }
  function routePlan(data, from, to, mode=0,s=null) {
    const grid=s?movementGrid(s,data):data.mechanics?.movement,target=typeof to==='object'?to:data.bases[to],source=typeof from==='object'?from:data.bases[from];
    if(!grid||!source||!target||!Number.isInteger(mode)||mode<0||mode>2)return null;
    const w=grid.width,h=grid.height,sx=Math.floor(source.x??source.xCandidate),sy=Math.floor(source.y??source.yCandidate);
    if(sx<0||sx>=w||sy<0||sy>=h)return null;
    const tx=target.xCandidate??target.x,ty=target.yCandidate??target.y;if(!Number.isInteger(tx)||!Number.isInteger(ty)||tx<0||tx>=w||ty<0||ty>=h)return null;
    const start=sy*w+sx,end=ty*w+tx,key=`${start}/${end}/${mode}/${s?.world?.revision??0}`;
    let cache=pathCaches.get(data);if(!cache){cache=new Map();pathCaches.set(data,cache);}if(cache.has(key))return cache.get(key);
    const blocked=new Set(grid.blockedCells),speed=i=>grid.coefficients[grid.terrain[i]]?.[mode]||0;
    if(start!==end&&(!speed(end)||blocked.has(end))){cache.set(key,null);return null;}
    const scores=new Float64Array(w*h).fill(Infinity),prev=new Int32Array(w*h).fill(-1),heap=[];
    const push=(node,cost)=>{let i=heap.length;heap.push([node,cost]);while(i){const p=(i-1)>>1;if(heap[p][1]<=cost)break;heap[i]=heap[p];i=p;}heap[i]=[node,cost];};
    const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
    scores[start]=0;push(start,0);
    while(heap.length){const [u,cost]=pop();if(cost!==scores[u])continue;if(u===end)break;
      const x=u%w,y=Math.floor(u/w);
      for(const v of [y>0?u-w:-1,x<w-1?u+1:-1,y<h-1?u+w:-1,x>0?u-1:-1]){
        if(v<0||!speed(v)||(v!==start&&blocked.has(v)))continue;
        const next=cost+10/speed(v);if(next<scores[v]){scores[v]=next;prev[v]=u;push(v,next);}
      }
    }
    let result=null;
    if(Number.isFinite(scores[end])){const cells=[];for(let u=end;u!==-1;u=prev[u]){cells.push(u);if(u===start)break;}cells.reverse();result={cells,cost:scores[end],mode,to};}
    if(cache.size>=256)cache.clear();cache.set(key,result);return result;
  }
  function route(data,from,to){const p=routePlan(data,from,to);return p?(p.cells.length>1?[to]:[]):null;}
  function position(q,data){return q.position||(Number.isInteger(q.originalX10)&&Number.isInteger(q.originalY10)?{x:q.originalX10/10,y:q.originalY10/10}:{x:data.bases[q.at].xCandidate,y:data.bases[q.at].yCandidate});}
  function atBase(q){return !q.position&&(q.originalOrder===undefined||q.originalOrder===2);}
  function transportUnit(q,data){const p=position(q,data),encoded=BattleBridge.encodeUnit(q);return {
    tankId:q.tankId??-1,planeId:q.planeId??-1,cannonId:q.cannonId??-1,
    tankDurability:q.tankDurability??0,planeDurability:q.planeDurability??0,
    moveMode:q.moveMode??0,order:q.originalOrder??2,active:q.active??1,subtype:q.subtype??0,
    x10:Math.round(p.x*10),y10:Math.round(p.y*10),targetBase:q.currentBase??q.at,
    targetX:q.targetX??data.bases[q.route[0]??q.at].xCandidate,targetY:q.targetY??data.bases[q.route[0]??q.at].yCandidate,retreatBase:q.retreatBase??q.at,raw45:q.raw45,destinationBase:q.destinationBase,
    members:Array.from({length:11},(_,slot)=>{const m=q.members.find((m,i)=>(m.originalSlot??i)===slot),rawBytes=Array.from(encoded.slice(85+slot*27,85+(slot+1)*27));return m?{...m,classId:m.classId??m.face,fatigue:m.fatigue??0,rawBytes}:{classId:-1,rawBytes};})};}
  function applyTransport(q,u){
    for(const key of ['tankId','planeId','cannonId','tankDurability','planeDurability','retreatBase','raw45','destinationBase','targetX','targetY','subtype'])if(u[key]!==undefined)q[key]=u[key];
    q.originalX10=u.x10;q.originalY10=u.y10;q.originalOrder=u.order;q.moveMode=u.moveMode;q.currentBase=u.targetBase;
    q.members.forEach((m,i)=>{const n=u.members?.[m.originalSlot??i];if(n){if(n.hp!==undefined)m.hp=n.hp;if(n.fatigue!==undefined)m.fatigue=n.fatigue;}});
    q.stamina=q.members.length?Math.max(0,Math.min(100,100-Math.trunc(q.members.reduce((sum,m)=>sum+(m.fatigue||0),0)/q.members.length))):0;
  }
  function transportData(data,s){if(!data.original?.transport)throw Error('缺少原作交通資料');return s?.world?{...data.original.transport,bases:s.world.bases}:data.original.transport;}
  function movementOptions(s,data,squadId,to){
    const q=s.squads.find(q=>q.id===squadId);if(!q||typeof to!=='object'&&!data.bases[to])throw Error('部隊或目的地不存在');
    const t=transportData(data,s),unit=transportUnit(q,data),current=Transport.baseAt(t.bases,unit.x10,unit.y10),target=typeof to==='object'?Transport.baseAt(t.bases,to.x*10,to.y*10):t.bases.find(b=>b.id===to);
    return Transport.movementOptions(unit,current,target);
  }
  function vehiclesAt(data,baseId){return transportData(data).vehicleShops.filter(shop=>shop.baseId===baseId);}
  function commandAvailability(s,data,squadId){const q=s.squads[squadId],u=transportUnit(q,data),t=transportData(data,s);return Transport.commandAvailability(u,Transport.baseAt(t.bases,u.x10,u.y10),{accessoryRecords:Array.from({length:22},(_,i)=>Combat.originalData.items[40+i])});}
  function transferCommand(s,data,action,q){
    const target=action.target;if(!Number.isInteger(target)||!s.squads[target])throw Error('移交目標部隊不存在');
    const sourceId=q.id,base=q.currentBase??q.at,units=s.squads.map(company=>{
      const raw=StoryBridge.unitBytes(company,data),unit=Transport.decodeUnit(raw);
      unit.members=Array.from({length:11},(_,slot)=>{
        const p=85+slot*27,r=raw.slice(p,p+27),view=new DataView(Uint8Array.from(r).buffer);
        return {classId:view.getInt16(0,true),hp:view.getInt16(2,true),maxHp:view.getInt16(4,true),fatigue:view.getInt16(18,true),formationSlot:r[20],
          weapon:r[21]===255?-1:r[21],armor:r[22]===255?-1:r[22]+23,third:r[23]===255?-1:r[23]+40,thirdCount:r[24],raw25:r[25],raw26:r[26],rawBytes:r,
          nameBytes:s.originalCampaign.slice(0x34D3+12*(company.id*11+slot),0x34D3+12*(company.id*11+slot)+12)};
      });return unit;
    });
    let result;
    if(['tank','plane','cannon'].includes(action.kind))result=Transport.transferVehicle(units,sourceId,target,action.kind,base);
    else if(action.kind==='person')result=Transport.transferPersonnel(units,sourceId,action.fromSlot,target,action.toSlot,base);
    else result=Transport.transferEquipment(units,sourceId,action.fromSlot,target,action.toSlot,action.kind,base,data.items,data.original.transport.equipmentCompatibility);
    if(!result.ok)throw Error(({'not-docked-together':'兩隊必須駐留在同一據點','protected-company-leader':'原作隊長不可移交或取代','untransferable-tank7':'這輛特殊戰車不能移交','empty-source-slot':'來源位置沒有可移交的物品或成員','empty-member-slot':'請選擇兩名有效成員','incompatible-equipment':'成員無法裝備交換後的物品','same-unit':'載具請移交至另一支部隊'})[result.reason]||'目前無法進行這項移交');
    for(const id of new Set([sourceId,target])){
      const company=s.squads[id],unit=result.units[id];
      if(['tank','plane','cannon'].includes(action.kind)){applyTransport(company,unit);continue;}
      const raw=StoryBridge.unitBytes(company,data);
      unit.members.forEach((m,slot)=>{
        const p=85+slot*27;for(let i=0;i<27;i++)raw[p+i]=m.rawBytes[i];
        raw[p+21]=m.weapon<0?255:m.weapon;raw[p+22]=m.armor<0?255:m.armor-23;raw[p+23]=m.third<0?255:m.third-40;raw[p+24]=m.thirdCount;
        const name=0x34D3+12*(id*11+slot);for(let i=0;i<12;i++)s.originalCampaign[name+i]=m.nameBytes[i];
      });
      BattleBridge.applyUnit(company,raw);
      for(const m of company.members){const bytes=unit.members[m.originalSlot].nameBytes,end=bytes.indexOf(0),name=new TextDecoder('big5').decode(Uint8Array.from(end<0?bytes:bytes.slice(0,end))).trim();if(name)m.name=name;}
    }
    record(s,sourceId===target&&action.kind==='person'?`${q.name}調整成員位置 ${action.fromSlot+1} ↔ ${action.toSlot+1}。`:`${q.name}與${s.squads[target].name}完成${action.kind==='person'?'人員':'裝備／載具'}移交。`);
  }
  function equipmentStats(data,member){
    const weapon=data.items.find(x=>x.index===member.weapon&&x.equipmentSlot==='weapon'),armor=data.items.find(x=>x.index===member.armor&&x.equipmentSlot==='armor');
    return {power:weapon?.recoveredStats?.power||0,protection:armor?.recoveredStats?.protection||0};
  }
  function manageStock(s,data,action){
    const q=s.squads[action.squad];if(!q)throw Error('部隊不存在');let result;
    switch(action.type){
      case 'purchaseStock':result=Armory.purchase(s,data,q.id,action.offer,action.quantity??1);record(s,`${q.name}購入${data.items[result.itemId].name} × ${result.quantity}，已收入部隊倉庫，支出 ${result.cost} G。`);break;
      case 'equipStock':result=Armory.equip(s,data,action.fromSquad??q.id,q.id,action.slot,action.item);break;
      case 'unequipStock':result=Armory.unequip(s,data,q.id,action.slot,action.key);break;
      case 'moveStock':result=Armory.moveStock(s,data,q.id,action.target,action.item);break;
      case 'sellStock':result=Armory.sell(s,data,q.id,action.item,action.quantity??1);record(s,`${q.name}出售倉庫物品，收入 ${result.income} G。`);break;
      default:throw Error('不支援的倉庫操作');
    }return result;
  }
  function cheatMoney(s){const amount=Armory.cheat(s);record(s,`密技補給：增加 ${amount.toLocaleString()} G。`);return amount;}
  function offers(data, baseId) {
    const b=data.bases[baseId];if(!b)return [];
    const targets=data.bases.filter(x=>x.index!==baseId&&x.countryIndexCandidate===b.countryIndexCandidate)
      .map(x=>({id:x.index,p:routePlan(data,baseId,x.index)})).filter(x=>x.p?.cells.length>1)
      .sort((a,b)=>a.p.cells.length-b.p.cells.length).map(x=>x.id);
    const list=targets.slice(0,2).map((id,i)=>({id:`delivery-${baseId}-${id}`,kind:'delivery',
      title:['酒壺運送','書籍運送'][i],from:baseId,to:id,reward:8000+Math.round(dist(b,data.bases[id])*600),
      detail:`將委託物送達${data.bases[id].name}。`,days:20}));
    list.push({id:`military-${baseId}`,kind:'battle',title:data.missions[1+(baseId%Math.max(1,data.missions.length-1))]?.text||'戰力補強',
      from:baseId,to:baseId,reward:16000+(baseId%6)*2000,detail:'進入原生戰鬥試作，擊退對手後領取報酬。',days:8});
    return list;
  }
  function step(s,data,hours=1) {
    if(data.original?.transport)return stepOriginal(s,data,hours);
    if(s.ended)return s;
    for(let h=0;h<hours;h++){
      s.hour++;if(s.hour>=24){s.hour=0;s.day++;
        const wage=s.squads.reduce((n,q)=>n+(q.members.length-1)*80,0);s.money=Math.max(0,s.money-wage);
        if(s.day%30===0){const interest=Math.ceil(s.debt*.01);s.debt+=interest;record(s,`試作月結利息 ${interest.toLocaleString()} G。`);}
        const expired=s.taken.filter(m=>m.due<s.day);s.taken=s.taken.filter(m=>m.due>=s.day);
        expired.forEach(m=>record(s,`委託逾期：${m.title}。`));
      }
      s.squads.forEach(q=>{
        if(q.order==='rest'){
          q.stamina=Math.min(100,q.stamina+6);q.members.forEach(m=>m.hp=Math.min(m.maxHp,m.hp+5));
          if(q.stamina===100&&q.members.every(m=>m.hp===m.maxHp)){q.order='idle';record(s,`${q.name}休息完畢。`);}
        }
        if(q.order!=='move'||!q.route.length)return;
        const target=data.bases[q.route[0]],t=q.travel,grid=data.mechanics.movement;
        if(!t){q.order='idle';return;}
        const next=t.cells[t.cursor+1];t.fraction+=(grid.coefficients[grid.terrain[next]][t.mode])/10;q.stamina=Math.max(0,q.stamina-1);
        if(t.fraction>=1-1e-9){t.cursor++;t.fraction=Math.max(0,t.fraction-1);}
        if(t.cursor>=t.cells.length-1){q.at=q.route.shift();q.progress=0;q.position=null;q.travel=null;record(s,`${q.name}抵達${target.name}。`);
          q.order='idle';if(q.originalOrder!==undefined)q.originalOrder=2;
          const done=s.taken.filter(m=>m.squad===q.id&&m.kind==='delivery'&&m.to===q.at);
          done.forEach(m=>complete(s,m));
        }else{const a=t.cells[t.cursor],b=t.cells[t.cursor+1];q.position={x:a%grid.width+(b%grid.width-a%grid.width)*t.fraction,y:Math.floor(a/grid.width)+(Math.floor(b/grid.width)-Math.floor(a/grid.width))*t.fraction};q.progress=(t.cursor+t.fraction)/(t.cells.length-1);}
      });
    }
    return s;
  }
  function stepOriginal(s,data,ticks=1){
    if(s.ended||s.activeBattle?.phase==='active')return s;
    for(let n=0;n<ticks;n++){const event=StoryBridge.tick(s,data);ensureOriginalBattle(s,event);if(!['complete','tick-complete'].includes(event.type))break;}
    return s;
  }
  function legacyPartialWorldStep(s,data,ticks=1){
    const t=transportData(data,s),draw=(low,high)=>low+Math.floor(OriginalRandom(s)*(high-low)/32768);
    for(let n=0;n<ticks;n++){
      s.clock=Transport.clockStep(s.clock||{subtick:0,hour:0});s.hour=s.clock.hour;
      if(s.clock.newDay){s.day++;s.pendingWorldEvents??=[];s.pendingWorldEvents.push({type:'calendar-day'});}
      if(s.clock.hourly){
        s.pendingWorldEvents??=[];s.pendingWorldEvents.push({type:'hourly',hour:s.hour-1});
        for(const q of s.squads){const unit=transportUnit(q,data),repaired=Transport.hourlyRecovery(unit,t.bases.find(b=>b.id===unit.targetBase),t.vehicles,draw);applyTransport(q,repaired);}
      }
      if(s.clock.movement)for(const q of s.squads){
        if(!(q.order==='move'&&q.travel?.original)&&![0,1,6,9].includes(q.originalOrder))continue;
        const motion=Transport.travelLoopStep(transportUnit(q,data),data.mechanics.movement,t.bases),next=motion.unit;
        applyTransport(q,next);
        if(q.travel?.original)q.travel.steps++;
        for(const event of motion.events){
          s.pendingWorldEvents??=[];s.pendingWorldEvents.push({...event,squad:q.id});
          if(event.type==='vehicle-failure-retreat'){q.route=[event.baseId];if(q.travel)q.travel.to=event.baseId;record(s,`${q.name}載具失去耐久，開始退卻。`);}
          if(event.type==='base-arrival'){q.at=event.baseId;q.currentBase=event.baseId;q.position=null;q.travel=null;q.route=[];q.progress=0;q.order='idle';record(s,`${q.name}抵達${data.bases[q.at].name}。`);}
          else if(event.type==='field-arrival'||event.type==='attack-arrival'){q.position={x:next.x10/10,y:next.y10/10};q.travel=null;q.route=[];q.progress=0;q.order='idle';}
        }
        if(q.order==='move'){q.position={x:next.x10/10,y:next.y10/10};q.progress=0;}
      }
    }
    // The story/world dispatcher consumes these on the same native tick. A
    // bounded queue makes incomplete development adapters visibly fail closed.
    if((s.pendingWorldEvents?.length||0)>2048)throw Error('原作世界事件尚未處理，已暫停時鐘');
    return s;
  }
  function OriginalRandom(s){return (typeof module!=='undefined'&&module.exports?require('./original-campaign.js'):scope.OriginalCampaign).random32768(s);}
  function complete(s,mission){s.money+=mission.reward;s.rep++;s.completed.push(mission.id);s.taken=s.taken.filter(m=>m.id!==mission.id);record(s,`委託完成：${mission.title}，取得 ${mission.reward.toLocaleString()} G。`);}
  function command(s,data,action){
    const q=s.squads.find(q=>q.id===action.squad);if(!q&&!['repay'].includes(action.type))throw Error('找不到部隊');
    if(s.ended)throw Error('戰役已結束');
    if(q?.active===0)throw Error('這支部隊目前無法指揮');
    if(s.activeBattle?.phase==='active')throw Error('請先完成目前的戰鬥');
    if(s.mode==='native-original'&&s.story?.event&&!['complete','tick-complete'].includes(s.story.event.type))throw Error('請先完成目前的原作事件');
    if(s.mode==='native-original'){
      const permission={move:'move',moveToPoint:'move',scoutBase:'scout',stop:'standby',rest:'rest',formation:'formation',enterBase:'enterBase',retreatTravel:'retreat',occupy:'occupy',attackSettings:'attackSettings'}[action.type];
      if(permission&&!commandAvailability(s,data,q.id)[permission])throw Error('依原作規則，部隊目前無法執行這項指令');
    }
    if(s.mode==='native-original'&&['accept','hire','buy','heal','repay'].includes(action.type))throw Error('請從原作城鎮選單或銀行選項進行這項操作');
    switch(action.type){
      case 'scoutBase':
      case 'moveToPoint':
      case 'move': {
        const field=action.type==='moveToPoint',target=field?{xCandidate:action.x,yCandidate:action.y}:data.bases[action.to];
        if(field?(!Number.isInteger(action.x)||!Number.isInteger(action.y)||action.x<0||action.x>=128||action.y<0||action.y>=96):(!Number.isInteger(action.to)||!target))throw Error('目的地不存在');
        if(q.order==='move'&&!data.original)throw Error('部隊行軍中，請先停止');
        if(s.mode==='native-original'&&q.tankId===7&&!action.specialTankHookApplied){
          s.pendingNativeCommand={...action,specialTankHookApplied:true};const event=StoryBridge.dispatch(s,data,{entry:{token:0xBB0,export:0xE8},args:[q.id]});
          if(event.type==='complete'){const pending=s.pendingNativeCommand;delete s.pendingNativeCommand;return command(s,data,pending);}return s;
        }
        const mode=action.mode??0;
        if(data.original?.transport){const unit=transportUnit(q,data),bases=transportData(data,s).bases,options=field?Transport.movementOptions(unit,Transport.baseAt(bases,unit.x10,unit.y10),Transport.baseAt(bases,action.x*10,action.y*10)):movementOptions(s,data,q.id,action.to);if(options.requiresSpecialTankHook&&!action.specialTankHookApplied)throw Error('特殊戰車需先處理原作劇情事件');if(!options.choices.includes(mode))throw Error('此部隊不符合所選交通方式');}
        else if(mode!==0)throw Error('缺少原作交通資料');
        const origin=position(q,data);
        if(data.original?.transport){
          const order=action.type==='scoutBase'?6:0;if(order===6&&transportData(data,s).bases[action.to].kind!==2)throw Error('此據點目前不是原作可偵察的目標');
          if([1,2].includes(q.subtype)&&!action.taskInterruptionApproved){
            s.pendingNativeCommand={...action,taskInterruptionApproved:true};s.pendingNativeCommandRequiresZero=true;
            const event=StoryBridge.dispatch(s,data,{entry:{token:0xBD8,export:0x2A},args:[q.id]});
            if(event.type==='complete'){const pending=s.pendingNativeCommand;delete s.pendingNativeCommand;delete s.pendingNativeCommandRequiresZero;if(event.registers.ax===0)return command(s,data,pending);}return s;
          }
          const context={order,specialTankHookApplied:action.specialTankHookApplied,taskInterruptionApproved:action.taskInterruptionApproved},unit=transportUnit(q,data),grid=movementGrid(s,data),bases=transportData(data,s).bases;
          const started=order===6?Transport.beginMoveCommand(unit,grid,bases,action.to,mode,context):Transport.fieldMoveCommand(unit,grid,bases,target.xCandidate,target.yCandidate,mode,context);
          if(!started.ok)throw Error('原作地形、封鎖或交通條件使此處無法通行');applyTransport(q,started.unit);
          q.fieldDestination=field?{x:action.x,y:action.y}:null;q.travel={original:true,mode,to:field?null:action.to,steps:1};
        }else{const p=routePlan(data,origin,action.to,mode);if(p===null)throw Error('此處地形或據點封鎖無法以所選方式通過');if(p.cells.length<2)throw Error('已在此處');q.travel={cells:[...p.cells],cursor:0,fraction:0,mode,to:action.to};}
        q.retreatBase??=q.at;q.moveMode=mode;q.originalOrder=action.type==='scoutBase'?6:0;q.route=field?[]:[action.to];q.progress=0;q.position=data.original?{x:q.originalX10/10,y:q.originalY10/10}:origin;q.order='move';record(s,`${q.name}以${Transport.LABELS[mode]}向${field?'地圖座標 '+action.x+'，'+action.y:target.name}出發。`);break;
      }
      case 'occupy':
      case 'attackSettings':{
        const entry=action.type==='occupy'?{token:0xBD8,export:0x7A}:{token:0xBD8,export:0x43};let event=StoryBridge.dispatch(s,data,{entry,args:[q.id]});
        if(action.type==='occupy'&&event.type==='choice'){const occupy=event.options.find(o=>o.text.trim()==='占領');if(occupy)event=StoryBridge.resume(s,data,{value:occupy.id});}
        return s;
      }
      case 'vehicleBuy':
      case 'vehicleSell': {
        if(q.order==='move'||!atBase(q))throw Error('請先抵達城鎮再交易載具');
        const t=transportData(data),stock=vehiclesAt(data,q.at).find(shop=>shop.slot===action.slot);
        if(!stock)throw Error('此處沒有該載具商店');
        if(s.mode==='native-original'){
          const town=StoryBridge.townActions(s,data,q.id).actions.find(a=>a.id===64);
          if(!town)throw Error('此處沒有原作商店入口');
          const menu=StoryBridge.dispatch(s,data,town.activateTask);
          if(menu.type!=='choice'||!menu.options.some(o=>o.id===stock.slot))throw Error('原作載具商店入口不符');
          StoryBridge.resume(s,data,{value:stock.slot});return s;
        }
        const quote=Transport.tradeQuote(transportUnit(q,data),t.vehicles,stock.kind,action.type==='vehicleSell'?null:stock.typeId,s.storyByte20??0);
        const result=Transport.applyTrade(transportUnit(q,data),s.money,quote);
        if(!result.ok)throw Error(({ 'story-locked-tank':'這輛戰車受到原作劇情限制','empty-slot':'部隊沒有可出售的同類載具','insufficient-funds':'資金不足'})[result.reason]||'無法完成載具交易');
        s.money=result.money;for(const key of ['tankId','planeId','cannonId','tankDurability','planeDurability'])q[key]=result.unit[key];
        record(s,`${q.name}${action.type==='vehicleSell'?'出售載具':'購入或換購'+t.vehicles.find(v=>v.kind===stock.kind&&v.typeId===stock.typeId).name}，${quote.cost<0?'收入':'支出'} ${Math.abs(quote.cost).toLocaleString()} G。`);break;
      }
      case 'transfer':transferCommand(s,data,action,q);break;
      case 'ferry': {
        if(q.order==='move'||!atBase(q))throw Error('請先抵達渡場');
        const result=Transport.boardFerry(transportUnit(q,data),q.at,transportData(data).bases);
        if(!result.ok)throw Error('此處沒有原作渡船航線');
        applyTransport(q,result.unit);q.at=result.destination;q.position=null;q.travel=null;q.route=[];q.progress=0;q.order='idle';
        record(s,`${q.name}搭乘渡船抵達${data.bases[q.at].name}。`);break;
      }
      case 'stop': {const p=position(q,data);if(data.original){const result=Transport.standbyCommand(transportUnit(q,data));if(!result.ok)throw Error('飛行中只能退卻，不能停止或休息');applyTransport(q,result.unit);q.position={...p};}else{const town=data.bases.find(b=>Math.abs(b.xCandidate-p.x)<1e-8&&Math.abs(b.yCandidate-p.y)<1e-8);q.position=town?null:{...p};if(town)q.at=town.index;}q.route=[];q.travel=null;q.progress=0;q.order='idle';break;}
      case 'rest':{if(data.original){const result=Transport.restCommand(transportUnit(q,data));if(!result.ok)throw Error('飛行中不能休息');applyTransport(q,result.unit);q.position={...position(q,data)};q.route=[];q.travel=null;q.progress=0;}else if(q.order==='move')throw Error('請先停止行軍');q.order='rest';break;}
      case 'enterBase':{const result=Transport.enterBaseCommand(transportUnit(q,data),transportData(data,s).bases);if(!result.ok)throw Error('附近沒有可進入的原作據點，或部隊仍在飛行');applyTransport(q,result.unit);q.at=result.baseId;q.position=null;q.order='idle';q.route=[];q.travel=null;q.progress=0;break;}
      case 'retreatTravel':{const result=Transport.retreatCommand(transportUnit(q,data),transportData(data,s).bases,movementGrid(s,data),action.to??q.retreatBase);if(!result.ok)throw Error('無法以目前交通方式退卻至此據點');applyTransport(q,result.unit);q.position={x:result.unit.x10/10,y:result.unit.y10/10};q.order='move';q.route=[result.baseId];q.travel={original:true,mode:q.moveMode,to:result.baseId,steps:0};q.progress=0;break;}
      case 'accept': {
        if(q.order==='move'||!atBase(q))throw Error('請先抵達城鎮再承接委託');
        const m=offers(data,q.at).find(m=>m.id===action.id);if(!m)throw Error('委託不存在');
        if(s.taken.some(x=>x.id===m.id)||s.completed.includes(m.id))throw Error('已承接或已完成');
        if(s.taken.some(x=>x.squad===q.id))throw Error('請先完成本隊目前的委託');
        s.taken.push({...m,squad:q.id,due:s.day+m.days});record(s,`${q.name}承接${m.title}。`);break;
      }
      case 'hire': {
        if(q.order==='move'||!atBase(q))throw Error('請先抵達城鎮再雇用');
        if(q.members.length>=11)throw Error('部隊已滿（原作11人）');
        const c=data.classes.find(c=>c.index===action.classId);if(!c||c.index<6)throw Error('兵種不存在');
        const cost=1200+c.index*70;if(s.money<cost)throw Error('資金不足');
        s.money-=cost;q.members.push({name:c.name,face:c.index,hp:45,maxHp:45,attack:9+c.index%12,defense:4+c.index%6,weapon:null,armor:null});record(s,`${q.name}雇用了${c.name}。`);break;
      }
      case 'buy': {
        if(q.order==='move'||!atBase(q))throw Error('請先抵達城鎮再購物');
        const item=(data.items||[]).find(i=>i.index===action.item);if(!item)throw Error('商品不存在');
        const recipient=action.member??0;if(!Number.isInteger(recipient)||!q.members[recipient])throw Error('裝備對象不存在');
        if(!['weapon','armor'].includes(item.equipmentSlot))throw Error('這項物品的使用方式尚未開放');
        const cost=item.priceCandidate;if(!Number.isSafeInteger(cost)||cost<=0||s.money<cost)throw Error('資金不足或價格未確認');
        s.money-=cost;s.inventory.push(item.index);q.members[recipient][item.equipmentSlot]=item.index;if(recipient===0&&item.equipmentSlot==='weapon')q.equipment=item.index;record(s,`${q.members[recipient].name}裝備了${item.name}。`);break;
      }
      case 'formation':if(!Number.isInteger(action.value)||action.value<0||action.value>=Combat.originalData.formations.length)throw Error('陣形無效');q.formation=action.value;break;
      case 'heal': {
        if(q.order==='move'||!atBase(q))throw Error('請先抵達城鎮再就醫');
        const cost=q.members.reduce((n,m)=>n+(m.maxHp-m.hp)*12,0);if(s.money<cost)throw Error('資金不足');
        s.money-=cost;q.members.forEach(m=>m.hp=m.maxHp);q.stamina=100;record(s,`${q.name}完成治療。`);break;
      }
      case 'repay':{
        if(!Number.isSafeInteger(action.amount)||action.amount<=0)throw Error('還款金額無效');
        const amt=Math.min(s.debt,action.amount);if(s.money<amt)throw Error('資金不足');
        s.money-=amt;s.debt-=amt;record(s,`償還 ${amt.toLocaleString()} G。`);if(!s.debt){s.ended='won';record(s,'測試戰役：債務清償。');}break;
      }
      default:throw Error('未知指令');
    }
    return s;
  }
  function beginBattle(s,data,squadId){
    const q=s.squads.find(q=>q.id===squadId);if(!q||q.order==='move'||!atBase(q))throw Error('部隊不可出擊');
    if(!s.taken.some(m=>m.squad===q.id&&m.kind==='battle'&&m.to===q.at))throw Error('請先承接軍事委託');
    if(!q.members.some(m=>m.hp>0))throw Error('請先治療部隊');
    const count=3+Math.min(4,Math.floor(s.rep/3));
    const b={squad:squadId,time:0,turn:0,phase:'active',log:[],reward:0,
      allies:q.members.map((m,i)=>({...m,...equipmentStats(data,m),id:i,side:'ally'})),
      enemies:Array.from({length:count},(_,i)=>({id:i,name:'武裝盜賊',face:31,hp:30,maxHp:30,attack:8,defense:3,side:'enemy'}))};
    b.log.push('部隊展開。戰鬥計算採重製測試規則。');return b;
  }
  function beginOriginalBattle(s,data,squadId,encounterBytes,options={}){
    const q=s.squads.find(q=>q.id===squadId);if(!q)throw Error('部隊不存在');
    if(s.activeBattle?.phase==='active')throw Error('已有進行中的原作戰鬥');
    if(!encounterBytes||encounterBytes.length!==81)throw Error('原作遭遇資料不完整');
    const battle=BattleBridge.create(s,q,encounterBytes,options);s.activeBattle=BattleBridge.snapshot(battle);return battle;
  }
  function ensureOriginalBattle(s,event){
    if(event?.type!=='battle')return;
    const key=JSON.stringify([s.story?.eventSerial,event.source,event.sequence,event.partyId,event.encounterPointer,event.randomSeed]);
    if(s.activeBattle?.storyEventKey===key)return;
    if(s.activeBattle?.phase==='active')throw Error('原作戰鬥事件與存檔不一致');
    const q=s.squads[event.partyId];if(!q||event.encounterBytes?.length!==81)throw Error('原作戰鬥資料不完整');
    const battle=BattleBridge.create(s,q,event.encounterBytes,{unitBytes:event.unitBytes,friendlyFormationId:event.friendlyFormationId,background:event.background});battle.storyEventKey=key;s.activeBattle=BattleBridge.snapshot(battle);
  }
  function battleStep(s,b){
    if(b.original){const before=b.phase;BattleBridge.step(s,s.squads[b.squad],b);s.activeBattle=BattleBridge.snapshot(b);if(before==='active'&&b.phase!=='active')record(s,`${s.squads[b.squad].name}${b.phase==='won'?'獲勝，取得 '+b.reward.toLocaleString()+' G。':'戰鬥結束。'}`);return b;}
    if(b.phase!=='active')return b;
    b.turn++;b.time++;
    const q=s.squads[b.squad];
    for(const side of ['allies','enemies']){
      const own=b[side].filter(m=>m.hp>0),targets=b[side==='allies'?'enemies':'allies'].filter(m=>m.hp>0);
      for(const m of own){
        if(!targets.some(m=>m.hp>0))break;
        const target=targets.find(m=>m.hp>0);
        const bonus=side==='allies'?(q.formation===1?4:0)+(m.power||0):0;
        const defense=side==='enemies'?(q.formation===2?4:0)+(target.protection||0):0;
        const hit=Math.max(1,Math.floor(m.attack+bonus-target.defense-defense+rng(s)*6));
        target.hp=Math.max(0,target.hp-hit);b.log.unshift(`${m.name} → ${target.name}　${hit} 損害`);
      }
    }
    b.log=b.log.slice(0,25);
    if(!b.enemies.some(m=>m.hp>0))finishBattle(s,b,true);
    else if(!b.allies.some(m=>m.hp>0))finishBattle(s,b,false);
    return b;
  }
  function finishBattle(s,b,win){
    if(b.original){if(b.phase==='active'&&b.core.leaderDown){s.activeBattle=BattleBridge.snapshot(b);return;}const result=BattleBridge.command(b,{type:'retreat'});if(!result?.accepted&&result?.reason!=='leader-already-leaving')throw Error('部隊目前無法下達撤退');s.activeBattle=BattleBridge.snapshot(b);return;}
    if(b.phase!=='active')return;
    b.phase=win?'won':'lost';
    const q=s.squads[b.squad];q.members.forEach((m,i)=>m.hp=Math.max(1,b.allies[i].hp));
    q.stamina=Math.max(0,q.stamina-20);
    const mission=s.taken.find(m=>m.squad===q.id&&m.kind==='battle');
    if(win&&mission){b.reward=mission.reward;complete(s,mission);q.kills+=b.enemies.length;}
    else record(s,`${q.name}撤退，請整備後再出擊。`);
  }
  function validateSave(value,data){
    if(!value||![1,2,3,VERSION].includes(value.version)||!['native-playtest','native-original'].includes(value.mode)||!Array.isArray(value.squads)||value.squads.length!==6)throw Error('不是相容的 Web 存檔');
    value=clone(value);const legacy=value.version===1;value.version=VERSION;
    for(const k of ['money','debt','day','hour','rep','seed'])if(!Number.isSafeInteger(value[k])||value[k]<0||value[k]>1e12)throw Error('存檔數值無效');
    if(value.hour>25||!Array.isArray(value.log)||!Array.isArray(value.taken)||!Array.isArray(value.completed)||!Array.isArray(value.inventory))throw Error('存檔結構無效');
    if(value.ended!==null&&!['won','quit'].includes(value.ended))throw Error('戰役狀態無效');
    if(value.clock&&(!Number.isInteger(value.clock.subtick)||value.clock.subtick<0||value.clock.subtick>250||!Number.isInteger(value.clock.hour)||value.clock.hour<0||value.clock.hour>25))throw Error('原作時鐘無效');
    if(value.ledger&&(!Array.isArray(value.ledger)||value.ledger.length!==96||value.ledger.some(n=>!Number.isSafeInteger(n)||n<0||n>0xffffffff)))throw Error('原作帳目無效');
    if(value.activeBattle)BattleBridge.validateSnapshot(value.activeBattle);
    if(value.cheatsUsed!==undefined&&(!Number.isSafeInteger(value.cheatsUsed)||value.cheatsUsed<0))throw Error('密技紀錄無效');
    if(value.mode==='native-original'){StoryBridge.validate(value,data);Economy.configure(value);}
    value.squads.forEach((q,i)=>{
      Armory.validate(q,data);Heraldry.normalize(q);
      if(q.id!==i||!Number.isInteger(q.at)||!data.bases[q.at]||!Array.isArray(q.members)||!q.members.length||q.members.length>12)throw Error('部隊資料無效');
      if(!['idle','move','rest'].includes(q.order)||!Array.isArray(q.route)||q.route.some(v=>!Number.isInteger(v)||!data.bases[v]))throw Error('行軍資料無效');
      if(legacy){q.position=null;q.travel=null;q.route=[];q.progress=0;if(q.order==='move')q.order='idle';}
      if(q.position!==null&&(!q.position||!Number.isFinite(q.position.x)||!Number.isFinite(q.position.y)||q.position.x<0||q.position.x>=128||q.position.y<0||q.position.y>=96))throw Error('野外座標無效');
      if(q.order==='move'){
        const t=q.travel,g=data.mechanics.movement;
        if(t?.original){
          const field=q.fieldDestination,fieldValid=t.to===null&&q.route.length===0&&field&&Number.isInteger(field.x)&&Number.isInteger(field.y)&&field.x>=0&&field.x<128&&field.y>=0&&field.y<96;
          if(!data.original?.transport||!q.position||!(fieldValid||(q.route.length===1&&t.to===q.route[0]))||!Number.isInteger(t.mode)||t.mode<0||t.mode>2||q.moveMode!==t.mode||!Number.isSafeInteger(t.steps)||t.steps<0)throw Error('原作行軍存檔無效');
        }else{
        if(!t||!q.position||q.route.length!==1||t.to!==q.route[0]||!Number.isInteger(t.mode)||t.mode<0||t.mode>2||!Array.isArray(t.cells)||t.cells.length<2||t.cells.length>g.width*g.height||!Number.isInteger(t.cursor)||t.cursor<0||t.cursor>=t.cells.length-1||!Number.isFinite(t.fraction)||t.fraction<0||t.fraction>=1)throw Error('地形行軍存檔無效');
        if(t.cells.some((c,j)=>!Number.isInteger(c)||c<0||c>=g.width*g.height||!g.coefficients[g.terrain[c]][t.mode]||(j>0&&Math.abs(c%g.width-t.cells[j-1]%g.width)+Math.abs(Math.floor(c/g.width)-Math.floor(t.cells[j-1]/g.width))!==1)))throw Error('地形路徑無效');
        const dest=data.bases[t.to];if(t.cells[t.cells.length-1]!==dest.yCandidate*g.width+dest.xCandidate)throw Error('行軍終點無效');
        }
      }else if(q.travel!==null)throw Error('行軍狀態無效');
      if(!Number.isFinite(q.progress)||q.progress<0||q.progress>=1||!Number.isFinite(q.stamina)||q.stamina<0||q.stamina>100)throw Error('部隊狀態無效');
      if(!Number.isInteger(q.formation)||q.formation<0||q.formation>=Combat.originalData.formations.length||typeof q.name!=='string'||q.name.length>100||typeof q.leader!=='string')throw Error('部隊資料無效');
      for(const key of ['tankId','planeId','cannonId'])if(q[key]!==undefined&&(!Number.isInteger(q[key])||q[key]<-1||q[key]>7))throw Error('載具資料無效');
      for(const key of ['tankDurability','planeDurability'])if(q[key]!==undefined&&(!Number.isSafeInteger(q[key])||q[key]<0||q[key]>65535))throw Error('載具耐久無效');
      if(q.moveMode!==undefined&&(!Number.isInteger(q.moveMode)||q.moveMode<0||q.moveMode>2))throw Error('交通方式無效');
      for(const[key,upper]of [['originalX10',1280],['originalY10',960]])if(q[key]!==undefined&&(!Number.isInteger(q[key])||q[key]<0||q[key]>=upper))throw Error('原作十分座標無效');
      if(q.originalUnit&&(!Array.isArray(q.originalUnit)||q.originalUnit.length!==382||q.originalUnit.some(n=>!Number.isInteger(n)||n<0||n>255)))throw Error('原作部隊紀錄無效');
      if(q.originalOrder!==undefined&&(!Number.isInteger(q.originalOrder)||q.originalOrder<0||q.originalOrder>9))throw Error('原作部隊命令無效');
      if(data.original?.transport&&q.order==='move'&&!q.travel.original){const p=position(q,data);q.originalX10=Math.round(p.x*10);q.originalY10=Math.round(p.y*10);q.moveMode=q.travel.mode;q.travel={original:true,mode:q.moveMode,to:q.route[0],steps:0};}
      q.members.forEach((m,j)=>{for(const k of ['hp','maxHp','attack','defense'])if(!Number.isFinite(m[k])||m[k]<0||m[k]>1000000)throw Error('成員能力無效');if(typeof m.name!=='string'||m.name.length>100||m.hp>m.maxHp)throw Error('成員資料無效');
        if(legacy){m.weapon=null;m.armor=null;const old=data.items.find(x=>x.index===q.equipment);if(j===0&&old?.equipmentSlot)m[old.equipmentSlot]=old.index;}
        for(const slot of ['weapon','armor'])if(m[slot]!==null&&!data.items.some(x=>x.index===m[slot]&&x.equipmentSlot===slot))throw Error('裝備資料無效');
        if(value.mode==='native-original'&&(m.consumable!==null&&(!Number.isInteger(m.consumable)||m.consumable<40||m.consumable>61)||!Number.isInteger(m.consumableCount)||m.consumableCount<0||m.consumableCount>255))throw Error('持物資料無效');
      });
      if(value.mode==='native-original'){const slots=q.members.map(m=>m.originalSlot);if(slots.some(n=>!Number.isInteger(n)||n<0||n>10)||new Set(slots).size!==slots.length)throw Error('原作成員槽位無效');}
    });
    value.taken.forEach(m=>{if(!m||typeof m.id!=='string'||typeof m.title!=='string'||!['battle','delivery'].includes(m.kind)||!Number.isInteger(m.squad)||!value.squads[m.squad]||!data.bases[m.to]||!Number.isSafeInteger(m.reward)||m.reward<0||m.reward>1e9||!Number.isSafeInteger(m.due))throw Error('委託資料無效');});
    value.log.forEach(e=>{if(!e||typeof e.text!=='string'||e.text.length>1000||!Number.isSafeInteger(e.day))throw Error('紀錄資料無效');});
    return clone(value);
  }
  function restoreOriginalBattle(s){ensureOriginalBattle(s,s.story?.event);return s.activeBattle?BattleBridge.restore(s,s.activeBattle):null;}
  // Web recovery: run only after the source loss story has completed. Keep
  // casualties and equipment; a downed protagonist returns with one HP.
  function recoverDefeatedCompany(s,data){
    const b=s.activeBattle,event=s.story?.event,key=b?.storyEventKey;
    if(s.mode!=='native-original'||s.ended||!b?.settled||b.phase!=='lost'||!key||s.recoveredBattleKey===key||!['complete','tick-complete'].includes(event?.type))return null;
    const q=s.squads[b.squad];if(!q||q.active!==1)return null;
    const leaders=q.members.filter(m=>(m.classId??m.face)<=5),needsRecovery=leaders.some(m=>m.hp<=0||(m.fatigue??0)>=100)||q.originalOrder===1||q.originalOrder===9;
    if(!needsRecovery){s.recoveredBattleKey=key;return null;}
    const safe=id=>Number.isInteger(id)&&data.bases[id]&&[0,1,4].includes(s.world?.bases[id]?.kind??data.original.transport.bases[id]?.kind);
    let base=[q.lastSafeBase,q.at,q.retreatBase,44].find(safe);
    if(base===undefined){const point=position(q,data);base=data.bases.filter(x=>safe(x.index)).sort((a,b)=>Math.hypot(a.xCandidate-point.x,a.yCandidate-point.y)-Math.hypot(b.xCandidate-point.x,b.yCandidate-point.y))[0]?.index;}
    if(base===undefined)return null;
    const target=data.bases[base];for(const m of leaders){if(m.hp<=0)m.hp=1;m.fatigue=Math.min(m.fatigue??0,90);}
    Object.assign(q,{at:base,currentBase:base,lastSafeBase:base,retreatBase:base,destinationBase:base,raw45:base,targetX:target.xCandidate,targetY:target.yCandidate,originalX10:target.xCandidate*10,originalY10:target.yCandidate*10,originalOrder:2,moveMode:0,subtype:0,order:'idle',position:null,route:[],travel:null,fieldDestination:null,progress:0});
    s.recoveredBattleKey=key;StoryBridge.synchronize(s,data);record(s,`${q.name}戰敗後撤回${target.name}；倒下的隊長以 1 HP 恢復，請駐留休養或到病院治療。`);
    return {squad:q.id,base};
  }
  function storyEvent(s,data,request){if(s.ended)throw Error('戰役已結束，可重看片尾或建立新戰役');const event=StoryBridge.dispatch(s,data,request);ensureOriginalBattle(s,event);return event;}
  function storyResume(s,data,response){const event=StoryBridge.resume(s,data,response);if(event.type==='complete'&&s.pendingNativeCommand){const pending=s.pendingNativeCommand,allowed=!s.pendingNativeCommandRequiresZero||event.registers.ax===0;delete s.pendingNativeCommand;delete s.pendingNativeCommandRequiresZero;if(allowed)command(s,data,pending);}const current=s.story?.event||event;ensureOriginalBattle(s,current);recoverDefeatedCompany(s,data);return current;}
  function battleCommand(s,b,input){const result=BattleBridge.command(b,input);s.activeBattle=BattleBridge.snapshot(b);return result;}
  function townActions(s,data,partyId){return StoryBridge.townActions(s,data,partyId);}
  function countryAt(s,x,y){return StoryBridge.countryAt(s,x,y);}
  const api={VERSION,newGame,route,routePlan,movementGrid,position,atBase,transportUnit,movementOptions,commandAvailability,vehiclesAt,equipmentStats,offers,step,command,manageStock,cheatMoney,beginBattle,beginOriginalBattle,restoreOriginalBattle,recoverDefeatedCompany,battleStep,finishBattle,battleCommand,storyEvent,storyResume,townActions,countryAt,validateSave,clone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.HREngine=api;
})(typeof window==='undefined'?globalThis:window);
