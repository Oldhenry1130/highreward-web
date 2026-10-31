/* Original MAIN.EXE combat arithmetic. Evidence: research/hr-full-restoration/combat.
 * Pure deterministic functions; callers supply the original 0..32767 random stream.
 * Rendering, audio, input and the encounter scheduler are outside this module.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OriginalCombat=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const i8=n=>(n<<24)>>24, i16=n=>(n<<16)>>16, i32=n=>n|0;
  const div=(a,b)=>{if(!b)throw new RangeError('Original division by zero');return Math.trunc(a/b);};
  const mul32=(a,b)=>Math.imul(a,b);
  const idiv16=(a,b)=>{const q=div(i16(a),i16(b));if(q < -32768 || q >32767)throw new RangeError('Original IDIV overflow');return q;};
  const r16=(b,o)=>i16(b[o]|b[o+1]<<8), w16=(b,o,n)=>{b[o]=n&255;b[o+1]=(n>>>8)&255;};
  const fields={slot:[4,1],classId:[5,2],level:[7,2],hp:[9,2],maxHp:[11,2],state:[13,1],previousState:[14,1],attack:[15,2],defense:[17,2],rate:[19,2],power:[21,2],armor:[23,2],fatigue:[25,2],weapon:[27,1],formationSlot:[28,1],x:[29,2],y:[31,2],counter:[33,2]};
  function actor(bytes){const a={};for(const [k,[o,n]]of Object.entries(fields))a[k]=n===2?r16(bytes,o):i8(bytes[o]);return a;}
  function actorBytes(a,prior){const b=Uint8Array.from(prior||new Uint8Array(35));for(const[k,[o,n]]of Object.entries(fields))if(a[k]!==undefined){if(n===2)w16(b,o,a[k]);else b[o]=a[k]&255;}return b;}
  function randomScaled(random32768,scale){const r=random32768();if(!Number.isInteger(r)||r<0||r>=32768)throw new RangeError('Random sample must be 0..32767');return div(r*scale,32768);}
  function randomRange(low,high,random32768){return i16(i16(low)+randomScaled(random32768,i16(high-low)));}
  function classStat(record,level,selector){
    if(selector===0)return i8(record.sprite);
    const baseKeys={1:'hp',2:'attack',3:'defense',7:'skill1',8:'skill2',9:'skill3'};
    if(selector>=4&&selector<=6)return i16(record[['hpCap','attackCap','defenseCap'][selector-4]]);
    const key=baseKeys[selector];if(!key)throw new RangeError('Unsupported original stat selector');
    let v=i16(record[key]),remaining=i16(level);
    while(remaining>=0){const factor=remaining>100?150:100+div(remaining,2);v=i32(div(mul32(v,factor),100));remaining=i16(remaining-100);}
    const cap=i16(record[key+'Cap']);if((v>>>0)>(cap>>>0))v=cap;
    return i16(v);
  }
  function covered(actors,index){const a=actors[index];for(let j=0;j<11;j++){const b=actors[j];if(b&&b.classId!==-1&&b.y===a.y&&(a.classId<29?b.x<a.x:b.x>a.x))return true;}return false;}
  function selectTarget(actors,count,friendlyPositions,enemyFormation,random32768){
    let best=-999,result=999;
    for(let row=0;row<11;row++)for(let i=0;i<count;i++){const a=actors[i];if(a.formationSlot!==row||a.classId===-1||a.hp<=0||i8(a.state)>=8||covered(actors,i))continue;
      const score=i16(randomScaled(random32768,20)-(a.classId<29?friendlyPositions[i].x:enemyFormation[i][0]));
      if(score>best){best=score;result=i;}
    }return result;
  }
  const animation=[0,1,3,1,5,6,7,1,9,10,11,12,13,1,14,15,16,17,19,20,1,22,23,1,25,26,27,1,29,30,31,32,33,34,35,36,37,38,38];
  function nextAnimationState(state,category){const s=state&65535;if(s===3)return category===3||category===4?4:1;return s<animation.length?animation[s]:i16(state);}
  function damageAmount(attacker,target,random32768){
    const spread=randomRange(80,100,random32768);
    const numerator=i16(i16(attacker.power)*i16(attacker.attack));
    const denominator=i16(i16(target.defense)+i16(target.armor)+1);
    const q=idiv16(numerator,denominator), product=i16(spread*q);
    let damage=div(product,40);if(damage===0&&product!==0)damage=1;
    const critical=randomScaled(random32768,100)<20;
    if(critical)damage=i32(div(mul32(damage,randomRange(150,200,random32768)),100));
    return {damage,critical,spread};
  }
  // bank0AC2, including target state, hit probability, level growth and fatigue writes.
  // memberFatigue is the original current-company member array, used even for enemy shots.
  function attackTick(attackers,targets,index,count,memberFatigue,friendlyPositions,enemyFormation,random32768){
    const a=attackers[index];a.counter=i16(a.counter+a.rate);if(a.counter<=100)return{fired:false};a.counter=i16(a.counter-100);
    const ti=selectTarget(targets,count,friendlyPositions,enemyFormation,random32768);if(ti===999)return{fired:false,target:999};
    const t=targets[ti];a.state=2;t.state=21;
    const f=i16(memberFatigue[a.slot]||0), level=a.classId<29?i16(a.level+50):i16(div(t.level,2)+50);
    const fatigueMultiplier=i16(100-f), accuracy1=i32(div(mul32(level,fatigueMultiplier),100));
    const halfDefense=div(i16(t.defense+t.armor+1),2);
    const accuracy=i32(div(mul32(accuracy1,i16(a.attack)),halfDefense));
    if(accuracy<randomScaled(random32768,200))return{fired:true,target:ti,hit:false};
    if(a.classId<29){
      const dominates=i16(div(a.maxHp,3)*2)>t.maxHp&&i16(div(a.attack,3)*2)>t.attack&&i16(div(a.defense,3)*2)>t.defense;
      if(!dominates&&randomRange(0,10,random32768)<8)a.level=i16(a.level+1);
      if(a.level>999)a.level=999;
    }else{
      const slot=t.slot;memberFatigue[slot]=i16((memberFatigue[slot]||0)+1);
      // Original E30..E67 uses attacker index for the cap lookup, not selected target index.
      const capSlot=targets[index].slot;if(memberFatigue[capSlot]>100)memberFatigue[capSlot]=100;
    }
    const result=damageAmount(a,t,random32768);t.state=result.critical?24:8;
    if(t.classId<29&&i32(t.hp-result.damage)<=0){if(t.hp===1)t.hp=0;else{t.hp=1;t.state=24;}}
    else{const remaining=i16(t.hp-i16(result.damage));t.hp=remaining<0?0:remaining;}
    return{fired:true,target:ti,hit:true,...result};
  }
  function canAttack(a){return a.classId!==-1&&a.hp>0&&a.state===1&&(a.weapon&255)!==255;}
  function buildFriendly(unit,formation,items,prior){
    const out=Uint8Array.from(prior||new Uint8Array(385));let count=0;
    for(let i=0;i<11;i++){w16(out,i*35+5,-1);w16(out,i*35+9,0);}
    for(let slot=0;slot<11;slot++){
      const p=85+27*slot,cid=r16(unit,p),hp=r16(unit,p+2);if(cid===-1||hp<=0){w16(out,count*35+5,-1);w16(out,count*35+9,0);continue;}
      const weapon=i8(unit[p+21]),armor=i8(unit[p+22]),point=formation[i8(unit[p+20])],gear=items[weapon],protection=items[23+armor];
      const a={slot,classId:cid,level:r16(unit,p+6),hp,maxHp:r16(unit,p+4),attack:r16(unit,p+8),defense:r16(unit,p+10),fatigue:r16(unit,p+18),counter:0,rate:i8(gear[39]),power:r16(gear,35),armor:r16(protection,37),weapon,formationSlot:i8(unit[p+20]),state:weapon===-1?0:1,previousState:-1,x:i16(point[0]+320),y:i16(point[1]-20)};
      const b=actorBytes(a,out.slice(count*35,count*35+35));w16(b,0,cid*46+8);w16(b,2,0x4839);out.set(b,count++*35);
    }return{bytes:out,count,actors:Array.from({length:11},(_,i)=>actor(out.slice(i*35,i*35+35)))};
  }
  function buildEnemy(descriptor,formation,items,classes,prior){
    const out=Uint8Array.from(prior||new Uint8Array(385));let count=0;
    for(let i=0;i<11;i++){w16(out,i*35+5,-1);w16(out,i*35+9,0);}
    const weapon=i8(descriptor[21]),armor=i8(descriptor[22]);
    for(let slot=0;slot<11;slot++){
      const p=26+5*slot,group=i8(descriptor[p]),cid=i8(descriptor[23+group]),hp=r16(descriptor,p+3);if(group===-1||cid===-1||hp===0)continue;
      const level=r16(descriptor,p+1),point=formation[count],gear=items[weapon],protection=items[23+armor];
      const a={slot,classId:cid,level,hp,maxHp:classStat(classes[cid],level,1),attack:classStat(classes[cid],level,2),defense:classStat(classes[cid],level,3),counter:0,rate:i8(gear[39]),power:r16(gear,35),armor:r16(protection,37),weapon,formationSlot:slot,state:weapon===-1?0:1,previousState:-1,x:i16(256-point[0]),y:i16(point[1]-20)};
      const b=actorBytes(a,out.slice(count*35,count*35+35));w16(b,0,cid*46+8);w16(b,2,0x4839);out.set(b,count++*35);
    }return{bytes:out,count,actors:Array.from({length:11},(_,i)=>actor(out.slice(i*35,i*35+35)))};
  }
  function writeBackFriendly(unit,actors,count,classes){
    const out=Uint8Array.from(unit);
    for(let i=0;i<count;i++){
      const a=actors[i],p=85+27*a.slot;w16(out,p+2,a.hp);w16(out,p+6,a.level);
      if(r16(out,p)>5&&r16(out,p+2)<=0)w16(out,p,-1);
      const record=classes[r16(out,p)],maxHp=classStat(record,a.level,1);
      w16(out,p+2,r16(out,p+2)+i16(maxHp-r16(out,p+4)));w16(out,p+4,maxHp);
      for(const[selector,off]of [[2,8],[3,10],[8,14],[9,16],[7,12]])w16(out,p+off,classStat(record,a.level,selector));
    }return out;
  }
  function healMember(unit,slot,itemId,items,classes){
    const p=85+27*slot,amount=r16(items[40+itemId],31),maxHp=classStat(classes[r16(unit,p)],r16(unit,p+6),1);
    w16(unit,p+2,amount===99?maxHp:i16(r16(unit,p+2)+amount));if(r16(unit,p+2)>maxHp)w16(unit,p+2,maxHp);
    if(i8(unit[p+24])<=1){unit[p+23]=255;unit[p+24]=0;}else unit[p+24]=(unit[p+24]-1)&255;
  }
  function autoHeal(state){
    for(let i=0;i<state.friendlyCount;i++){
      const a=state.friendly[i],p=85+27*a.slot,id=i8(state.unitBytes[p+23]);
      if(a.classId===-1||i8(a.state)>=28||id===-1||r16(state.items[40+id],27)!==0)continue;
      const percent=div(mul32(a.hp,100),classStat(state.classes[a.classId],a.level,1));if(percent>25)continue;
      w16(state.unitBytes,p+2,a.hp);healMember(state.unitBytes,a.slot,id,state.items,state.classes);a.hp=r16(state.unitBytes,p+2);
      state.events.push({type:'healing',side:'friendly',index:i,itemId:id,hp:a.hp});
    }
  }
  function visualRandom(a,side,random32768,force=false,effects){
    if(a.classId===-1||(!force&&a.state===a.previousState))return;
    // Original rendering shares gameplay RNG. Keep these calls even for a modern renderer.
    if(a.state===18||a.state===19){const x=i16(a.x+(side==='friendly'?40:8)+randomRange(-1,1,random32768)*8),y=i16(a.y+2+randomRange(-4,4,random32768));if(effects)effects[side+'18']=[x,y];}
    else if(a.state===21||a.state===22){const x=i16(a.x+(side==='friendly'?8:40)+randomRange(side==='friendly'?-1:-3,side==='friendly'?3:1,random32768)*8),y=i16(a.y+18+randomRange(-2,2,random32768));if(effects)effects[side+'21']=[x,y];}
  }
  function retreatSpread(state){
    if(!state.leaderDown)return;
    for(let i=0;i<11;i++){const a=state.friendly[i];if(a.classId!==-1&&randomRange(0,100,state.random32768)<5&&i8(a.state)<28)a.state=28;}
  }
  function syncFatigue(state){for(let j=0;j<11;j++)w16(state.unitBytes,85+27*j+18,state.memberFatigue[j]);}
  function finishBattle(state,outcome){
    state.outcome=outcome;
    if(state.writeBackEnabled)state.unitBytes=writeBackFriendly(state.unitBytes,state.friendly,state.friendlyCount,state.classes);
    for(let i=0;i<state.enemyCount;i++)w16(state.encounterBytes,29+5*state.enemy[i].slot,state.enemy[i].hp);
    state.events.push({type:'battle-ended',outcome,rewardCash:outcome===1?state.experienceTotal:0});
  }
  function stepBattle(state){
    state.events=[];if(state.outcome!==null)return state;
    const random=state.random32768;state.effects=state.effects||{};state.ticks++;let removed=0;
    for(let i=0;i<state.friendlyCount;i++){
      const a=state.friendly[i];if(a.classId===-1){removed++;continue;}a.previousState=a.state;
      if(a.hp<=0&&i8(a.state)<28){a.state=28;state.friendlyLiving=i16(state.friendlyLiving-1);state.events.push({type:'down',side:'friendly',index:i});continue;}
      if(a.state===1&&(a.weapon&255)!==255){const event=attackTick(state.friendly,state.enemy,i,state.enemyCount,state.memberFatigue,state.friendly,state.enemyFormation,random);if(event.fired)state.events.push({type:'attack',side:'friendly',index:i,...event});}
      else if(i8(a.state)>=38){a.classId=-1;removed++;}
      else a.state=i8(nextAnimationState(a.state,r16(state.items[i8(a.weapon)],27)));
      if(a.classId>=0&&a.classId<=5&&a.state===29&&!state.leaderDown){state.leaderDown=true;state.events.push({type:'leader-down',index:i});}
      if(a.state===1&&(a.weapon&255)===255)a.state=0;
      retreatSpread(state);visualRandom(a,'friendly',random,false,state.effects);
    }
    syncFatigue(state);autoHeal(state);
    if(removed>=state.friendlyCount){finishBattle(state,0);return state;}
    removed=0;
    for(let i=0;i<state.enemyCount;i++){
      const a=state.enemy[i];if(a.classId===-1){removed++;continue;}a.previousState=a.state;
      if(a.hp<=0&&i8(a.state)<28){a.state=28;state.events.push({type:'down',side:'enemy',index:i});continue;}
      if(a.state===1&&(a.weapon&255)!==255){const event=attackTick(state.enemy,state.friendly,i,state.friendlyCount,state.memberFatigue,state.friendly,state.enemyFormation,random);if(event.fired)state.events.push({type:'attack',side:'enemy',index:i,...event});continue;}
      if(a.state===28)state.experienceTotal=i32(state.experienceTotal+a.maxHp);
      if(i8(a.state)>=38){a.classId=-1;removed++;}else a.state=i8(nextAnimationState(a.state,r16(state.items[i8(a.weapon)],27)));
      if(a.state===1&&(a.weapon&255)===255)a.state=0;
      visualRandom(a,'enemy',random,false,state.effects);
    }
    syncFatigue(state);autoHeal(state);
    if(removed>=state.enemyCount)finishBattle(state,1);
    return state;
  }
  function createBattle(options){
    const data=options.data||originalData,unitBytes=Uint8Array.from(options.unitBytes),encounterBytes=Uint8Array.from(options.encounterBytes);
    const enemyFormationId=options.enemyFormationId===undefined?randomRange(1,16,options.random32768):options.enemyFormationId;
    const friendlyFormation=data.formations[options.friendlyFormationId||0].positions,enemyFormation=data.formations[enemyFormationId].positions;
    const friend=buildFriendly(unitBytes,friendlyFormation,data.items,options.priorFriendlyBytes),enemy=buildEnemy(encounterBytes,enemyFormation,data.items,data.classes,options.priorEnemyBytes);
    return{friendly:friend.actors,enemy:enemy.actors,friendlyCount:friend.count,enemyCount:enemy.count,friendlyLiving:friend.count,leaderDown:false,experienceTotal:0,outcome:null,ticks:0,unitBytes,encounterBytes,memberFatigue:Array.from({length:11},(_,j)=>r16(unitBytes,85+27*j+18)),friendlyFormation,enemyFormation,items:data.items,classes:data.classes,random32768:options.random32768,writeBackEnabled:options.writeBackEnabled!==false,events:[]};
  }
  function commandBattle(state,command){
    if(state.outcome!==null)return{accepted:false,reason:'battle-ended'};
    if(command.type==='retreat'){
      if(state.friendly.some(a=>a.classId>=0&&a.classId<=5&&i8(a.state)>=28))return{accepted:false,reason:'leader-already-leaving'};
      const leader=state.friendly.find(a=>a.classId>=0&&a.classId<=5);if(!leader)return{accepted:false,reason:'no-leader'};
      leader.state=28;state.friendlyLiving=i16(state.friendlyLiving-1);return{accepted:true};
    }
    if(command.type==='withdraw-member'){
      const a=state.friendly[command.index];if(!a||a.classId===-1||a.hp<=0||i8(a.state)>=28)return{accepted:false,reason:'member-unavailable'};
      a.state=0;visualRandom(a,'friendly',state.random32768,true);a.state=28;state.friendlyLiving=i16(state.friendlyLiving-1);return{accepted:true};
    }
    if(command.type==='inspect'){
      const a=(command.side==='enemy'?state.enemy:state.friendly)[command.index];return a&&a.classId!==-1&&a.hp>0&&i8(a.state)<28?{accepted:true,actor:{...a}}:{accepted:false,reason:'member-unavailable'};
    }
    return{accepted:false,reason:'unknown-original-command'};
  }
  // Resident 0E5F:0256/02C2 world-map vehicle damage, separate from soldier shots.
  function worldDamage(attack,defense,random32768){
    let v=idiv16(i16(randomRange(8,12,random32768)*i16(attack)),10);
    v=idiv16(v,i16(div(i16(defense),10)+1));if(v<0)v=1;if(v>999)v=999;return v;
  }
  function skilledWorldDamage(attack,defense,skill,random32768){
    const base=worldDamage(attack,defense,random32768),s=skill&65535,factor=s<10?100-5*Math.floor(s/2):75;
    let v=i32(div(mul32(base,factor),100)+1);if(v<0)v=1;return i16(v);
  }
  function infantrySiegeDamage(unit,base,aliveCount,items,random32768){
    let attack=0,power=0,rate=0;
    for(let j=0;j<11;j++){const p=85+j*27;if(r16(unit,p)===-1||r16(unit,p+2)<=1)continue;
      attack=i16(attack+r16(unit,p+8));const id=i8(unit[p+21]);if(id===-1)continue;
      power=i16(power+r16(items[id],35));rate=i16(rate+i8(items[id][39]));
    }
    attack=idiv16(attack,aliveCount);power=idiv16(power,aliveCount);rate=idiv16(rate,aliveCount);
    return worldDamage(i16(3*i16(i16(attack*20)+i16(power*rate))),r16(base,34),random32768);
  }
  function counterfireMembers(unit,base,random32768){
    let total=0;
    for(let j=0;j<11;j++){
      const p=85+j*27,cid=r16(unit,p);if(cid===-1)continue;
      let loss=worldDamage(r16(base,32),i16(r16(unit,p+10)*10),random32768),hp=r16(unit,p+2);
      if(i16(hp-loss)<=0){if(cid>=0&&cid<=5){loss=hp;hp=0;}else if(hp<=1)loss=0;else{loss=i16(hp-1);hp=1;}}
      else hp=i16(hp-loss);
      w16(unit,p+2,hp);w16(unit,p+18,Math.max(0,Math.min(100,i16(r16(unit,p+18)+loss))));total=i16(total+loss);
    }return total;
  }
  function worldVisualRandom(number,visible,random32768,explosion=false){
    if(!visible)return;const count=i8(number+randomRange(0,2,random32768));
    for(let j=0;j<count;j++){
      randomRange(-4,4,random32768);randomRange(-1,1,random32768);randomRange(-4,4,random32768);randomRange(-1,1,random32768);
      // 1B0E and 1E27 each draw six frames and share RNG for their frame delays.
      for(let frame=0;frame<6;frame++)randomRange(5,10,random32768);
    }
  }
  function tankCounterfire(unit,base,skill,terrainDefense,visible,items,random32768){
    // 09BC:0935..0956 resets every positive 0..99 roll to zero: preserve original branch.
    randomRange(0,100,random32768);const id=i8(base[37]);if(id===-1)return{damage:0};
    const defense=r16(items[62+i8(unit[58])],37),power=r16(items[62+id],35);
    const damage=idiv16(i16(skilledWorldDamage(power,defense,skill,random32768)*10),terrainDefense);
    worldVisualRandom(3,visible,random32768);w16(unit,59,Math.max(0,i16(r16(unit,59)-damage)));return{damage};
  }
  function planeCounterfire(unit,base,skill,atBase,visible,items,random32768){
    if(!atBase&&i8(base[36])===-1)return{damage:0};
    const defense=r16(items[70+i8(unit[61])],37),power=atBase?r16(base,32):r16(items[70+i8(base[36])],35);
    const damage=skilledWorldDamage(power,defense,skill,random32768);worldVisualRandom(3,visible,random32768);
    w16(unit,62,Math.max(0,i16(r16(unit,62)-damage)));return{damage};
  }
  function unitCombatSummary(unit,selector,classes=originalData.classes,items=originalData.items){
    let sum=0;const offsets={1:2,3:6,4:8,5:10,9:18};
    for(let j=0;j<11;j++){
      const p=85+j*27,cid=r16(unit,p);if(cid===-1)continue;let v;
      if(selector===0)v=1;else if(offsets[selector]!==undefined)v=r16(unit,p+offsets[selector]);
      else if(selector===2)v=classStat(classes[cid],r16(unit,p+6),1);
      else if(selector>=14&&selector<=16)v=cid===selector-2?1:0;
      else if(selector===10||selector===12){const id=i8(unit[p+21]);v=id===-1?0:selector===10?r16(items[id],35):i8(items[id][39]);}
      else if(selector===11){const id=i8(unit[p+22]);v=id===-1?0:r16(items[23+id],35);}
      else throw new RangeError('Original summary selector not ported');sum=i32(sum+v);
    }return sum;
  }
  function encounterPercent(encounter,classes=originalData.classes){
    let hp=0,max=0;
    for(let j=0;j<11;j++){const p=26+5*j,g=i8(encounter[p]),cid=i8(encounter[23+g]);if(g===-1||cid===-1)continue;hp=i16(hp+r16(encounter,p+3));max=i16(max+classStat(classes[cid],r16(encounter,p+1),1));}
    return i16(div(mul32(hp,100),max));
  }
  function returnHome(unit,bases){const home=r16(unit,67),base=bases[home];w16(unit,38,1);w16(unit,73,base[21]);w16(unit,75,base[22]);w16(unit,71,home);}
  function reduceBase(base,damage){
    let hp=i16(r16(base,26)-i16(damage));if(hp<0)hp=0;if(hp>r16(base,28))hp=r16(base,28);w16(base,26,hp);
    const stage=hp<50?0:hp<100?1:hp<200?2:3,oldStage=i8(base[25]);base[25]=stage;return{hp,stage,oldStage};
  }
  // Generator pauses at an actual original near-combat call. Resume after updating
  // the mutable company/encounter records from createBattle/stepBattle.
  function* captureBase(world,unitId,baseId){
    const base=world.bases[baseId];
    for(let g=0;g<4;g++){
      const eid=r16(base,72+2*g);if(eid===-1)continue;const e=world.garrisons[eid];
      if(encounterPercent(e,world.classes)>30){yield{type:'melee-request',reason:'capture-garrison',unitId,baseId,encounter:e,encounterId:eid};return false;}
    }
    base[23]=1;w16(base,26,1);
    for(let pass=0;pass<2;pass++)for(let i=0;i<6;i++){
      const u=world.units[i];if(world.currentBase(i)!==baseId||r16(u,42)!==1)continue;
      if(pass===0?r16(u,38)!==5:!(r16(u,38)===2&&r16(u,44)===4))continue;
      w16(u,38,2);w16(u,40,0);w16(u,44,0);w16(u,49,baseId);w16(u,69,baseId);w16(u,67,baseId);
    }
    yield{type:'base-captured',unitId,baseId};return true;
  }
  function worldContext(options){return{...options,items:options.items||originalData.items,classes:options.classes||originalData.classes};}
  function* siegeHour(options){
    const world=worldContext(options),random=world.random32768;
    for(let i=0;i<6;i++){
      const u=world.units[i],bid=world.currentBase(i),base=world.bases[bid];
      if(r16(u,38)!==5||r16(u,42)!==1||unitCombatSummary(u,1)<=0||r16(u,87)<=0||bid===-1)continue;
      const initialHp=r16(base,26),bombard=r16(u,40)===2;
      if(initialHp<=0){if(!bombard)yield* captureBase(world,i,bid);else{returnHome(u,world.bases);yield{type:'bombard-ended',unitId:i,baseId:bid};}break;}
      if(randomRange(0,48,random)>=24)continue;
      const mode=r16(u,46);if(mode<0||mode>3)break;let damage=0,loss=0;
      if(mode===0){damage=infantrySiegeDamage(u,base,unitCombatSummary(u,0),world.items,random);loss=counterfireMembers(u,base,random);}
      else{
        const id=i8(u[mode===1?64:mode===2?58:61]),offset=mode===1?78:mode===2?62:70;
        const raw=worldDamage(r16(world.items[offset+id],35),r16(base,34),random),crew=unitCombatSummary(u,mode===1?14:mode===2?15:16);
        damage=i32(div(mul32(i32(raw<<3),i32(mul32(crew,5)+100)),100));
      }
      if(i32(initialHp-damage)<0)damage=initialHp;
      worldVisualRandom(2,world.unitRegion(i)===world.selectedRegion,random,true);
      if(base[24]>2)break;
      yield{type:'siege-attack',unitId:i,baseId:bid,mode,damage,loss};
      if(mode===3){returnHome(u,world.bases);yield{type:'bombard-ended',unitId:i,baseId:bid};}
      const result=reduceBase(base,damage);yield{type:'base-damaged',unitId:i,baseId:bid,damage,...result};
    }
  }
  function hurtMember(unit,p,damage){
    const cid=r16(unit,p),hp=r16(unit,p+2);let loss=damage,next=i16(hp-loss);
    if(next<=0){if(cid>=0&&cid<=5){loss=hp;next=0;}else if(hp<=1){loss=0;next=hp;}else{loss=i16(hp-1);next=1;}}
    w16(unit,p+2,next);w16(unit,p+18,Math.max(0,Math.min(100,i16(r16(unit,p+18)+loss))));return loss;
  }
  function* baseFireOnFoot(world,baseId,unitId,distance){
    const base=world.bases[baseId],unit=world.units[unitId],random=world.random32768;
    if(distance<=4){const slot=randomScaled(random,4),eid=r16(base,80+2*slot);if(eid!==-1&&encounterPercent(world.patrols[eid],world.classes)>80){yield{type:'melee-request',reason:'base-interception',baseId,unitId,encounter:world.patrols[eid],encounterId:eid};return;}}
    const plane=i8(base[36]),cannon=i8(base[38]);if(plane===-1&&cannon===-1)return;
    let choice=plane!==-1&&cannon===-1?0:plane===-1&&cannon!==-1?1:randomRange(0,100,random)>50?0:1;
    const power=r16(world.items[(choice===0?70:78)+(choice===0?plane:cannon)],35),terrain=world.terrainDefense(unitId);let total=0;
    for(let j=0;j<11;j++){const p=85+j*27;if(r16(unit,p)===-1)continue;const damage=idiv16(i16(skilledWorldDamage(power,i16(r16(unit,p+10)*10),distance,random)*10),terrain);total=i16(total+hurtMember(unit,p,damage));}
    worldVisualRandom(3,world.unitRegion(unitId)===world.selectedRegion,random);yield{type:'base-counterfire',baseId,unitId,mode:choice===0?'plane':'cannon',damage:total};
  }
  function leaderAble(unit){for(let j=0;j<11;j++){const p=85+j*27,cid=r16(unit,p);if(cid!==-1&&cid<=5&&(r16(unit,p+2)<=0||r16(unit,p+18)>=100))return false;}return true;}
  function* baseAttackHour(options){
    const world=worldContext(options),random=world.random32768;
    for(let b=0;b<world.bases.length;b++){
      const base=world.bases[b];if(base[23]!==2||r16(base,26)<=0)continue;
      for(let i=0;i<6;i++){
        const u=world.units[i],order=r16(u,38);if(r16(u,42)!==1||![0,3,5,4].includes(order)||unitCombatSummary(u,1)<=0||!leaderAble(u))continue;
        const dx=Math.abs(i16(base[21]-div(r16(u,51),10))),dy=Math.abs(i16(base[22]-div(r16(u,53),10))),range=i8(base[31]);if(dx>range||dy>range)continue;
        const distance=i16(dx+dy);if(randomRange(0,48,random)>=24||randomRange(0,i16(distance*distance),random)>distance)continue;
        const terrain=world.terrainDefense(i);if(terrain>=randomRange(0,30,random))continue;
        const travel=r16(u,40),mode=r16(u,46);let selected;
        if(travel===0){if(order!==5||mode===0||mode===1)selected='foot';}
        else if(travel===1){if(order!==5||mode===2)selected='tank';else if(mode===0||mode===1)selected='foot';}
        else if(travel===2)selected='plane';
        if(selected==='foot')yield* baseFireOnFoot(world,b,i,distance);
        else if(selected==='tank'){const result=tankCounterfire(u,base,distance,terrain,world.unitRegion(i)===world.selectedRegion,world.items,random);yield{type:'base-counterfire',baseId:b,unitId:i,mode:'tank',...result};}
        else if(selected==='plane'){const result=planeCounterfire(u,base,distance,world.currentBase(i)===b,world.unitRegion(i)===world.selectedRegion,world.items,random);yield{type:'base-counterfire',baseId:b,unitId:i,mode:'plane',...result};}
        break;
      }
    }
  }
  function* worldCombatHour(options){yield* siegeHour(options);yield* baseAttackHour(options);}
  function battleSpriteLayers(a,side,effects={},classes=originalData.classes){
    if(a.classId===-1)return[];const s=a.state,friend=side==='friendly',out=[],sprite=classes[a.classId].sprite,empty=(a.weapon&255)===255;
    const add=(archive,index,x,y)=>out.push({archive,index,x:x&65535,y:y&65535});
    const body=(dx=0,dy=0,frame)=>{let f=frame===undefined?(empty&&friend?2:0):frame;add('bc32.mrg',3*sprite+f,a.x+dx+(f===2?32:0),a.y+dy);};
    const effect=(index,dx=0,dy=0)=>add('dead.mrg',index,a.x+dx,a.y+dy);
    const hit=friend?8:5,crit=friend?8:-8;
    if(s===0){if(friend)body(0,0,2);}
    else if(s>=1&&s<=7)body(0,0,[2,3,5,7].includes(s)?1:undefined);
    else if(s>=8&&s<=13){body(0,s<=9?-1:s<=11?1:0);effect(hit+Math.floor((s-8)/2));}
    else if(s===18||s===19||s===20){body(0,s===20?0:-1);const p=effects[side+'18']||[0,0];add('dead.mrg',(friend?13:11)+(s===20?1:0),p[0],p[1]);}
    else if(s===21||s===22||s===23){body(0,friend||s===23?0:-1);const p=effects[side+'21']||[0,0];add('dead.mrg',(friend?17:15)+(s===23?1:0),p[0],p[1]);}
    else if(s>=24&&s<=29){const frame=s===24||s===25?0:s===26?1:s===27?2:s===28?0:1;body(crit,s===24||s===25||s===29?-1:s===26?1:0);effect(hit+frame,crit);}
    else if([30,31,33,35,37].includes(s)){const frame={30:0,31:1,33:2,35:3,37:4}[s];effect(frame,crit,s<=31?-1:s>=35?1:0);}
    return out;
  }
  /* ORIGINAL_DATA_START */
  const originalData={"classes":{"0":{"name":"莫洛•迪南多        ","sprite":0,"hp":30,"attack":11,"defense":11,"hpCap":342,"attackCap":125,"defenseCap":125,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"1":{"name":"傑西•亞哲魯        ","sprite":1,"hp":32,"attack":10,"defense":9,"hpCap":365,"attackCap":114,"defenseCap":103,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"2":{"name":"露•多明妮          ","sprite":2,"hp":18,"attack":7,"defense":8,"hpCap":205,"attackCap":80,"defenseCap":91,"skill1":12,"skill2":0,"skill3":0,"skill1Cap":137,"skill2Cap":0,"skill3Cap":0},"3":{"name":"迪詩蕾德•卡迪兒    ","sprite":3,"hp":20,"attack":5,"defense":7,"hpCap":228,"attackCap":57,"defenseCap":80,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"4":{"name":"鐵盧姆•雷姆        ","sprite":4,"hp":18,"attack":5,"defense":6,"hpCap":205,"attackCap":57,"defenseCap":68,"skill1":0,"skill2":12,"skill3":0,"skill1Cap":0,"skill2Cap":137,"skill3Cap":0},"5":{"name":"沙•維尼亞•波魯斯曼","sprite":5,"hp":30,"attack":12,"defense":10,"hpCap":342,"attackCap":137,"defenseCap":114,"skill1":0,"skill2":0,"skill3":12,"skill1Cap":0,"skill2Cap":0,"skill3Cap":137},"6":{"name":"步兵                ","sprite":7,"hp":16,"attack":8,"defense":8,"hpCap":36,"attackCap":18,"defenseCap":18,"skill1":0,"skill2":0,"skill3":2,"skill1Cap":0,"skill2Cap":0,"skill3Cap":7},"7":{"name":"裝甲兵              ","sprite":8,"hp":29,"attack":14,"defense":14,"hpCap":64,"attackCap":32,"defenseCap":32,"skill1":0,"skill2":0,"skill3":5,"skill1Cap":0,"skill2Cap":0,"skill3Cap":15},"8":{"name":"裝機兵              ","sprite":9,"hp":51,"attack":25,"defense":25,"hpCap":114,"attackCap":57,"defenseCap":57,"skill1":0,"skill2":0,"skill3":10,"skill1Cap":0,"skill2Cap":0,"skill3Cap":34},"9":{"name":"殼槍兵              ","sprite":10,"hp":90,"attack":45,"defense":45,"hpCap":203,"attackCap":102,"defenseCap":102,"skill1":0,"skill2":0,"skill3":23,"skill1Cap":0,"skill2Cap":0,"skill3Cap":77},"10":{"name":"槍士                ","sprite":14,"hp":100,"attack":50,"defense":50,"hpCap":225,"attackCap":113,"defenseCap":113,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"11":{"name":"劍士                ","sprite":21,"hp":0,"attack":0,"defense":0,"hpCap":0,"attackCap":0,"defenseCap":0,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"12":{"name":"砲兵                ","sprite":11,"hp":10,"attack":6,"defense":10,"hpCap":76,"attackCap":46,"defenseCap":76,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"13":{"name":"戰車兵              ","sprite":12,"hp":8,"attack":4,"defense":6,"hpCap":61,"attackCap":30,"defenseCap":46,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"14":{"name":"操縱士              ","sprite":13,"hp":10,"attack":5,"defense":8,"hpCap":76,"attackCap":38,"defenseCap":61,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"15":{"name":"米拉兒歌手          ","sprite":15,"hp":8,"attack":2,"defense":5,"hpCap":61,"attackCap":15,"defenseCap":38,"skill1":0,"skill2":8,"skill3":0,"skill1Cap":0,"skill2Cap":91,"skill3Cap":0},"16":{"name":"美特兒歌手          ","sprite":15,"hp":10,"attack":6,"defense":8,"hpCap":114,"attackCap":46,"defenseCap":61,"skill1":0,"skill2":5,"skill3":0,"skill1Cap":0,"skill2Cap":57,"skill3Cap":0},"17":{"name":"卡拉兒舞孃          ","sprite":16,"hp":6,"attack":3,"defense":5,"hpCap":46,"attackCap":23,"defenseCap":38,"skill1":0,"skill2":10,"skill3":0,"skill1Cap":0,"skill2Cap":114,"skill3Cap":0},"18":{"name":"艾兒舞孃            ","sprite":16,"hp":12,"attack":6,"defense":8,"hpCap":91,"attackCap":46,"defenseCap":61,"skill1":0,"skill2":5,"skill3":0,"skill1Cap":0,"skill2Cap":57,"skill3Cap":0},"19":{"name":"莉西斯舞孃          ","sprite":16,"hp":42,"attack":24,"defense":24,"hpCap":213,"attackCap":122,"defenseCap":122,"skill1":0,"skill2":12,"skill3":0,"skill1Cap":0,"skill2Cap":137,"skill3Cap":0},"20":{"name":"米斯迪亞樂手        ","sprite":17,"hp":6,"attack":4,"defense":4,"hpCap":20,"attackCap":14,"defenseCap":14,"skill1":0,"skill2":5,"skill3":0,"skill1Cap":0,"skill2Cap":57,"skill3Cap":0},"21":{"name":"菲貝魯特樂手        ","sprite":17,"hp":9,"attack":5,"defense":5,"hpCap":68,"attackCap":38,"defenseCap":38,"skill1":0,"skill2":10,"skill3":0,"skill1Cap":0,"skill2Cap":114,"skill3Cap":0},"22":{"name":"阿拉魯樂手          ","sprite":17,"hp":12,"attack":6,"defense":8,"hpCap":91,"attackCap":46,"defenseCap":61,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"23":{"name":"商　人              ","sprite":18,"hp":6,"attack":3,"defense":5,"hpCap":68,"attackCap":34,"defenseCap":57,"skill1":10,"skill2":0,"skill3":0,"skill1Cap":114,"skill2Cap":0,"skill3Cap":0},"24":{"name":"工　人              ","sprite":19,"hp":8,"attack":4,"defense":6,"hpCap":91,"attackCap":46,"defenseCap":68,"skill1":0,"skill2":0,"skill3":10,"skill1Cap":0,"skill2Cap":0,"skill3Cap":114},"25":{"name":"拜亞蘭斯的公主      ","sprite":6,"hp":36,"attack":2,"defense":25,"hpCap":55,"attackCap":10,"defenseCap":30,"skill1":0,"skill2":16,"skill3":0,"skill1Cap":0,"skill2Cap":182,"skill3Cap":0},"26":{"name":"拜亞蘭斯的女王      ","sprite":6,"hp":32,"attack":2,"defense":25,"hpCap":60,"attackCap":4,"defenseCap":30,"skill1":0,"skill2":16,"skill3":0,"skill1Cap":0,"skill2Cap":182,"skill3Cap":0},"27":{"name":"有名的舞孃　        ","sprite":22,"hp":7,"attack":3,"defense":5,"hpCap":53,"attackCap":23,"defenseCap":38,"skill1":0,"skill2":30,"skill3":0,"skill1Cap":0,"skill2Cap":513,"skill3Cap":0},"28":{"name":"全自動舞孃　　      ","sprite":23,"hp":70,"attack":45,"defense":45,"hpCap":105,"attackCap":68,"defenseCap":68,"skill1":0,"skill2":24,"skill3":0,"skill1Cap":0,"skill2Cap":122,"skill3Cap":0},"29":{"name":"德瓦拉槍兵          ","sprite":24,"hp":15,"attack":9,"defense":9,"hpCap":49,"attackCap":31,"defenseCap":31,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"30":{"name":"普特魯槍兵          ","sprite":25,"hp":45,"attack":27,"defense":27,"hpCap":102,"attackCap":61,"defenseCap":61,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"31":{"name":"德魯普克南姆槍兵    ","sprite":26,"hp":15,"attack":9,"defense":9,"hpCap":49,"attackCap":31,"defenseCap":31,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"32":{"name":"奇瑪特槍兵          ","sprite":32,"hp":58,"attack":29,"defense":29,"hpCap":131,"attackCap":65,"defenseCap":65,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"33":{"name":"武裝盜族            ","sprite":27,"hp":22,"attack":9,"defense":7,"hpCap":22,"attackCap":9,"defenseCap":7,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"34":{"name":"盜族                ","sprite":27,"hp":18,"attack":7,"defense":7,"hpCap":18,"attackCap":7,"defenseCap":7,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"35":{"name":"槍盜族              ","sprite":44,"hp":20,"attack":11,"defense":11,"hpCap":20,"attackCap":11,"defenseCap":11,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"36":{"name":"盜族                ","sprite":44,"hp":18,"attack":9,"defense":9,"hpCap":18,"attackCap":9,"defenseCap":9,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"37":{"name":"諾摩斯教神官        ","sprite":43,"hp":23,"attack":13,"defense":13,"hpCap":23,"attackCap":13,"defenseCap":13,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"38":{"name":"洛摩斯教僧兵        ","sprite":43,"hp":25,"attack":14,"defense":14,"hpCap":25,"attackCap":14,"defenseCap":14,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"39":{"name":"卡薩魯斯一族        ","sprite":46,"hp":27,"attack":14,"defense":14,"hpCap":27,"attackCap":14,"defenseCap":14,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"40":{"name":"卡薩魯斯勇士        ","sprite":46,"hp":31,"attack":15,"defense":15,"hpCap":31,"attackCap":15,"defenseCap":15,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"41":{"name":"嘉法槍裝兵          ","sprite":45,"hp":41,"attack":18,"defense":20,"hpCap":41,"attackCap":18,"defenseCap":20,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"42":{"name":"嘉法槍兵            ","sprite":45,"hp":35,"attack":16,"defense":16,"hpCap":35,"attackCap":16,"defenseCap":16,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"43":{"name":"倫塔魯諾機裝兵      ","sprite":37,"hp":59,"attack":29,"defense":29,"hpCap":59,"attackCap":29,"defenseCap":29,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"44":{"name":"倫塔魯諾兵          ","sprite":37,"hp":45,"attack":23,"defense":23,"hpCap":45,"attackCap":23,"defenseCap":23,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"45":{"name":"克南狄斯傭兵        ","sprite":24,"hp":64,"attack":32,"defense":32,"hpCap":64,"attackCap":32,"defenseCap":32,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"46":{"name":"特狄斯克傭兵        ","sprite":24,"hp":82,"attack":41,"defense":41,"hpCap":82,"attackCap":41,"defenseCap":41,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"47":{"name":"馬赫•傭兵          ","sprite":41,"hp":64,"attack":32,"defense":36,"hpCap":64,"attackCap":32,"defenseCap":36,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"48":{"name":"卡哲•傭兵          ","sprite":29,"hp":73,"attack":36,"defense":41,"hpCap":73,"attackCap":36,"defenseCap":41,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"49":{"name":"巴利•傭兵          ","sprite":42,"hp":82,"attack":41,"defense":45,"hpCap":82,"attackCap":41,"defenseCap":45,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"50":{"name":"雷茲尼亞克陸軍正規兵","sprite":28,"hp":68,"attack":32,"defense":32,"hpCap":68,"attackCap":32,"defenseCap":32,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"51":{"name":"雷茲尼亞克陸軍司令官","sprite":28,"hp":77,"attack":36,"defense":36,"hpCap":77,"attackCap":36,"defenseCap":36,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"52":{"name":"帝法拉黨幹部        ","sprite":24,"hp":95,"attack":45,"defense":45,"hpCap":95,"attackCap":45,"defenseCap":45,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"53":{"name":"帝法拉黨員          ","sprite":24,"hp":86,"attack":41,"defense":41,"hpCap":86,"attackCap":41,"defenseCap":41,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"54":{"name":"雷奈狄斯裝甲兵      ","sprite":39,"hp":68,"attack":27,"defense":41,"hpCap":68,"attackCap":27,"defenseCap":41,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"55":{"name":"雷奈狄斯兵          ","sprite":39,"hp":64,"attack":32,"defense":32,"hpCap":64,"attackCap":32,"defenseCap":32,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"56":{"name":"肯提斯一族          ","sprite":32,"hp":73,"attack":36,"defense":36,"hpCap":73,"attackCap":36,"defenseCap":36,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"57":{"name":"肯提斯勇士          ","sprite":32,"hp":77,"attack":38,"defense":38,"hpCap":77,"attackCap":38,"defenseCap":38,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"58":{"name":"槍騎士              ","sprite":34,"hp":86,"attack":44,"defense":44,"hpCap":86,"attackCap":44,"defenseCap":44,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"59":{"name":"槍騎兵              ","sprite":34,"hp":82,"attack":41,"defense":41,"hpCap":82,"attackCap":41,"defenseCap":41,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"60":{"name":"親衛隊•銃兵        ","sprite":38,"hp":95,"attack":50,"defense":50,"hpCap":95,"attackCap":50,"defenseCap":50,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"61":{"name":"親衛隊•步兵        ","sprite":38,"hp":91,"attack":45,"defense":45,"hpCap":91,"attackCap":45,"defenseCap":45,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"62":{"name":"亞休華特兵          ","sprite":33,"hp":73,"attack":36,"defense":36,"hpCap":73,"attackCap":36,"defenseCap":36,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"63":{"name":"薩奇古裝甲槍兵      ","sprite":36,"hp":118,"attack":55,"defense":64,"hpCap":118,"attackCap":55,"defenseCap":64,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"64":{"name":"薩奇古槍兵          ","sprite":36,"hp":100,"attack":50,"defense":50,"hpCap":100,"attackCap":50,"defenseCap":50,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"65":{"name":"赫蘭德機槍兵        ","sprite":31,"hp":145,"attack":77,"defense":68,"hpCap":145,"attackCap":77,"defenseCap":68,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"66":{"name":"赫蘭德槍兵          ","sprite":31,"hp":127,"attack":68,"defense":59,"hpCap":127,"attackCap":68,"defenseCap":59,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"67":{"name":"布拉奇亞士兵        ","sprite":30,"hp":100,"attack":50,"defense":50,"hpCap":100,"attackCap":50,"defenseCap":50,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"68":{"name":"布拉奇亞司令官      ","sprite":30,"hp":123,"attack":64,"defense":64,"hpCap":123,"attackCap":64,"defenseCap":64,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"69":{"name":"布拉奇亞國王        ","sprite":36,"hp":145,"attack":73,"defense":73,"hpCap":145,"attackCap":73,"defenseCap":73,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"70":{"name":"克雷休傭兵          ","sprite":33,"hp":164,"attack":82,"defense":82,"hpCap":164,"attackCap":82,"defenseCap":82,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"71":{"name":"羅狄亞斯傭兵        ","sprite":45,"hp":182,"attack":91,"defense":91,"hpCap":182,"attackCap":91,"defenseCap":91,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"72":{"name":"巴特奇斯戰�壯L      ","sprite":38,"hp":227,"attack":118,"defense":109,"hpCap":227,"attackCap":118,"defenseCap":109,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"73":{"name":"巴特奇斯兵          ","sprite":38,"hp":200,"attack":100,"defense":100,"hpCap":200,"attackCap":100,"defenseCap":100,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"74":{"name":"機械兵              ","sprite":40,"hp":45,"attack":23,"defense":23,"hpCap":45,"attackCap":23,"defenseCap":23,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"75":{"name":"裝甲強化型機械兵    ","sprite":40,"hp":91,"attack":45,"defense":45,"hpCap":91,"attackCap":45,"defenseCap":45,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"76":{"name":"火力強化型機械兵    ","sprite":40,"hp":136,"attack":68,"defense":68,"hpCap":136,"attackCap":68,"defenseCap":68,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"77":{"name":"重裝機兵            ","sprite":40,"hp":908,"attack":90,"defense":90,"hpCap":908,"attackCap":90,"defenseCap":90,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"78":{"name":"","sprite":24,"hp":0,"attack":0,"defense":0,"hpCap":0,"attackCap":0,"defenseCap":0,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"79":{"name":"巴蘭特傭兵          ","sprite":24,"hp":1,"attack":1,"defense":1,"hpCap":1,"attackCap":1,"defenseCap":1,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"80":{"name":"克蘭諾狄斯傭兵      ","sprite":24,"hp":1,"attack":1,"defense":1,"hpCap":1,"attackCap":1,"defenseCap":1,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"81":{"name":"柏林克南傭兵        ","sprite":24,"hp":1,"attack":1,"defense":1,"hpCap":1,"attackCap":1,"defenseCap":1,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"82":{"name":"魔法兵              ","sprite":24,"hp":1,"attack":1,"defense":1,"hpCap":1,"attackCap":1,"defenseCap":1,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"83":{"name":"克雷休槍兵          ","sprite":24,"hp":1,"attack":1,"defense":1,"hpCap":1,"attackCap":1,"defenseCap":1,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"84":{"name":"卡特蘭斯兵          ","sprite":24,"hp":1,"attack":1,"defense":1,"hpCap":1,"attackCap":1,"defenseCap":1,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"85":{"name":"","sprite":0,"hp":0,"attack":0,"defense":0,"hpCap":0,"attackCap":0,"defenseCap":0,"skill1":0,"skill2":0,"skill3":0,"skill1Cap":0,"skill2Cap":0,"skill3Cap":0},"-1":{"name":"P06.PXZ","sprite":48,"hp":11832,"attack":22608,"defense":90,"hpCap":16717,"attackCap":12368,"defenseCap":11833,"skill1":22608,"skill2":90,"skill3":240,"skill1Cap":0,"skill2Cap":-4088,"skill3Cap":0}},"items":{"-1":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"0":[171,210,176,168,164,226,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,0,0,200,0,0,0,1,0,0,0,0,0,0,0,8,0,0,0,9,0,0,0,0,255],"1":[180,182,171,110,164,210,164,226,186,106,32,32,32,32,0,0,0,0,0,0,0,1,0,194,1,0,0,1,0,0,0,0,0,0,0,12,0,0,0,9,0,0,0,0,255],"2":[164,210,185,112,180,181,164,226,186,106,32,32,32,32,0,0,0,0,0,0,0,2,0,232,3,0,0,1,0,0,0,0,0,0,0,18,0,0,0,9,0,0,0,0,255],"3":[182,79,190,124,164,226,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,3,0,252,8,0,0,1,0,0,0,0,0,0,0,27,0,0,0,9,0,0,0,0,255],"4":[180,163,168,200,164,226,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,4,0,124,21,0,0,1,0,0,0,0,0,0,0,41,0,0,0,9,0,0,0,0,255],"5":[165,91,171,110,49,54,56,56,168,66,186,106,32,32,0,0,0,0,0,0,0,5,0,250,0,0,0,2,0,0,0,0,0,0,0,10,0,0,0,8,0,0,0,0,255],"6":[165,91,171,110,50,55,56,56,168,66,186,106,32,32,0,0,0,0,0,0,0,6,0,244,1,0,0,2,0,0,0,0,0,0,0,15,0,0,0,8,0,0,0,0,255],"7":[168,200,167,74,180,181,162,207,171,172,168,66,186,106,0,0,0,0,0,0,0,7,0,232,3,0,0,2,0,0,0,0,0,0,0,20,0,0,0,8,0,0,0,0,255],"8":[168,200,167,74,180,181,162,208,171,172,168,66,186,106,0,0,0,0,0,0,0,8,0,8,7,0,0,2,0,0,0,0,0,0,0,27,0,0,0,8,0,0,0,0,255],"9":[182,240,171,110,168,66,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,9,0,116,14,0,0,2,0,0,0,0,0,0,0,38,0,0,0,8,0,0,0,0,255],"10":[165,100,177,111,168,66,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,10,0,76,29,0,0,2,0,0,0,0,0,0,0,55,0,0,0,8,0,0,0,0,255],"11":[188,119,169,212,165,172,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,11,0,176,54,0,0,2,0,0,0,0,0,0,0,75,0,0,0,8,0,0,0,0,255],"12":[170,252,164,106,168,200,168,66,186,106,32,32,32,32,0,0,0,0,0,0,0,12,0,168,97,0,0,2,0,0,0,0,0,0,0,100,0,0,0,8,0,0,0,0,255],"13":[190,124,185,112,181,225,190,247,186,106,32,32,32,32,0,0,0,0,0,0,0,13,0,64,6,0,0,3,0,0,0,0,0,0,0,10,0,0,0,20,0,0,0,0,255],"14":[165,106,165,172,190,124,190,247,186,106,32,32,32,32,0,0,0,0,0,0,0,14,0,60,15,0,0,3,0,0,0,0,0,0,0,12,0,0,0,26,0,0,0,0,255],"15":[169,95,188,119,170,214,190,247,186,106,32,32,32,32,0,0,0,0,0,0,0,15,0,240,35,0,0,3,0,0,0,0,0,0,0,15,0,0,0,32,0,0,0,0,255],"16":[165,100,171,210,168,200,190,247,186,106,32,32,32,32,0,0,0,0,0,0,0,16,0,80,70,0,0,3,0,0,0,0,0,0,0,18,0,0,0,38,0,0,0,0,255],"17":[165,106,165,91,174,166,190,247,186,106,32,32,32,32,0,0,0,0,0,0,0,17,0,112,148,0,0,3,0,0,0,0,0,0,0,23,0,0,0,42,0,0,0,0,255],"18":[194,196,169,212,168,224,173,171,190,247,186,106,32,32,0,0,0,0,0,0,0,18,0,64,31,0,0,4,0,0,0,0,0,0,0,28,0,0,0,16,0,0,0,0,255],"19":[194,196,170,107,168,224,173,171,190,247,186,106,32,32,0,0,0,0,0,0,0,19,0,32,78,0,0,4,0,0,0,0,0,0,0,40,0,0,0,18,0,0,0,0,255],"20":[165,100,185,112,173,171,190,247,186,106,32,32,32,32,0,0,0,0,0,0,0,20,0,128,187,0,0,4,0,0,0,0,0,0,0,50,0,0,0,22,0,0,0,0,255],"21":[180,181,169,95,185,112,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,21,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255],"22":[167,81,165,172,167,74,186,106,32,32,32,32,32,32,0,0,0,0,0,0,0,22,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255],"23":[165,172,187,180,241,90,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,21,0,180,0,0,0,5,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,255],"24":[165,214,187,180,241,90,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,22,0,88,2,0,0,5,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,255],"25":[190,240,175,215,187,180,241,90,32,32,32,32,32,32,0,0,0,0,0,0,0,23,0,220,5,0,0,5,0,0,0,0,0,0,0,0,0,18,0,0,0,0,0,0,255],"26":[165,98,166,88,166,168,187,180,241,90,32,32,32,32,0,0,0,0,0,0,0,24,0,136,19,0,0,5,0,0,0,0,0,0,0,0,0,24,0,0,0,0,0,0,255],"27":[182,87,166,88,166,168,187,180,241,90,32,32,32,32,0,0,0,0,0,0,0,25,0,152,58,0,0,5,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,255],"28":[190,84,241,90,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,26,0,240,0,0,0,6,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,255],"29":[187,201,241,90,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,27,0,32,3,0,0,6,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,255],"30":[197,75,241,90,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,28,0,8,7,0,0,6,0,0,0,0,0,0,0,0,0,20,0,0,0,0,0,0,255],"31":[191,251,241,90,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,29,0,124,21,0,0,6,0,0,0,0,0,0,0,0,0,28,0,0,0,0,0,0,255],"32":[166,88,170,247,241,90,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,30,0,16,39,0,0,6,0,0,0,0,0,0,0,0,0,34,0,0,0,0,0,0,255],"33":[182,194,170,247,191,251,241,90,32,32,32,32,32,32,0,0,0,0,0,0,0,31,0,80,70,0,0,6,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,255],"34":[220,103,166,88,170,247,241,90,32,32,32,32,32,32,0,0,0,0,0,0,0,32,0,96,109,0,0,6,0,0,0,0,0,0,0,0,0,60,0,0,0,0,0,0,255],"35":[182,87,166,88,170,247,241,90,32,32,32,32,32,32,0,0,0,0,0,0,0,33,0,200,175,0,0,6,0,0,0,0,0,0,0,0,0,84,0,0,0,0,0,0,255],"36":[197,75,173,171,241,90,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,34,0,116,64,0,0,7,0,0,0,0,0,0,0,0,0,45,0,0,0,0,0,0,255],"37":[191,251,173,171,241,90,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,35,0,0,125,0,0,7,0,0,0,0,0,0,0,0,0,65,0,0,0,0,0,0,255],"38":[166,88,170,247,173,171,241,90,32,32,32,32,32,32,0,0,0,0,0,0,0,36,0,96,234,0,0,7,0,0,0,0,0,0,0,0,0,90,0,0,0,0,0,0,255],"39":[182,87,166,88,170,247,173,171,241,90,32,32,32,32,0,0,0,0,0,0,0,37,0,144,95,1,0,7,0,0,0,0,0,0,0,0,0,110,0,0,0,0,0,0,255],"40":[166,94,180,95,189,166,197,110,32,32,162,176,32,32,0,0,0,0,0,0,0,38,0,10,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,5],"41":[166,94,180,95,189,166,197,110,32,32,162,177,32,32,0,0,0,0,0,0,0,39,0,40,0,0,0,0,0,0,0,25,0,0,0,0,0,0,0,0,0,0,0,0,5],"42":[166,94,180,95,189,166,197,110,32,32,162,178,32,32,0,0,0,0,0,0,0,40,0,100,0,0,0,0,0,0,0,50,0,0,0,0,0,0,0,0,0,0,0,0,5],"43":[166,94,180,95,189,166,197,110,32,32,162,179,32,32,0,0,0,0,0,0,0,41,0,250,0,0,0,0,0,0,0,99,0,0,0,0,0,0,0,0,0,0,0,0,5],"44":[180,95,173,236,195,196,162,176,32,32,32,32,32,32,0,0,0,0,0,0,0,39,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,25,5],"45":[180,95,173,236,195,196,162,177,32,32,32,32,32,32,0,0,0,0,0,0,0,39,0,25,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,50,5],"46":[180,95,173,236,195,196,162,178,32,32,32,32,32,32,0,0,0,0,0,0,0,39,0,60,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,75,5],"47":[180,95,173,236,195,196,162,179,32,32,32,32,32,32,0,0,0,0,0,0,0,39,0,150,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,99,5],"48":[175,83,174,237,189,166,197,110,162,176,32,32,32,32,0,0,0,0,0,0,0,40,0,16,39,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],"49":[175,83,174,237,189,166,197,110,162,177,32,32,32,32,0,0,0,0,0,0,0,40,0,32,78,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],"50":[175,83,174,237,189,166,197,110,162,178,32,32,32,32,0,0,0,0,0,0,0,40,0,64,156,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],"51":[175,83,174,237,189,166,197,110,162,179,32,32,32,32,0,0,0,0,0,0,0,40,0,128,56,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],"52":[196,95,165,219,172,211,171,97,32,32,32,32,32,32,0,0,0,0,0,0,0,42,0,200,175,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,40,0,0,1],"53":[198,112,165,219,172,211,171,97,32,32,32,32,32,32,0,0,0,0,0,0,0,43,0,244,120,1,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,80,0,0,1],"54":[167,217,171,252,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,44,0,232,3,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],"55":[182,181,193,229,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,45,0,224,46,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,1],"56":[165,213,175,189,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,46,0,160,15,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,1],"57":[172,245,175,189,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,47,0,192,93,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,20,0,0,1],"58":[164,209,175,175,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,48,0,224,46,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,25,0,0,0,1],"59":[183,124,173,251,195,210,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,49,0,232,3,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,1],"60":[197,75,194,241,32,32,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,50,0,176,4,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,1],"61":[164,81,166,114,194,238,32,32,32,32,32,32,32,32,0,0,0,0,0,0,0,51,0,128,62,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,0,1],"62":[179,183,190,124,171,172,184,203,173,121,168,174,32,32,32,32,32,32,32,32,0,0,0,128,12,0,0,255,0,0,0,0,0,50,0,35,0,45,0,0,0,0,0,0,255],"63":[180,163,173,67,171,172,190,212,168,174,32,32,32,32,32,32,32,32,32,32,0,0,0,192,18,0,0,255,0,0,0,0,0,60,0,55,0,60,0,0,0,0,0,0,255],"64":[193,218,168,186,166,204,171,172,190,212,168,174,32,32,32,32,32,32,32,32,0,2,0,128,37,0,0,255,0,0,0,0,0,70,0,90,0,80,0,0,0,0,0,0,255],"65":[180,163,170,107,167,240,171,176,183,102,32,32,32,32,32,32,32,32,32,32,0,3,0,224,71,0,0,255,0,0,0,0,0,80,0,150,0,110,0,0,0,0,0,0,255],"66":[196,245,165,100,178,190,176,202,175,165,32,32,32,32,32,32,32,32,32,32,0,4,0,0,150,0,0,255,0,0,0,0,0,90,0,255,0,155,0,0,0,0,0,0,255],"67":[176,210,170,107,178,190,176,202,175,165,32,32,32,32,32,32,32,32,32,32,0,5,0,0,44,1,0,255,0,0,0,0,0,100,0,174,1,215,0,0,0,0,0,0,255],"68":[166,204,196,245,171,172,190,212,168,174,32,32,32,32,32,32,32,32,32,32,0,6,0,224,109,2,0,255,0,0,0,0,0,110,0,218,2,44,1,0,0,0,0,0,255],"69":[188,119,169,212,168,103,190,212,168,174,32,32,32,32,32,32,32,32,32,32,0,7,0,32,185,3,0,255,0,0,0,0,0,130,0,132,3,164,1,0,0,0,0,0,255],"70":[188,119,196,245,174,230,186,184,175,197,195,122,192,187,190,247,32,32,32,32,0,8,0,120,30,0,0,255,0,0,0,0,0,24,0,90,0,40,0,0,0,0,0,0,255],"71":[168,169,168,200,171,172,195,122,192,187,190,247,32,32,32,32,32,32,32,32,0,9,0,56,49,0,0,255,0,0,0,0,0,38,0,125,0,50,0,0,0,0,0,0,255],"72":[169,212,175,83,173,74,167,74,167,240,171,176,190,247,32,32,32,32,32,32,0,10,0,176,79,0,0,255,0,0,0,0,0,52,0,175,0,65,0,0,0,0,0,0,255],"73":[185,70,164,79,175,197,195,122,192,187,190,247,32,32,32,32,32,32,32,32,0,11,0,144,126,0,0,255,0,0,0,0,0,66,0,245,0,80,0,0,0,0,0,0,255],"74":[194,197,164,218,175,197,195,122,192,187,190,247,32,32,32,32,32,32,32,32,0,12,0,232,203,0,0,255,0,0,0,0,0,80,0,84,1,100,0,0,0,0,0,0,255],"75":[176,168,182,174,175,197,195,122,192,187,190,247,32,32,32,32,32,32,32,32,0,13,0,208,76,1,0,255,0,0,0,0,0,94,0,219,1,130,0,0,0,0,0,0,255],"76":[180,181,185,70,177,246,186,184,175,197,195,122,192,187,190,247,32,32,32,32,0,14,0,104,29,2,0,255,0,0,0,0,0,108,0,153,2,165,0,0,0,0,0,0,255],"77":[165,105,169,212,188,119,169,212,169,105,175,197,195,122,192,187,190,247,32,32,0,15,0,64,113,3,0,255,0,0,0,0,0,122,0,162,3,210,0,0,0,0,0,0,255],"78":[190,124,165,106,188,119,175,165,32,32,32,32,32,32,32,32,32,32,32,32,0,16,0,208,7,0,0,255,0,0,0,0,0,0,0,24,0,0,0,0,0,0,0,0,255],"79":[165,91,171,110,175,165,32,32,32,32,32,32,32,32,32,32,32,32,32,32,0,17,0,184,11,0,0,255,0,0,0,0,0,0,0,35,0,0,0,0,0,0,0,0,255],"80":[188,119,171,110,177,70,186,184,175,165,32,32,32,32,32,32,32,32,32,32,0,18,0,136,19,0,0,255,0,0,0,0,0,0,0,55,0,0,0,0,0,0,0,0,255],"81":[190,124,182,174,167,240,171,176,175,165,32,32,32,32,32,32,32,32,32,32,0,19,0,40,35,0,0,255,0,0,0,0,0,0,0,90,0,0,0,0,0,0,0,0,255],"82":[185,112,169,105,167,240,171,176,175,165,32,32,32,32,32,32,32,32,32,32,0,20,0,128,62,0,0,255,0,0,0,0,0,0,0,145,0,0,0,0,0,0,0,0,255],"83":[190,124,178,166,167,74,168,238,192,163,175,165,32,32,32,32,32,32,32,32,0,21,0,96,109,0,0,255,0,0,0,0,0,0,0,235,0,0,0,0,0,0,0,0,255],"84":[175,83,168,189,185,112,188,119,195,122,192,187,175,165,32,32,32,32,32,32,0,22,0,128,187,0,0,255,0,0,0,0,0,0,0,129,1,0,0,0,0,0,0,0,255],"85":[173,244,171,210,188,119,168,200,166,104,179,115,184,203,175,165,32,32,32,32,0,23,0,32,72,1,0,255,0,0,0,0,0,0,0,123,2,0,0,0,0,0,0,0,255]},"formations":[{"name":" 魚鱗陣             ","positions":[[16,204],[16,272],[48,238],[64,170],[64,306],[96,204],[96,272],[160,221],[160,255],[192,187],[192,289]]},{"name":" 鐵扇陣         　　","positions":[[32,204],[32,238],[32,272],[32,170],[32,306],[96,187],[96,289],[96,221],[96,255],[208,255],[208,221]]},{"name":" 十字陣         　　","positions":[[16,238],[48,170],[48,306],[80,204],[80,272],[96,238],[144,204],[144,272],[208,170],[208,306],[208,238]]},{"name":" 鋒矢陣          　 ","positions":[[16,238],[80,221],[80,255],[144,272],[144,204],[144,238],[208,170],[208,306],[208,204],[208,238],[208,272]]},{"name":" 鶴翼陣          　 ","positions":[[80,170],[80,306],[144,170],[144,204],[144,272],[144,306],[208,170],[208,204],[208,238],[208,272],[208,306]]},{"name":" 圓錐陣           　","positions":[[32,204],[32,238],[32,272],[96,170],[96,204],[96,238],[96,272],[96,306],[160,204],[160,238],[160,272]]},{"name":" 百翼陣           　","positions":[[16,170],[16,238],[16,306],[64,204],[64,272],[112,238],[160,204],[160,272],[208,170],[208,238],[208,306]]},{"name":" 雙蛇陣        　　 ","positions":[[16,170],[16,204],[16,272],[16,306],[80,170],[80,204],[80,272],[80,306],[176,204],[176,272],[208,238]]},{"name":" Ｄ形陣           　","positions":[[16,170],[16,204],[16,272],[16,306],[80,170],[80,306],[96,221],[96,255],[176,187],[176,289],[192,238]]},{"name":" 一騎陣           　","positions":[[16,238],[144,170],[144,204],[144,238],[144,272],[144,306],[208,170],[208,204],[208,238],[208,272],[208,306]]},{"name":" 山形陣         　　","positions":[[16,238],[64,204],[64,272],[96,170],[96,306],[112,238],[160,204],[160,272],[192,170],[192,306],[208,238]]},{"name":" 前列陣             ","positions":[[16,170],[16,204],[16,238],[16,272],[16,306],[80,170],[80,204],[80,238],[80,272],[80,306],[208,238]]},{"name":" 強衛陣             ","positions":[[16,204],[16,238],[16,272],[80,170],[80,221],[80,255],[80,306],[144,238],[208,238],[208,170],[208,306]]},{"name":" 強襲陣           　","positions":[[16,204],[16,272],[48,170],[48,306],[64,238],[128,204],[128,238],[128,272],[192,204],[192,238],[192,272]]},{"name":" 長蛇陣         　　","positions":[[16,204],[16,272],[48,238],[80,204],[80,272],[112,238],[144,204],[144,272],[176,238],[208,204],[208,272]]},{"name":" 車懸陣           　","positions":[[16,272],[16,306],[80,272],[80,306],[144,272],[144,306],[208,170],[208,204],[208,238],[208,272],[208,306]]}]};
  /* ORIGINAL_DATA_END */
  return {i8,i16,i32,actor,actorBytes,classStat,covered,selectTarget,nextAnimationState,randomRange,damageAmount,attackTick,canAttack,buildFriendly,buildEnemy,writeBackFriendly,healMember,autoHeal,visualRandom,retreatSpread,createBattle,stepBattle,commandBattle,worldDamage,skilledWorldDamage,infantrySiegeDamage,counterfireMembers,worldVisualRandom,tankCounterfire,planeCounterfire,unitCombatSummary,encounterPercent,returnHome,reduceBase,captureBase,siegeHour,baseAttackHour,worldCombatHour,battleSpriteLayers,originalData,fields,
    source:{mainSha256:'08ed144e8f8d6e97d19f0759bce2420665998143f2f0f056ab7adc718e550e3e',combatBankFileOffset:0x6e1e0,combatBankToken:0xbc8},
    coverage:{arithmetic:'verified against original instructions',battleLoop:'405 continuous rounds plus 80 boundary rounds',setup:'24 complete original entries',retreat:'13 original menu branches',worldCombat:'128 original hourly siege/base-fire cases including capture and interception',spriteCommands:'160 original draw-command layouts; pixels not rendered by oracle',rewards:'cash accumulator exposed; campaign helper owns settlement',unknown:['Host clock/input/audio and exact pixel rendering are environment boundaries.','Invalid class/item IDs and invalid terrain types retain original undefined/division-fault boundaries.','Campaign loss-story effects and accounting are integrated by OriginalCampaign.']}};
});
