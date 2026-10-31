/* Adapt the native map/roster UI to the recovered 382/81-byte combat model. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./original-combat.js'),require('./original-campaign.js'));
  else root.OriginalBattleBridge=factory(root.OriginalCombat,root.OriginalCampaign);
})(typeof globalThis==='undefined'?this:globalThis,function(Combat,Campaign){
  'use strict';
  const word=(v,o,n)=>v.setInt16(o,(n<<16)>>16,true);
  function encodeUnit(q){
    const bytes=Uint8Array.from(q.originalUnit||new Array(382).fill(0)),v=new DataView(bytes.buffer),used=new Set();
    for(let slot=0;slot<11;slot++)word(v,85+27*slot,-1);
    for(const member of q.members){
      const slot=Number.isInteger(member.originalSlot)?member.originalSlot:Array.from({length:11},(_,i)=>i).find(i=>!used.has(i));
      if(slot===undefined||slot<0||slot>10||used.has(slot))throw Error('原作成員槽位衝突');used.add(slot);
      const p=85+27*slot;word(v,p,member.classId??member.face);word(v,p+2,member.hp);word(v,p+4,member.maxHp);
      word(v,p+6,member.level??0);word(v,p+8,member.attack);word(v,p+10,member.defense);
      for(let skill=0;skill<3;skill++)word(v,p+12+2*skill,member.skills?.[skill]??0);
      word(v,p+18,member.fatigue??0);bytes[p+20]=member.formationSlot??slot;
      bytes[p+21]=member.weapon??255;bytes[p+22]=member.armor==null?255:member.armor-23;
      bytes[p+23]=member.consumable==null?255:member.consumable-40;bytes[p+24]=member.consumableCount??0;
    }
    bytes[65]=q.formation;
    for(const[kind,offset]of [['tank',58],['plane',61],['cannon',64]]){bytes[offset]=q[kind+'Id']??255;if(kind!=='cannon')word(v,offset+1,q[kind+'Durability']??0);}
    word(v,38,q.originalOrder??2);word(v,40,q.moveMode??0);word(v,42,q.active??1);
    return bytes;
  }
  function applyUnit(q,raw){
    const bytes=Uint8Array.from(raw),v=new DataView(bytes.buffer),read=o=>v.getInt16(o,true),old=q.members;
    q.originalUnit=Array.from(bytes);q.members=[];
    for(let slot=0;slot<11;slot++){
      const p=85+27*slot,classId=read(p);if(classId===-1)continue;
      const previous=old.find(m=>m.originalSlot===slot)||old[slot],c=Combat.originalData.classes[classId];if(!c)throw Error('原作兵種不存在');
      q.members.push({name:previous?.classId===classId||previous?.face===classId?previous.name:c.name.trim(),face:classId,classId,originalSlot:slot,
        hp:read(p+2),maxHp:read(p+4),level:read(p+6),attack:read(p+8),defense:read(p+10),skills:[read(p+12),read(p+14),read(p+16)],fatigue:read(p+18),formationSlot:bytes[p+20],
        weapon:bytes[p+21]===255?null:bytes[p+21],armor:bytes[p+22]===255?null:bytes[p+22]+23,consumable:bytes[p+23]===255?null:bytes[p+23]+40,consumableCount:bytes[p+24]});
    }
  }
  function decorate(b){
    const wrap=(actors,count,side)=>actors.slice(0,count).map((a,i)=>({...a,id:i,name:b.names[side][i],face:b.faces[side][i]}));
    b.allies=wrap(b.core.friendly,b.core.friendlyCount,'friendly');b.enemies=wrap(b.core.enemy,b.core.enemyCount,'enemy');b.turn=b.core.ticks;
    return b;
  }
  function create(s,q,encounterBytes,options={}){
    const core=Combat.createBattle({unitBytes:options.unitBytes||encodeUnit(q),encounterBytes,friendlyFormationId:q.formation,
      ...options,random32768:()=>Campaign.random32768(s)});
    const names={},faces={};for(const side of ['friendly','enemy']){names[side]=core[side].map(a=>Combat.originalData.classes[a.classId]?.name.trim()||'');faces[side]=core[side].map(a=>a.classId);}
    return decorate({original:true,squad:q.id,background:options.background??1,core,names,faces,phase:'active',turn:0,time:0,log:['原作戰鬥開始。'],reward:0,settled:false});
  }
  function step(s,q,b){
    if(b.phase!=='active')return b;
    Combat.stepBattle(b.core);b.time++;
    for(const e of b.core.events){
      if(e.type==='attack'){const target=e.side==='friendly'?'enemy':'friendly';b.log.unshift(`${b.names[e.side][e.index]} → ${b.names[target][e.target]}　${e.hit?e.damage+' 損害':'未命中'}`);}
      else if(e.type==='healing')b.log.unshift(`${b.names[e.side][e.index]}使用回復物品。`);
      else if(e.type==='leader-down')b.log.unshift('隊長退場，部隊開始逐步撤退。');
    }
    b.log=b.log.slice(0,25);decorate(b);
    if(b.core.outcome!==null&&!b.settled){
      b.settled=true;b.phase=b.core.outcome===1?'won':'lost';applyUnit(q,b.core.unitBytes);
      if(b.core.outcome===1){const factor=s.economy?.incomeMultiplier===5?5:1,base=b.core.experienceTotal>>>0,award=factor===5?Math.min(base*5,Math.max(0,99999999-s.money)):base;const result=Campaign.settleVictory(s.money,s.ledger||Array(96).fill(0),q.id,award);s.money=result.cash;s.ledger=result.ledger;b.reward=result.reward;}
    }
    return b;
  }
  function command(b,input){const result=Combat.commandBattle(b.core,input);decorate(b);return result;}
  function snapshot(b){
    const core={};for(const key of ['friendly','enemy','friendlyCount','enemyCount','friendlyLiving','leaderDown','experienceTotal','outcome','ticks','memberFatigue','friendlyFormation','enemyFormation','writeBackEnabled','events','effects'])core[key]=b.core[key];
    core.unitBytes=Array.from(b.core.unitBytes);core.encounterBytes=Array.from(b.core.encounterBytes);
    return JSON.parse(JSON.stringify({original:true,squad:b.squad,background:b.background,storyEventKey:b.storyEventKey,core,names:b.names,faces:b.faces,phase:b.phase,turn:b.turn,time:b.time,log:b.log,reward:b.reward,settled:b.settled}));
  }
  function restore(s,saved){
    validateSnapshot(saved);
    const b=JSON.parse(JSON.stringify(saved));b.core.unitBytes=Uint8Array.from(b.core.unitBytes);b.core.encounterBytes=Uint8Array.from(b.core.encounterBytes);
    b.core.classes=Combat.originalData.classes;b.core.items=Combat.originalData.items;b.core.random32768=()=>Campaign.random32768(s);return decorate(b);
  }
  function validateSnapshot(b){
    if(!b?.original||!Number.isInteger(b.squad)||b.squad<0||b.squad>5||!['active','won','lost'].includes(b.phase)||typeof b.settled!=='boolean')throw Error('原作戰鬥存檔無效');
    const c=b.core;if(!c||![null,0,1].includes(c.outcome)||!Number.isSafeInteger(c.ticks)||c.ticks<0||!Number.isInteger(c.experienceTotal))throw Error('原作戰鬥狀態無效');
    for(const[key,length]of [['unitBytes',382],['encounterBytes',81]])if(!Array.isArray(c[key])||c[key].length!==length||c[key].some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('原作戰鬥位元組無效');
    for(const side of ['friendly','enemy']){
      if(!Array.isArray(c[side])||c[side].length!==11||!Number.isInteger(c[side+'Count'])||c[side+'Count']<0||c[side+'Count']>11)throw Error('原作戰鬥人數無效');
      for(const a of c[side]){
        if(!a||!Number.isInteger(a.classId)||(a.classId!==-1&&!Combat.originalData.classes[a.classId]))throw Error('原作戰鬥兵種無效');
        if(a.classId!==-1){
          for(const key of ['slot','hp','maxHp','level','attack','defense','rate','power','armor','state','previousState','weapon','formationSlot','x','y','counter'])if(!Number.isInteger(a[key])||a[key]<-32768||a[key]>32767)throw Error('原作戰鬥能力無效');
          if(a.slot<0||a.slot>10||a.formationSlot<0||a.formationSlot>10||a.weapon<-1||a.weapon>22)throw Error('原作戰鬥裝備或位置無效');
        }
      }
      if(!Array.isArray(b.names?.[side])||b.names[side].length!==11||b.names[side].some(n=>typeof n!=='string'||n.length>100))throw Error('原作戰鬥名稱無效');
    }
    if(!Array.isArray(c.memberFatigue)||c.memberFatigue.length!==11||c.memberFatigue.some(n=>!Number.isInteger(n)||n<-32768||n>32767))throw Error('原作戰鬥疲勞無效');
    if(!Array.isArray(b.log)||b.log.length>25||b.log.some(n=>typeof n!=='string'||n.length>1000))throw Error('原作戰鬥紀錄無效');
    return true;
  }
  return Object.freeze({encodeUnit,applyUnit,create,step,command,snapshot,restore,validateSnapshot});
});
