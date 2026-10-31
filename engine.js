/* Native browser engine. Rules in this file are playtest rules, NOT recovered original formulas. */
(function (scope) {
  'use strict';
  const VERSION = 1;
  const clone = value => JSON.parse(JSON.stringify(value));
  const dist = (a,b) => Math.hypot(a.xCandidate-b.xCandidate,a.yCandidate-b.yCandidate);
  function rng(s) {s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  function record(s,text) {s.log.unshift({day:s.day,text});s.log=s.log.slice(0,80);}
  function newGame(data, seed=1496) {
    const starts=[0,3,25,44,57,64];
    const s={version:VERSION,mode:'native-playtest',day:1,hour:8,money:150000,debt:2500000,
      seed:seed>>>0,rep:0,completed:[],taken:[],inventory:[],log:[],ended:null,squads:[]};
    s.squads=data.companies.map((c,i)=>({id:i,name:c.name,leader:c.leader,face:i,
      at:starts[i],route:[],progress:0,order:'idle',members:[{name:c.leader,face:i,hp:100,maxHp:100,attack:18+i,defense:7}],
      stamina:100,formation:0,equipment:null,kills:0}));
    record(s,'原生重製測試戰役開始。經濟、行軍、戰鬥與任務規則尚待原版對拍。');
    return s;
  }
  function route(data, from, to) {
    if(from===to) return [];
    const n=data.bases.length, scores=Array(n).fill(Infinity), prev=Array(n).fill(-1), todo=new Set([from]);
    scores[from]=0;
    // Original far-pointer adjacency candidates, symmetrized. No invented nearest-neighbor roads.
    const edges=Array.from({length:n},()=>new Set());
    data.bases.forEach(b=>(b.relatedBasePointerCandidates||[]).forEach(j=>{
      if(Number.isInteger(j)&&j>=0&&j<n&&j!==b.index){edges[b.index].add(j);edges[j].add(b.index);}
    }));
    while(todo.size){
      const u=[...todo].reduce((a,b)=>scores[a]<scores[b]?a:b);todo.delete(u);
      if(u===to) break;
      for(const v of edges[u]){
        const alt=scores[u]+Math.max(1,dist(data.bases[u],data.bases[v]));
        if(alt<scores[v]){scores[v]=alt;prev[v]=u;todo.add(v);}
      }
    }
    if(!Number.isFinite(scores[to])) return null;
    const p=[];for(let v=to;v!==from;v=prev[v]) p.unshift(v);
    return p;
  }
  function offers(data, baseId) {
    const b=data.bases[baseId];if(!b)return [];
    const targets=(b.relatedBasePointerCandidates||[]).filter(id=>id!==baseId&&data.bases[id]);
    // For cities with no observed link, retain no travel offer rather than invent a road.
    const list=targets.slice(0,2).map((id,i)=>({id:`delivery-${baseId}-${id}`,kind:'delivery',
      title:['酒壺運送','書籍運送'][i],from:baseId,to:id,reward:8000+Math.round(dist(b,data.bases[id])*600),
      detail:`將委託物送達${data.bases[id].name}。`,days:20}));
    list.push({id:`military-${baseId}`,kind:'battle',title:data.missions[1+(baseId%Math.max(1,data.missions.length-1))]?.text||'戰力補強',
      from:baseId,to:baseId,reward:16000+(baseId%6)*2000,detail:'進入原生戰鬥試作，擊退對手後領取報酬。',days:8});
    return list;
  }
  function step(s,data,hours=1) {
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
        const target=data.bases[q.route[0]],src=data.bases[q.at];
        q.progress+=1/Math.max(1,Math.ceil(dist(src,target)/4));q.stamina=Math.max(0,q.stamina-1);
        if(q.progress>=1){q.at=q.route.shift();q.progress=0;record(s,`${q.name}抵達${target.name}。`);
          if(!q.route.length)q.order='idle';
          const done=s.taken.filter(m=>m.squad===q.id&&m.kind==='delivery'&&m.to===q.at);
          done.forEach(m=>complete(s,m));
        }
      });
    }
    return s;
  }
  function complete(s,mission){s.money+=mission.reward;s.rep++;s.completed.push(mission.id);s.taken=s.taken.filter(m=>m.id!==mission.id);record(s,`委託完成：${mission.title}，取得 ${mission.reward.toLocaleString()} G。`);}
  function command(s,data,action){
    const q=s.squads.find(q=>q.id===action.squad);if(!q&&!['repay'].includes(action.type))throw Error('找不到部隊');
    if(s.ended)throw Error('戰役已結束');
    switch(action.type){
      case 'move': {
        if(!Number.isInteger(action.to)||!data.bases[action.to])throw Error('目的地不存在');
        if(q.order==='move')throw Error('部隊行軍中，請先停止');
        const p=route(data,q.at,action.to);if(p===null)throw Error('尚無可確認的連線路徑');
        if(!p.length)throw Error('已在此處');
        q.route=p;q.progress=0;q.order='move';record(s,`${q.name}向${data.bases[action.to].name}出發。`);break;
      }
      case 'stop': q.route=[];q.progress=0;q.order='idle';break;
      case 'rest':if(q.order==='move')throw Error('請先停止行軍');q.order='rest';break;
      case 'accept': {
        if(q.order==='move')throw Error('行軍中無法承接委託');
        const m=offers(data,q.at).find(m=>m.id===action.id);if(!m)throw Error('委託不存在');
        if(s.taken.some(x=>x.id===m.id)||s.completed.includes(m.id))throw Error('已承接或已完成');
        if(s.taken.some(x=>x.squad===q.id))throw Error('請先完成本隊目前的委託');
        s.taken.push({...m,squad:q.id,due:s.day+m.days});record(s,`${q.name}承接${m.title}。`);break;
      }
      case 'hire': {
        if(q.order==='move')throw Error('行軍中無法雇用');
        if(q.members.length>=12)throw Error('部隊已滿（12人）');
        const c=data.classes.find(c=>c.index===action.classId);if(!c||c.index<6)throw Error('兵種不存在');
        const cost=1200+c.index*70;if(s.money<cost)throw Error('資金不足');
        s.money-=cost;q.members.push({name:c.name,face:c.index,hp:45,maxHp:45,attack:9+c.index%12,defense:4+c.index%6});record(s,`${q.name}雇用了${c.name}。`);break;
      }
      case 'buy': {
        if(q.order==='move')throw Error('行軍中無法購物');
        const item=(data.items||[]).find(i=>i.index===action.item);if(!item)throw Error('商品不存在');
        const cost=item.priceCandidate;if(!Number.isSafeInteger(cost)||cost<=0||s.money<cost)throw Error('資金不足或價格未確認');
        s.money-=cost;s.inventory.push(item.index);q.equipment=item.index;record(s,`${q.name}購買了${item.name}。`);break;
      }
      case 'formation':if(!Number.isInteger(action.value)||action.value<0||action.value>2)throw Error('陣形無效');q.formation=action.value;break;
      case 'heal': {
        if(q.order==='move')throw Error('行軍中無法就醫');
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
    const q=s.squads.find(q=>q.id===squadId);if(!q||q.order==='move')throw Error('部隊不可出擊');
    if(!s.taken.some(m=>m.squad===q.id&&m.kind==='battle'&&m.to===q.at))throw Error('請先承接軍事委託');
    if(!q.members.some(m=>m.hp>0))throw Error('請先治療部隊');
    const count=3+Math.min(4,Math.floor(s.rep/3));
    const b={squad:squadId,time:0,turn:0,phase:'active',log:[],reward:0,
      allies:q.members.map((m,i)=>({...m,id:i,side:'ally'})),
      enemies:Array.from({length:count},(_,i)=>({id:i,name:'武裝盜賊',face:31,hp:30,maxHp:30,attack:8,defense:3,side:'enemy'}))};
    b.log.push('部隊展開。戰鬥計算採重製測試規則。');return b;
  }
  function battleStep(s,b){
    if(b.phase!=='active')return b;
    b.turn++;b.time++;
    const q=s.squads[b.squad];
    for(const side of ['allies','enemies']){
      const own=b[side].filter(m=>m.hp>0),targets=b[side==='allies'?'enemies':'allies'].filter(m=>m.hp>0);
      for(const m of own){
        if(!targets.some(m=>m.hp>0))break;
        const target=targets.find(m=>m.hp>0);
        const bonus=side==='allies'?(q.formation===1?4:0)+(q.equipment!==null?4:0):0;
        const defense=side==='enemies'&&q.formation===2?4:0;
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
    if(b.phase!=='active')return;
    b.phase=win?'won':'lost';
    const q=s.squads[b.squad];q.members.forEach((m,i)=>m.hp=Math.max(1,b.allies[i].hp));
    q.stamina=Math.max(0,q.stamina-20);
    const mission=s.taken.find(m=>m.squad===q.id&&m.kind==='battle');
    if(win&&mission){b.reward=mission.reward;complete(s,mission);q.kills+=b.enemies.length;}
    else record(s,`${q.name}撤退，請整備後再出擊。`);
  }
  function validateSave(value,data){
    if(!value||value.version!==VERSION||value.mode!=='native-playtest'||!Array.isArray(value.squads)||value.squads.length!==6)throw Error('不是相容的 Web 存檔');
    for(const k of ['money','debt','day','hour','rep','seed'])if(!Number.isSafeInteger(value[k])||value[k]<0||value[k]>1e12)throw Error('存檔數值無效');
    if(value.hour>23||!Array.isArray(value.log)||!Array.isArray(value.taken)||!Array.isArray(value.completed)||!Array.isArray(value.inventory))throw Error('存檔結構無效');
    if(value.ended!==null&&value.ended!=='won')throw Error('戰役狀態無效');
    value.squads.forEach((q,i)=>{
      if(q.id!==i||!Number.isInteger(q.at)||!data.bases[q.at]||!Array.isArray(q.members)||!q.members.length||q.members.length>12)throw Error('部隊資料無效');
      if(!['idle','move','rest'].includes(q.order)||!Array.isArray(q.route)||q.route.some(v=>!Number.isInteger(v)||!data.bases[v]))throw Error('行軍資料無效');
      if(!Number.isFinite(q.progress)||q.progress<0||q.progress>=1||!Number.isFinite(q.stamina)||q.stamina<0||q.stamina>100)throw Error('部隊狀態無效');
      if(!Number.isInteger(q.formation)||q.formation<0||q.formation>2||typeof q.name!=='string'||q.name.length>100||typeof q.leader!=='string')throw Error('部隊資料無效');
      q.members.forEach(m=>{for(const k of ['hp','maxHp','attack','defense'])if(!Number.isFinite(m[k])||m[k]<0||m[k]>1000000)throw Error('成員能力無效');if(typeof m.name!=='string'||m.name.length>100||m.hp>m.maxHp)throw Error('成員資料無效');});
    });
    value.taken.forEach(m=>{if(!m||typeof m.id!=='string'||typeof m.title!=='string'||!['battle','delivery'].includes(m.kind)||!Number.isInteger(m.squad)||!value.squads[m.squad]||!data.bases[m.to]||!Number.isSafeInteger(m.reward)||m.reward<0||m.reward>1e9||!Number.isSafeInteger(m.due))throw Error('委託資料無效');});
    value.log.forEach(e=>{if(!e||typeof e.text!=='string'||e.text.length>1000||!Number.isSafeInteger(e.day))throw Error('紀錄資料無效');});
    return clone(value);
  }
  const api={VERSION,newGame,route,offers,step,command,beginBattle,battleStep,finishBattle,validateSave,clone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.HREngine=api;
})(typeof window==='undefined'?globalThis:window);
