/* Recovered original DOS rules. Addressed evidence: research/hr-full-restoration/transport. */
(function (root,factory) {
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.OriginalTransport=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function () {
  'use strict';
  const MODES=Object.freeze({foot:0,tank:1,plane:2});
  const LABELS=Object.freeze(['徒步移動','車輛移動','飛行移動']);
  const empty=id=>id===undefined||id===null||id===-1||id===255;
  const slot=kind=>({tank:'tankId',plane:'planeId',cannon:'cannonId'})[kind];
  function decodeUnit(raw){
    if(!raw||raw.length!==382)throw new RangeError('Expected original 382-byte unit record');
    const v=new DataView(Uint8Array.from(raw).buffer),s=o=>v.getInt16(o,true),b=o=>v.getInt8(o);
    return {order:s(38),moveMode:s(40),active:s(42),subtype:s(44),targetBase:s(49),x10:s(51),y10:s(53),tankId:b(58),tankDurability:s(59),planeId:b(61),planeDurability:s(62),cannonId:b(64),retreatBase:s(67),raw45:s(69),destinationBase:s(71),targetX:s(73),targetY:s(75),members:Array.from({length:11},(_,i)=>{const p=85+i*27,weapon=b(p+21),armor=b(p+22),third=b(p+23);return {slot:i,classId:s(p),hp:s(p+2),raw6:s(p+6),fatigue:s(p+18),formationSlot:b(p+20),weapon,armor:armor<0?-1:armor+23,third:third<0?-1:third+40,thirdCount:raw[p+24],raw25:raw[p+25],raw26:raw[p+26],rawBytes:Array.from(raw.slice(p,p+27))};})};
  }
  // FBOV BD8:1569..185F; current/target are original base objects, null means -1 lookup.
  function movementOptions(unit,current,target,context={}){
    if(!unit)throw new TypeError('Unit required');
    const tank=!empty(unit.tankId),plane=!empty(unit.planeId);
    // The original calls BB0:E8 before checking membership. Caller must apply that story hook.
    if(unit.tankId===7){
      const has28=context.hasClass28??(unit.members||[]).some(m=>m.classId===28);
      if(!has28)return {forced:1,choices:[1],requiresSpecialTankHook:true};
    }
    if(unit.moveMode===2)return {forced:2,choices:[2]};
    if(!tank&&!plane)return {forced:0,choices:[0]};
    if((!current||!target)&&plane&&!tank)return {forced:0,choices:[0]};
    const choices=[0];if(tank)choices.push(1);
    if(current&&target&&current.id!==target.id&&plane&&unit.order!==5&&current.kind!==4&&current.kind!==2&&current.state5D===0&&(target.state5D===0||(target.kind===2&&unit.order!==6)))choices.push(2);
    return {forced:null,choices};
  }
  function chooseMovement(options,index){
    if(options.forced!==null)return options.forced;
    if(index===-1)return -1;
    if(!Number.isInteger(index)||index<0||index>=options.choices.length)throw new RangeError('Invalid original movement menu index');
    return options.choices[index];
  }
  function stockItem(code){
    if(!Number.isInteger(code)||code<40||code>63)return null;
    const kind=code<48?'tank':code<56?'cannon':'plane';
    const typeId=code===40?7:code<48?code-41:code<56?code-48:code-56;
    return {kind,typeId,itemId:({tank:62,plane:70,cannon:78})[kind]+typeId};
  }
  function vehicle(catalog,kind,typeId){
    const v=catalog.find(v=>v.kind===kind&&v.typeId===typeId);
    if(!v)throw new RangeError('Unknown recovered vehicle');return v;
  }
  function tradeQuote(unit,catalog,kind,newTypeId=null,storyByte20=0){
    const key=slot(kind);if(!key)throw new RangeError('Unknown original vehicle slot');
    const old=empty(unit[key])?null:vehicle(catalog,kind,unit[key]);
    if(kind==='tank'&&unit.tankId===7&&storyByte20!==0)return {ok:false,reason:'story-locked-tank'};
    if(newTypeId===null&&!old)return {ok:false,reason:'empty-slot'};
    const next=newTypeId===null?null:vehicle(catalog,kind,newTypeId);
    const resale=old?Math.trunc(old.price/2):0;
    return {ok:true,kind,newTypeId,cost:(next?next.price:0)-resale,resale,maxDurability:next?next.maxDurability:0};
  }
  // Caller validates that the unit is at the shop and stockItem matches this quote.
  function applyTrade(unit,money,quote){
    if(!quote.ok)return {ok:false,reason:quote.reason};
    if(money<quote.cost)return {ok:false,reason:'insufficient-funds'};
    const next={...unit,[slot(quote.kind)]:quote.newTypeId===null?-1:quote.newTypeId};
    if(quote.newTypeId!==null&&quote.kind!=='cannon')next[quote.kind+'Durability']=quote.maxDurability;
    return {ok:true,unit:next,money:money-quote.cost};
  }
  // 1B8C:0AB6..0C30 and 1E5F:0442/0486; original random has an exclusive upper bound.
  function repairTick(unit,base,catalog,draw){
    if(unit.active!==1||unit.order!==2||unit.subtype===4)return {...unit};
    if(!base)throw new RangeError('Original repair requires a current base');
    if(typeof draw!=='function')throw new TypeError('Provide original-compatible random range draw');
    const next={...unit},max=Math.trunc(base.raw1C/100)+1;
    for(const kind of ['plane','tank'])if(!empty(next[slot(kind)])){
      const cap=vehicle(catalog,kind,next[slot(kind)]).maxDurability,key=kind+'Durability';
      if(next[key]<cap){const delta=draw(1,max);if(!Number.isInteger(delta)||delta<1||delta>=Math.max(2,max))throw new RangeError('Random draw outside recovered bounds');next[key]=Math.min(cap,next[key]+delta);}
    }return next;
  }
  // BB8:1AE7/1BC8 -> resident 2404:0409; only the selected unit is relocated.
  function ferryDestination(baseId){return baseId===27?28:baseId===28?27:null;}
  function boardFerry(unit,baseId,bases){
    const destination=ferryDestination(baseId);if(destination===null)return {ok:false,reason:'no-original-ferry'};
    const source=bases.find(b=>b.id===baseId),target=bases.find(b=>b.id===destination);
    if(!source||!target)throw new RangeError('Missing recovered ferry endpoint');
    if(Math.trunc(unit.x10/10)!==source.x||Math.trunc(unit.y10/10)!==source.y)return {ok:false,reason:'not-at-ferry'};
    return {ok:true,destination,unit:{...unit,moveMode:0,order:0,x10:target.x*10,y10:target.y*10,targetX:target.x,targetY:target.y,targetBase:-1,lastBase:destination,currentBase:destination}};
  }
  // Resident 1975:0236..0324. Preserve the original 0..250 subclock and 25 hourly callbacks.
  function clockStep(clock){
    let {subtick,hour}=clock;
    if(!Number.isInteger(subtick)||subtick<0||subtick>250||!Number.isInteger(hour)||hour<0||hour>25)throw new RangeError('Invalid original clock');
    const hourly=Math.trunc(subtick/10)-1===hour,newDay=hourly&&(hour&255)===0;
    if(hourly)hour++;
    if(subtick>249){subtick=0;hour=0;}else subtick++;
    return {subtick,hour,movement:!hourly,hourly,newDay};
  }
  // Exact FIFO/early-stop search from resident 2F36:0430..0741, including 511-entry capacity.
  function pathStep(grid,x10,y10,targetX,targetY,mode=0){
    if(grid.width!==128||grid.height!==96||grid.terrain.length!==12288)throw new RangeError('Original grid must be 128 by 96');
    if(!Number.isInteger(mode)||mode<0||mode>3)throw new RangeError('Original terrain mode 0..3 required');
    const sx=Math.trunc((x10&65535)/10),sy=Math.trunc((y10&65535)/10),valid=(x,y)=>x>=0&&x<128&&y>=0&&y<96;
    if(!valid(sx,sy)||!valid(targetX,targetY))throw new RangeError('Original world coordinate outside map');
    if(sx===targetX&&sy===targetY)return {x10,y10,direction:-1,arrived:true,moved:false};
    const distance=new Uint16Array(12288).fill(0x3fff),queue=new Uint16Array(512),blocked=new Set(grid.blockedCells||[]);
    for(const i of blocked)if(i>=0&&i<12288)distance[i]|=0x4000;
    const start=sy*128+sx,end=targetY*128+targetX,speed=(x,y)=>grid.coefficients[grid.terrain[y*128+x]]?.[mode]||0;
    distance[start]=(distance[start]&0xc000)|0x3ffe;
    if(distance[end]&0x4000)return {x10,y10,direction:-1,arrived:false,moved:false};
    distance[end]&=0xc000;queue[0]=(targetY<<8)|targetX;
    let head=0,tail=1,stop=false,expanded=0;
    while(head!==tail&&!stop){
      const q=queue[head];head=(head+1)&511;const x=q&255,y=q>>>8,current=distance[y*128+x]&0x3fff;expanded++;
      for(const [nx,ny] of [[x,y-1],[x+1,y],[x,y+1],[x-1,y]]){
        if(!valid(nx,ny))continue;const i=ny*128+nx;if(distance[i]&0x4000)continue;
        const old=distance[i]&0x3fff;if(old===0x3ffe){stop=true;break;}
        const coefficient=speed(nx,ny);if(!coefficient)continue;
        const candidate=(10-coefficient+current)&65535;if(candidate>=old)continue;
        distance[i]=(distance[i]&0xc000)|(candidate&0x3fff);queue[tail]=(ny<<8)|nx;
        const next=(tail+1)&511;if(next===head){stop=true;break;}tail=next;
      }
    }
    let best=distance[start]&0x3fff,direction=-1,coefficient=0;
    const neighbours=[[sx,sy-1],[sx+1,sy],[sx,sy+1],[sx-1,sy]];
    for(let d=0;d<4;d++){const [x,y]=neighbours[d];if(!valid(x,y))continue;const cost=distance[y*128+x]&0x3fff;
      if(d===0?cost<best:cost<=best){best=cost;direction=d;coefficient=speed(x,y);}
    }
    if(direction===0)y10-=coefficient;else if(direction===1)x10+=coefficient;else if(direction===2)y10+=coefficient;else if(direction===3)x10-=coefficient;
    return {x10,y10,direction,arrived:false,moved:coefficient!==0&&direction!==-1,expanded};
  }
  const docked=(u,baseId)=>!!u&&u.active===1&&u.order===2&&u.targetBase===baseId;
  function transferVehicle(units,sourceId,targetId,kind,baseId){
    const source=units[sourceId],target=units[targetId],key=slot(kind);
    if(!key)return {ok:false,reason:'invalid-kind'};
    if(sourceId===targetId)return {ok:false,reason:'same-unit'};
    if(!docked(source,baseId)||!docked(target,baseId))return {ok:false,reason:'not-docked-together'};
    if(empty(source[key]))return {ok:false,reason:'empty-source-slot'};
    if(kind==='tank'&&(source.tankId===7||target.tankId===7))return {ok:false,reason:'untransferable-tank7'};
    const result=units.slice(),a={...source},b={...target};result[sourceId]=a;result[targetId]=b;
    a[key]=empty(target[key])?-1:target[key];b[key]=source[key];
    if(kind!=='cannon'){const durability=kind+'Durability';a[durability]=empty(target[key])?0:target[durability];b[durability]=source[durability];}
    return {ok:true,units:result,swapped:!empty(target[key])};
  }
  // C00:138D..1607 exchanges all personal data except the three slot-local bytes20/25/26.
  function swapMemberRecords(a,b,nameA,nameB){
    if(a.length!==27||b.length!==27||nameA.length!==12||nameB.length!==12)throw new RangeError('Expected 27-byte member records and 12-byte names');
    const left=Array.from(a),right=Array.from(b);
    for(let i=0;i<27;i++)if(i!==20&&i!==25&&i!==26){left[i]=b[i];right[i]=a[i];}
    return {a:left,b:right,nameA:Array.from(nameB),nameB:Array.from(nameA)};
  }
  function transferPersonnel(units,sourceId,sourceSlot,targetId,targetSlot,baseId){
    const source=units[sourceId],target=units[targetId];
    if(!docked(source,baseId)||!docked(target,baseId))return {ok:false,reason:'not-docked-together'};
    if(!Number.isInteger(sourceSlot)||!Number.isInteger(targetSlot)||sourceSlot<0||targetSlot<0||sourceSlot>10||targetSlot>10)return {ok:false,reason:'invalid-member-slot'};
    const a=source.members[sourceSlot],b=target.members[targetSlot];
    if(!a||empty(a.classId))return {ok:false,reason:'empty-source-slot'};
    if(a.classId<=5||(b&&!empty(b.classId)&&b.classId<=5))return {ok:false,reason:'protected-company-leader'};
    const left={...(b||{classId:-1})},right={...a};
    for(const key of ['formationSlot','raw25','raw26']){left[key]=a[key];right[key]=b?.[key];}
    if(a.rawBytes&&b?.rawBytes){const records=swapMemberRecords(a.rawBytes,b.rawBytes,a.nameBytes||new Array(12).fill(0),b.nameBytes||new Array(12).fill(0));left.rawBytes=records.a;right.rawBytes=records.b;left.nameBytes=records.nameA;right.nameBytes=records.nameB;}
    const result=units.slice();result[sourceId]={...source,members:source.members.slice()};
    if(sourceId!==targetId)result[targetId]={...target,members:target.members.slice()};
    result[sourceId].members[sourceSlot]=left;result[targetId].members[targetSlot]=right;
    return {ok:true,units:result,swapped:!!b&&!empty(b.classId)};
  }
  function transferEquipment(units,sourceId,sourceSlot,targetId,targetSlot,equipmentSlot,baseId,items,compatibility){
    const source=units[sourceId],target=units[targetId];
    if(!docked(source,baseId)||!docked(target,baseId))return {ok:false,reason:'not-docked-together'};
    if(!['weapon','armor','third'].includes(equipmentSlot))return {ok:false,reason:'invalid-equipment-slot'};
    const a=source.members[sourceSlot],b=target.members[targetSlot];
    if(!a||!b||empty(a.classId)||empty(b.classId))return {ok:false,reason:'empty-member-slot'};
    if(empty(a[equipmentSlot]))return {ok:false,reason:'empty-source-slot'};
    const allowed=(id,classId)=>{if(empty(id))return true;const item=items.find(x=>(x.index??x.itemId)===id);if(!item)return false;const category=item.categoryCandidate??item.category;return compatibility[category]?.[classId]===1;};
    if(!allowed(a[equipmentSlot],b.classId)||!allowed(b[equipmentSlot],a.classId))return {ok:false,reason:'incompatible-equipment'};
    const result=units.slice();result[sourceId]={...source,members:source.members.slice()};
    if(sourceId!==targetId)result[targetId]={...target,members:target.members.slice()};
    result[sourceId].members[sourceSlot]={...a,[equipmentSlot]:empty(b[equipmentSlot])?-1:b[equipmentSlot]};
    result[targetId].members[targetSlot]={...b,[equipmentSlot]:a[equipmentSlot]};
    if(equipmentSlot==='third'){result[sourceId].members[sourceSlot].thirdCount=b.thirdCount;result[targetId].members[targetSlot].thirdCount=a.thirdCount;}
    return {ok:true,units:result};
  }
  // Resident 1F33:01F8; first matching base wins. Types0..2 occupy a five by five lookup area.
  function baseAt(bases,x10,y10){
    const x=Math.trunc(x10/10),y=Math.trunc(y10/10);
    return bases.find(b=>b.footprintType<=2?Math.abs(b.x-x)<3&&Math.abs(b.y-y)<3:b.footprintType<=6&&b.x===x&&b.y===y)||null;
  }
  function vehicleFailureRetreat(unit,bases){
    if(unit.active!==1||unit.order===1||unit.order===2)return {unit:{...unit},event:null};
    const kind=unit.moveMode===1&&unit.tankDurability<=0?'tank':unit.moveMode===2&&unit.planeDurability<=0?'plane':null;
    if(!kind)return {unit:{...unit},event:null};
    const home=bases.find(b=>b.id===unit.retreatBase);if(!home)throw new RangeError('Missing original retreat-base field43');
    return {unit:{...unit,order:1,targetX:home.x,targetY:home.y,destinationBase:home.id},event:{type:'vehicle-failure-retreat',kind,baseId:home.id}};
  }
  function arrivalStep(unit,bases){
    const events=[];let next={...unit};
    if(next.active!==1)return {unit:next,events,moved:false};
    const x=Math.trunc(next.x10/10),y=Math.trunc(next.y10/10),at=baseAt(bases,next.x10,next.y10);
    const dock=base=>{const oldOrder=next.order;next={...next,order:2,moveMode:0,subtype:oldOrder===6&&base.kind===2?4:0,targetBase:base.id,x10:base.x*10,y10:base.y*10};
      if(oldOrder===0||(oldOrder===6&&base.kind!==2)){next.retreatBase=base.id;next.raw45=base.id;}
      events.push({type:'base-arrival',baseId:base.id,order:oldOrder});};
    if(next.order===6){const dest=baseAt(bases,next.targetX*10,next.targetY*10);if(!dest)return {unit:next,events:[...events,{type:'invalid-attack-destination'}],moved:false};if(at&&at.id===dest.id)dock(dest);}
    else if(next.order===0&&x===next.targetX&&y===next.targetY){
      if(!at){next={...next,order:4};events.push({type:'field-arrival'});}
      else if([0,1,4].includes(at.kind))dock(at);
      else if(at.kind===2)return {unit:next,events:[...events,{type:'attack-arrival',baseId:at.id,mode:next.moveMode}],moved:false,pendingAttack:true};
      else if(at.kind===5){next={...next,order:4,raw45:-1};events.push({type:'field-arrival'});}
    }else if(next.order===1&&x===next.targetX&&y===next.targetY&&at&&[0,1,4].includes(at.kind))dock(at);
    return {unit:next,events,moved:false};
  }
  // Original movement branch calls encounter, failure/retreat, arrival, then coordinate step in that order.
  function travelLoopStep(unit,grid,bases){
    const checked=vehicleFailureRetreat(unit,bases),arrived=arrivalStep(checked.unit,bases),events=[...(checked.event?[checked.event]:[]),...arrived.events],next=arrived.unit;
    if(arrived.pendingAttack||next.active!==1||!([0,1,6,9].includes(next.order)))return {...arrived,events};
    const p=pathStep(grid,next.x10,next.y10,next.targetX,next.targetY,next.moveMode);
    return {unit:{...next,x10:p.x10,y10:p.y10},events,moved:p.moved,direction:p.direction};
  }
  function standbyCommand(unit){return unit.moveMode===2?{ok:false,reason:'cannot-standby-in-flight'}:{ok:true,unit:{...unit,order:4}};}
  function restCommand(unit){return unit.moveMode===2?{ok:false,reason:'cannot-rest-in-flight'}:{ok:true,unit:{...unit,order:3}};}
  function enterBaseCommand(unit,bases){
    const base=baseAt(bases,unit.x10,unit.y10);
    if(!base||![0,1,4].includes(base.kind))return {ok:false,reason:'no-enterable-base'};
    if(unit.moveMode===2)return {ok:false,reason:'cannot-enter-base-in-flight'};
    return {ok:true,unit:{...unit,order:2,moveMode:0,subtype:0,targetBase:base.id},baseId:base.id};
  }
  function retreatCommand(unit,bases,grid,targetBaseId){
    const flight=unit.moveMode===2,base=bases.find(b=>b.id===(flight?unit.retreatBase:targetBaseId));
    if(!base||(!flight&&![0,1,4].includes(base.kind)))return {ok:false,reason:'invalid-retreat-base'};
    if(flight)return {ok:true,unit:{...unit,order:1,targetX:base.x,targetY:base.y,destinationBase:base.id},baseId:base.id};
    const step=pathStep(grid,unit.x10,unit.y10,base.x,base.y,unit.moveMode);
    if(!step.moved)return {ok:false,reason:'no-original-path'};
    return {ok:true,unit:{...unit,order:1,x10:step.x10,y10:step.y10,targetX:base.x,targetY:base.y},baseId:base.id};
  }
  function beginMoveCommand(unit,grid,bases,targetBaseId,mode,context={}){
    const target=bases.find(b=>b.id===targetBaseId);if(!target)return {ok:false,reason:'invalid-destination'};
    if(unit.tankId===7&&!context.specialTankHookApplied)return {ok:false,reason:'special-tank-story-hook-required'};
    const options=movementOptions(unit,baseAt(bases,unit.x10,unit.y10),target,context);
    if(!options.choices.includes(mode))return {ok:false,reason:'unavailable-movement-mode'};
    const order=context.order??0,checkMode=order===6?unit.moveMode:mode;
    const p=pathStep(grid,unit.x10,unit.y10,target.x,target.y,checkMode);if(!p.moved)return {ok:false,reason:'no-original-path'};
    const next={...unit,order,moveMode:mode,x10:p.x10,y10:p.y10,targetX:target.x,targetY:target.y,targetBase:-1,destinationBase:baseAt(bases,target.x*10,target.y*10)?.id??-1};
    if(order===0)next.raw45=baseAt(bases,p.x10,p.y10)?.id??-1;
    if(order===6)next.subtype=0;
    return {ok:true,unit:next};
  }
  // 0D2C:0E1D ordinary world-coordinate picker and accepted path pre-step.
  function fieldMoveCommand(unit,grid,bases,targetX,targetY,mode,context={}){
    if(!Number.isInteger(targetX)||!Number.isInteger(targetY)||targetX<0||targetY<0||targetX>=128||targetY>=96)return {ok:false,reason:'invalid-world-coordinate'};
    if(unit.active!==1||![0,2,3,4,5,6].includes(unit.order)||unit.moveMode===2&&[0,5,6].includes(unit.order))return {ok:false,reason:'move-not-in-native-menu'};
    if(unit.order===2&&!leadersReady(unit))return {ok:false,reason:'protagonist-unavailable'};
    if(context.displayCountry!==undefined&&context.targetCountry!==undefined&&context.displayCountry!==context.targetCountry)return {ok:false,reason:'target-outside-displayed-country'};
    const terrain=grid.terrain[targetY*128+targetX];if(!grid.coefficients[terrain]?.[0])return {ok:false,reason:'destination-terrain-not-selectable'};
    if(unit.tankId===7&&!context.specialTankHookApplied)return {ok:false,reason:'special-tank-story-hook-required'};
    const target=baseAt(bases,targetX*10,targetY*10),current=baseAt(bases,unit.x10,unit.y10),options=movementOptions(unit,current,target,context);
    if(!options.choices.includes(mode))return {ok:false,reason:'unavailable-movement-mode'};
    if([1,2].includes(unit.subtype)&&context.taskInterruptionApproved!==true)return {ok:false,reason:'original-task-confirmation-required',entry:{token:0xbd8,export:0x2a}};
    const step=pathStep(grid,unit.x10,unit.y10,targetX,targetY,mode);if(!step.moved)return {ok:false,reason:'no-original-path'};
    return {ok:true,unit:{...unit,order:0,moveMode:mode,x10:step.x10,y10:step.y10,targetX,targetY,targetBase:-1,destinationBase:target?.id??-1,raw45:baseAt(bases,step.x10,step.y10)?.id??-1}};
  }
  // Original hourly dispatcher: docked HP/fatigue + vehicles; field rest only reduces fatigue.
  function hourlyRecovery(unit,base,catalog,draw){
    let next={...unit,members:(unit.members||[]).map(m=>({...m}))};
    if(next.active!==1)return next;
    const members=next.members.filter(m=>m&&!empty(m.classId)),fatigue=members.reduce((n,m)=>n+(m.fatigue||0),0);
    if(next.order===3){if(fatigue>0)for(const m of members)m.fatigue=Math.max(0,(m.fatigue||0)-3);return next;}
    if(next.order!==2||next.subtype===4)return next;
    if(!base)throw new RangeError('Docked recovery requires original current base');
    for(const m of members)if(!Number.isInteger(m.maxHp)||!Number.isInteger(m.hp))throw new TypeError('Supply original recovered member hp and maxHp');
    if(fatigue>0||members.reduce((n,m)=>n+m.hp,0)<members.reduce((n,m)=>n+m.maxHp,0)){
      const upper=Math.trunc(base.raw1C/100)+1;
      for(const m of members)if(m.hp<m.maxHp){const delta=draw(1,upper);if(!Number.isInteger(delta)||delta<1||delta>=Math.max(2,upper))throw new RangeError('Random draw outside recovered bounds');m.hp=Math.min(m.maxHp,m.hp+delta);}
      for(const m of members)m.fatigue=Math.max(0,(m.fatigue||0)-3);
    }
    next=repairTick(next,base,catalog,draw);return next;
  }
  // 0E5F:06AD checks every named protagonist present, not just member slot zero.
  function leadersReady(unit){return (unit.members||[]).every(m=>m.classId===-1||m.classId>5||(m.hp>0&&m.fatigue<100));}
  // 0E5F:078F selector7 -> 0F33:084D selector7: raw member+0E, accessory type8/9.
  function scoutingPower(unit,accessoryRecords=[]){let sum=0;for(const m of unit.members||[]){if(m.classId===-1)continue;const b=m.rawBytes;if(!b||b.length!==27)throw new TypeError('Supply original member rawBytes or context.scoutPower');let n=(b[14]|b[15]<<8);if(n&32768)n-=65536;const id=b[23]===255?-1:b[23];if(id!==-1&&n>0){const item=accessoryRecords[id];if(!item||item.length!==45)throw new TypeError('Original local accessory record required for scouting stat');if([8,9].includes(item[27]|item[28]<<8))n+=(item[41]<<24)>>24;}n=(n<<16)>>16;sum=(sum+n)|0;}return sum;}
  function basePresentation(base,baseCountry,displayCountry=null){const exists=!!base,shown=exists&&base.kind!==5;return {listed:shown,markerVisible:shown&&(displayCountry===null||baseCountry===displayCountry),ordinaryMoveLabel:exists&&[0,1,2,4].includes(base.kind),scoutTarget:exists&&base.kind===2};}
  // Exact native unit-menu qualification. order2 uses its docked/base context entry0488.
  function commandAvailability(unit,currentBase=null,context={}){
    const ready=leadersReady(unit),power=unit.order===2?(context.scoutPower??scoutingPower(unit,context.accessoryRecords)):null;
    let ids=[],source=0x30b;
    if(unit.active===1){
      if(unit.order===2){ids=['move','baseServices','report','formation'];if(power>0)ids.push('scout');source=0x488;}
      else if(unit.order===1||unit.order===9){ids=['report'];source=unit.order===1?0x3fd:0x1513;}
      else if([0,3,4,5,6].includes(unit.order)){
        if(unit.moveMode===2&&[0,5,6].includes(unit.order)){ids=['report','retreat'];source=0x13b0;}
        else {ids=['move','report','formation','standby','rest'];source=unit.order===5?0x143e:0xfbf;if(unit.order===5)ids.push('attackSettings');else if(currentBase&&[0,1,4].includes(currentBase.kind))ids.push('enterBase');else if(currentBase&&currentBase.kind===2)ids.push('occupy');}
      }
    }
    const labels={move:'移動',baseServices:'停留',report:'報告',formation:'陣形',scout:'偵察',standby:'待機',rest:'休息',enterBase:'據點',retreat:'退卻',occupy:'占領',attackSettings:'攻變更'},out={leaderReady:ready,scoutPower:power,source:{bankToken:0xbd8,offset:source}};
    for(const id of Object.keys(labels))out[id]=ids.includes(id)&&(!(unit.order===2&&['move','scout'].includes(id))||ready)&&!(unit.moveMode===2&&['standby','rest','enterBase'].includes(id));
    out.menu=ids.map(id=>({id,label:labels[id],enabled:out[id]}));return out;
  }
  return Object.freeze({MODES,LABELS,decodeUnit,movementOptions,chooseMovement,stockItem,tradeQuote,applyTrade,repairTick,ferryDestination,boardFerry,clockStep,pathStep,transferVehicle,swapMemberRecords,transferPersonnel,transferEquipment,baseAt,vehicleFailureRetreat,arrivalStep,travelLoopStep,standbyCommand,restCommand,enterBaseCommand,retreatCommand,beginMoveCommand,fieldMoveCommand,hourlyRecovery,leadersReady,scoutingPower,basePresentation,commandAvailability,canUseServices:docked});
});
