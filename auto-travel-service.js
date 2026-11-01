/* Source-bound civilian delivery boundaries and native movement lookahead.
 * MAIN/hash, exact return addresses and natural-chain evidence:
 * research/hr-auto-0.9.0/settlement/EVIDENCE.md. No event is resumed here. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./original-story.js'),require('./original-transport.js'));
  else root.HRAutoTravelService=factory(root.HR_ORIGINAL_STORY,root.OriginalTransport);
})(typeof globalThis==='object'?globalThis:this,function(Story,Transport){
  'use strict';
  const MAIN='08ed144e8f8d6e97d19f0759bce2420665998143f2f0f056ab7adc718e550e3e',GLOBAL=0x4073,CODE=0x6ba9,CONTRACT=0x6445;
  const success=[[0x610,0x6fc],[0x64c,0x6a9],[0x6a9],[0x66d,0x6fc],[0x690,0x6a9],[0x6c4,0x6dd,0x6fc]];
  const expired=new Set([0x7c5,0x80a,0x823,0x83f,0x85d,0x87b,0x894,0x8d9,0x91b,0x934,0x94d]);
  const word=(b,o=0)=>b[o]|b[o+1]<<8,signed=(b,o=0)=>(word(b,o)<<16)>>16,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function countryAt(s,x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=128||y<0||y>=96||s?.originalCampaign?.length!==0x7c68)return -1;
    const b=s.originalCampaign;for(let id=0;id<11;id++){const p=0x28e1+id*73,dx=x-signed(b,p),dy=y-signed(b,p+2);if(dx>=0&&dx<=signed(b,p+4)&&dy>=0&&dy<=signed(b,p+6))return id;}return -1;
  }
  function inspectEvent(s,D){
    const none={kind:null,partyId:null,destinationId:null,safe:false},snap=s?.story?.snapshot,event=s?.story?.event,p=snap?.pending;
    if(!Story||Story.mainSha256!==MAIN||snap?.mainSha256!==MAIN||event?.type!=='text'||p?.type!=='text'||!equal(event.source,p.source)||event.name!==p.name||!equal(event.args,p.args)||s.ended||s.activeBattle?.phase==='active')return none;
    let v;try{v=Story.StoryVM.restore(snap);}catch{return none;}
    const ret=v.read(v.r.ss,v.r.sp,4),ip=word(ret),cs=word(ret,2);let partyId,destinationId,kind;
    if(cs===CODE&&p.name==='dialogue.line'&&p.source?.segment===0x137b&&p.source?.offset===0x1a3){
      partyId=signed(v.read(v.r.ss,v.r.bp+6,2));if(partyId<0||partyId>5)return none;
      const record=v.read(GLOBAL,CONTRACT+partyId*84,84),style=word(record,81);destinationId=signed(record,2);
      if(style>=success.length||!D?.bases?.[destinationId]||!equal(record,s.originalCampaign?.slice(CONTRACT+partyId*84,CONTRACT+(partyId+1)*84)))return none;
      if(success[style].includes(ip)&&signed(record,25)>0)kind='delivery';
      else if(expired.has(ip)&&signed(record,25)===0&&signed(record,27)>0)kind='expiry';
      else return none;
      const unit=v.read(GLOBAL,0x2bdf+partyId*382,382),q=s.squads?.[partyId];
      if(!q||signed(unit,42)!==1||q.active!==1)return none;
      if(kind==='delivery'&&(signed(unit,38)!==2||signed(unit,49)!==destinationId||signed(unit,44)===4||q.originalOrder!==2||q.currentBase!==destinationId||q.subtype===4))return none;
      return {kind,partyId,destinationId,safe:kind==='delivery',source:{segment:0xb88,returnOffset:ip},reason:kind==='expiry'?'native-contract-expired':null};
    }
    if(cs===0x8ce8&&ip===0x1791&&p.name==='input.continuePanel'&&p.source?.segment===0x1497&&p.source?.offset===5){
      const portrait=p.panels?.find(panel=>panel.sourcePointer?.segment===GLOBAL&&panel.sourcePointer.offset>=0x2bdf&&((panel.sourcePointer.offset-0x2bdf)%382)===0),message=p.panels?.find(panel=>panel.sourcePointer?.segment===0x3abc&&panel.sourcePointer.offset===0x43);
      if(!portrait||!message)return none;partyId=(portrait.sourcePointer.offset-0x2bdf)/382;if(partyId<0||partyId>5)return none;
      const unit=v.read(GLOBAL,0x2bdf+partyId*382,382),q=s.squads?.[partyId],x=signed(unit,51),y=signed(unit,53),tx=signed(unit,73),ty=signed(unit,75);
      destinationId=signed(unit,71);const base=s.world?.bases?.find(b=>b.id===destinationId)||D?.original?.transport?.bases?.find(b=>b.id===destinationId);
      if(!q||!base||![0,1,4].includes(base.kind)||signed(unit,42)!==1||q.active!==1||![0,1].includes(signed(unit,38))||q.originalX10!==x||q.originalY10!==y||x!==tx*10||y!==ty*10||base.x!==tx||base.y!==ty)return none;
      return {kind:'arrival',partyId,destinationId,safe:true,source:{segment:0xc30,returnOffset:ip},reason:null};
    }
    return none;
  }
  function traceRoute(s,D,E,request={}){
    const fail=(reason,extra={})=>({ok:false,reason,...extra}),partyId=request.partyId,to=request.to,mode=request.mode??0,cap=request.maxTicks??5000;
    if(!Transport||!E||!Number.isInteger(partyId)||partyId<0||partyId>5||!Number.isInteger(to)||![0,1].includes(mode)||!Number.isInteger(cap)||cap<1||cap>20000)return fail('invalid-route-request');
    const q=s.squads?.[partyId],bases=s.world?.bases||D?.original?.transport?.bases,target=bases?.find(b=>b.id===to);if(!q||!target||![0,1,4].includes(target.kind)||q.active!==1||!s.clock)return fail('unavailable-route');
    const grid=E.movementGrid(s,D),unit=E.transportUnit(q,D),cells=new Set(),directions=new Map();let country=countryAt(s,target.x,target.y);
    const record=u=>{const x=Math.trunc(u.x10/10),y=Math.trunc(u.y10/10);cells.add(y*128+x);};record(unit);
    if(Math.trunc(unit.x10/10)===target.x&&Math.trunc(unit.y10/10)===target.y)return {ok:true,cells:[...cells],ticks:0,newDays:0,movementCalls:0,arrival:{...unit},conditional:true};
    const command=Transport.fieldMoveCommand(unit,grid,bases,target.x,target.y,mode,{displayCountry:country,targetCountry:country});if(!command.ok)return fail(command.reason);
    let u=command.unit,clock={subtick:s.clock.subtick,hour:s.clock.hour},newDays=0,movementCalls=1;record(u);
    // Cache the original cell's chosen direction/terrain coefficient, never a
    // Dijkstra preview. Original pathStep depends on floor(x10/10,y10/10).
    function move(current){const x=Math.trunc(current.x10/10),y=Math.trunc(current.y10/10),key=y*128+x;let d=directions.get(key);
      if(!d){const p=Transport.pathStep(grid,current.x10,current.y10,target.x,target.y,mode);d={direction:p.direction,dx:p.x10-current.x10,dy:p.y10-current.y10,moved:p.moved};directions.set(key,d);}
      const nx=x+(d.direction===1?1:d.direction===3?-1:0),ny=y+(d.direction===2?1:d.direction===0?-1:0);if(d.moved&&nx>=0&&nx<128&&ny>=0&&ny<96)cells.add(ny*128+nx);
      return {unit:{...current,x10:current.x10+d.dx,y10:current.y10+d.dy},moved:d.moved};}
    for(let ticks=1;ticks<=cap;ticks++){
      clock=Transport.clockStep(clock);if(clock.newDay)newDays++;
      if(clock.movement){movementCalls++;const failure=Transport.vehicleFailureRetreat(u,bases);if(failure.event)return fail('vehicle-failure', {cells:[...cells],ticks,newDays});
        const arrived=Transport.arrivalStep(u,bases);u=arrived.unit;record(u);if(arrived.events.some(e=>e.type==='base-arrival'&&e.baseId===to))return {ok:true,cells:[...cells],ticks,newDays,movementCalls,arrival:u,clock,conditional:true};
        if(arrived.events.length)return fail('unexpected-arrival',{cells:[...cells],ticks,newDays});const p=move(u);if(!p.moved)return fail('native-path-stalled',{cells:[...cells],ticks,newDays});u=p.unit;record(u);
      }
    }
    return fail('route-simulation-limit',{cells:[...cells],ticks:cap,newDays});
  }
  return Object.freeze({mainSha256:MAIN,countryAt,inspectEvent,traceRoute});
});
