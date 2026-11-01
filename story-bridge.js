/* Synchronize original event execution with the native campaign and game UI. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./original-story.js'),require('./original-transport.js'),require('./battle-bridge.js'),require('./original-campaign.js'),require('./economy.js'),require('./world-intel.js'));
  else root.OriginalStoryBridge=factory(root.HR_ORIGINAL_STORY,root.OriginalTransport,root.OriginalBattleBridge,root.OriginalCampaign,root.HREconomy,root.HRWorldIntel);
})(typeof globalThis==='undefined'?this:globalThis,function(Story,Transport,Battle,Campaign,Economy,Intel){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const text=bytes=>new TextDecoder('big5').decode(Uint8Array.from(bytes).subarray(0,bytes.indexOf(0)<0?bytes.length:bytes.indexOf(0))).trim();
  function unitBytes(q,data){
    const bytes=Battle.encodeUnit(q),v=new DataView(bytes.buffer),put=(o,n)=>v.setInt16(o,n??-1,true),destination=q.destinationBase??q.route[0]??-1;
    const at=data.bases[q.at],p=q.position||{x:(q.originalX10??at.xCandidate*10)/10,y:(q.originalY10??at.yCandidate*10)/10};
    put(49,q.currentBase??q.at);put(51,Math.round(p.x*10));put(53,Math.round(p.y*10));put(67,q.retreatBase??q.at);put(69,q.raw45);put(71,destination);
    put(73,q.targetX??data.bases[destination]?.xCandidate??Math.trunc(p.x));put(75,q.targetY??data.bases[destination]?.yCandidate??Math.trunc(p.y));put(44,q.subtype??0);
    return Array.from(bytes);
  }
  function fromVM(s,data,native){
    s.money=native.cash>>>0;s.debt=native.debt>>>0;s.calendar=clone(native.date);s.seed=native.randomSeed>>>0;
    s.minimumRepayment=native.minimumRepayment;s.bankCollectorStrength=native.bankCollectorStrength;s.ledger=native.ledger.flat().map(n=>n>>>0);
    const bytes=native.campaignBytes;s.originalCampaign=bytes;s.storyFlags=native.flags;s.storyCounters=native.counters;s.storyByte20=bytes[0x20];
    const clockView=new DataView(Uint8Array.from(bytes).buffer);s.clock={subtick:clockView.getInt16(0x23,true),hour:clockView.getInt16(0x21,true)};s.hour=s.clock.hour;s.selectedSquad=clockView.getInt16(0xB,true);s.viewCountry=clockView.getInt16(0xD,true);
    s.day=Math.max(1,((s.calendar.year-632)*12+s.calendar.month-4)*28+s.calendar.day-16+1);
    const v=new DataView(Uint8Array.from(bytes).buffer),bases=data.original.transport.bases.map(base=>{
      const o=0x1AB+base.id*101;return {...base,kind:bytes[o+23],footprintType:bytes[o+24],raw1A:v.getInt16(o+26,true),raw1C:v.getInt16(o+28,true),state5D:bytes[o+93]};
    });
    if(JSON.stringify(s.world?.bases)!==JSON.stringify(bases))s.world={bases,revision:(s.world?.revision||0)+1};
    native.parties.forEach((raw,i)=>{
      const q=s.squads[i],u=Transport.decodeUnit(raw),oldX=q.originalX10,oldY=q.originalY10;Battle.applyUnit(q,raw);
      for(const m of q.members){const offset=0x34D3+12*(i*11+m.originalSlot),name=text(bytes.slice(offset,offset+12));if(name&&name.replaceAll('•','‧')!==m.name.replaceAll('•','‧'))m.name=name;}
      q.originalX10=u.x10;q.originalY10=u.y10;q.originalOrder=u.order;q.moveMode=u.moveMode;q.subtype=u.subtype;q.active=u.active;
      q.currentBase=u.targetBase;q.retreatBase=u.retreatBase;q.raw45=u.raw45;q.destinationBase=u.destinationBase;q.targetX=u.targetX;q.targetY=u.targetY;
      q.formation=raw[65];for(const key of ['tankId','planeId','cannonId','tankDurability','planeDurability'])q[key]=u[key];
      if(u.targetBase>=0&&data.bases[u.targetBase])q.at=u.targetBase;
      if(u.order===2){q.position=null;q.order='idle';q.route=[];q.fieldDestination=null;q.travel=null;q.progress=0;if(data.bases[u.targetBase])q.lastSafeBase=u.targetBase;}
      else if([0,1,6,9].includes(u.order)){
        const dest=data.bases.find(b=>b.xCandidate===u.targetX&&b.yCandidate===u.targetY);
        q.position={x:u.x10/10,y:u.y10/10};
        if(dest){q.order='move';q.route=[dest.index];q.travel=q.travel?.original&&q.travel.to===dest.index?q.travel:{original:true,mode:u.moveMode,to:dest.index,steps:0};if(oldX!==u.x10||oldY!==u.y10)q.travel.steps++;}
        else{q.order='move';q.route=[];q.fieldDestination={x:u.targetX,y:u.targetY};q.travel=q.travel?.original&&q.travel.to===null?q.travel:{original:true,mode:u.moveMode,to:null,steps:0};if(oldX!==u.x10||oldY!==u.y10)q.travel.steps++;}q.progress=0;
      }else{q.position={x:u.x10/10,y:u.y10/10};q.order=u.order===3?'rest':'idle';q.route=[];q.travel=null;q.progress=0;}
      q.stamina=q.members.length?Math.max(0,Math.min(100,100-Math.trunc(q.members.reduce((sum,m)=>sum+m.fatigue,0)/q.members.length))):0;
    });
  }
  function toVM(s,data,vm){
    if(s.originalCampaign&&s.clock){const v=new DataView(Uint8Array.from(s.originalCampaign).buffer);v.setInt16(0x21,s.clock.hour,true);v.setInt16(0x23,s.clock.subtick,true);v.setInt16(0xB,s.selectedSquad??0,true);v.setInt16(0xD,s.viewCountry??4,true);s.originalCampaign=Array.from(new Uint8Array(v.buffer));}
    return vm.applyNativeState({campaignBytes:s.originalCampaign,cash:s.money,debt:s.debt,date:s.calendar,randomSeed:s.seed,
      parties:s.squads.map(q=>unitBytes(q,data)),flags:s.storyFlags,counters:s.storyCounters,ledger:Array.from({length:6},(_,i)=>(s.ledger||Array(96).fill(0)).slice(i*16,i*16+16)),
      minimumRepayment:s.minimumRepayment,bankCollectorStrength:s.bankCollectorStrength});
  }
  function initial(s,data,seed){
    Economy.configure(s);
    const baseline=Story.newGameBaseline();fromVM(s,data,baseline.state);
    if(seed!==undefined)s.seed=seed&65535;
    s.story={snapshot:baseline.snapshot,event:null,history:[],speaker:'',pendingOpeningEvents:true};
    return s;
  }
  function commit(s,data,vm,event){
    const before={money:s.money,ledger:s.ledger?.slice()};
    const native=vm.nativeState();Intel.capture(s,data,event,native,!!vm.worldBreak||!!event.worldFrames);fromVM(s,data,native);s.story??={history:[]};s.story.snapshot=vm.snapshot();s.story.event=event;s.story.eventSerial=(s.story.eventSerial||0)+1;
    const receipt=Economy.incomeReceipt(before,s,s.story.eventSerial);
    if(receipt){s.story.incomeReceipt=receipt;s.log??=[];s.log.unshift({day:s.day,text:Economy.receiptText(receipt)});s.log=s.log.slice(0,80);}
    if(event.type==='complete'&&event.ending?.id==='debtCleared')s.ended='won';
    if(event.type==='complete'&&event.worldFrames)s.story.pendingOpeningEvents=false;
    return event;
  }
  function automatic(s,data,vm,event){
    for(let count=0;count<10000;count++){
      if(event.type==='speaker'){s.story.speaker=event.text;s.story.speakerFace=event.args[2];s.story.speakerLayout=event.args[3];event=vm.resume();}
      else if(event.type==='effect'){if(event.name==='dialogue.end'){s.story.rewardContext=false;if(event.args[0]===s.story.speakerLayout){s.story.speaker='';s.story.speakerFace=null;}}event=vm.resume();}
      else if(event.type==='random'){const low=event.range.min,high=event.range.maxExclusive;const value=low+Math.floor(Campaign.random32768(s)*(high-low)/32768);vm.applyNativeState({randomSeed:s.seed});event=vm.resume({value});}
      else if(event.type==='budget'){event=vm.run();}
      else{if(event.type==='text'){s.story.rewardContext=!!s.story.rewardContext||Economy.isRewardText(event.text);s.story.history.push({speaker:s.story.speaker||'',text:event.text});s.story.history=s.story.history.slice(-80);}else s.story.rewardContext=false;return commit(s,data,vm,event);}
    }
    throw Error('原作事件自動處理超出上限');
  }
  function dispatch(s,data,request){
    if(s.story?.event&&!['complete','tick-complete'].includes(s.story.event.type))throw Error('請先完成目前的原作事件');
    const vm=s.story?.snapshot?Story.StoryVM.restore(s.story.snapshot,{incomeMultiplier:Economy.MULTIPLIER}):new Story.StoryVM({incomeMultiplier:Economy.MULTIPLIER});s.story??={history:[],speaker:''};s.story.rewardContext=false;toVM(s,data,vm);
    return automatic(s,data,vm,request.kind==='townAction'?vm.activateTask(request):vm.dispatch(request));
  }
  function resume(s,data,response={}){
    if(!s.story?.snapshot)throw Error('沒有進行中的原作事件');
    const previous=s.story.event,vm=Story.StoryVM.restore(s.story.snapshot,{incomeMultiplier:Economy.MULTIPLIER});s.story.rewardContext=Economy.dialogueContext(s.story);toVM(s,data,vm);const event=automatic(s,data,vm,vm.resume(response));if(previous?.type==='quit'&&event.type==='complete')s.ended='quit';return event;
  }
  function townActions(s,data,partyId){const vm=s.story?.snapshot?Story.StoryVM.restore(s.story.snapshot):new Story.StoryVM();toVM(s,data,vm);return Story.townActions(vm,partyId);}
  function countryAt(s,x,y){
    const vm=Story.StoryVM.restore(s.story.snapshot);vm.pending=null;vm.done=true;let result=vm.start({segment:0xF33,offset:0x2E9},[x,y]);while(result.type==='budget')result=vm.run();
    if(result.type!=='complete')throw Error('原作國家查詢未完成');const country=result.registers.ax;return country===65535?-1:country;
  }
  function tick(s,data){
    if(s.story?.event&&s.story.event.type!=='complete'&&s.story.event.type!=='tick-complete')return s.story.event;
    const vm=s.story?.snapshot?Story.StoryVM.restore(s.story.snapshot,{incomeMultiplier:Economy.MULTIPLIER}):new Story.StoryVM({incomeMultiplier:Economy.MULTIPLIER});toVM(s,data,vm);s.story??={history:[],speaker:''};s.story.rewardContext=false;
    return automatic(s,data,vm,vm.startWorldTick());
  }
  function validate(s,data){
    for(const[key,count]of [['originalCampaign',0x7C68],['storyFlags',256],['storyCounters',256]])if(!Array.isArray(s[key])||s[key].length!==count||s[key].some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('原作戰役資料無效');
    const snap=s.story?.snapshot;if(!snap||snap.version!==1||snap.mainSha256!==Story.mainSha256||!Array.isArray(snap.patches)||snap.patches.length>100000)throw Error('原作事件存檔無效');
    for(const patch of snap.patches){if(!Array.isArray(patch)||patch.length!==2||!Number.isInteger(patch[0])||patch[0]<0||!Array.isArray(patch[1])||patch[0]+patch[1].length>0x100000||patch[1].some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('原作事件記憶體差異無效');}
    if(!Array.isArray(s.story.history)||s.story.history.length>80||s.story.history.some(h=>typeof h.text!=='string'||h.text.length>10000))throw Error('原作對話紀錄無效');
    if(s.story.eventSerial!==undefined&&(!Number.isSafeInteger(s.story.eventSerial)||s.story.eventSerial<0||s.story.eventSerial>1e12))throw Error('原作事件序號無效');
    if(!s.calendar||!Number.isInteger(s.calendar.year)||s.calendar.year<0||!Number.isInteger(s.calendar.month)||s.calendar.month<1||s.calendar.month>12||!Number.isInteger(s.calendar.day)||s.calendar.day<1||s.calendar.day>28)throw Error('原作日期無效');
    Story.StoryVM.restore(snap);return true;
  }
  function synchronize(s,data){const source=Story.StoryVM.restore(s.story.snapshot);toVM(s,data,source);fromVM(s,data,source.nativeState());s.story.snapshot=source.snapshot();}
  return Object.freeze({initial,fromVM,toVM,unitBytes,dispatch,resume,townActions,countryAt,tick,validate,synchronize,source:Story.mainSha256});
});
