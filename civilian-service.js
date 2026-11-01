/* Source-bound, current-board-only civilian service. Evidence: research/hr-auto-0.9.0/offers. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./original-story.js'));
  else root.HRCivilianService=factory(root.HR_ORIGINAL_STORY);
})(typeof globalThis==='object'?globalThis:this,function(Story){
  'use strict';
  const MAIN='08ed144e8f8d6e97d19f0759bce2420665998143f2f0f056ab7adc718e550e3e';
  const CODE=0x6ba9,DATA=0x5937,TABLE=0x18b,RECORD=84,CONTRACT=0x6445;
  const names=['酒壺的運送','信的運送','書的運送','書籍的運送','機器的運送','槍的護送','手槍的運送'];
  // Return IPs following the original B88 far calls, in their exact accepting order.
  // A shared generic dialogue host address alone never authorizes continuation.
  const paths=[
    [0x180,0x19a,0x1b3,-0x1c3,0x542],
    [0x1ed,0x213,0x232,-0x242,0x542],
    [0x26c,0x292,0x2b1,0x2ca,-0x2da,0x2fa,0x542],
    [0x31d,-0x32d,0x34e,0x367,0x38c,0x3a6,0x3c5,-0x3d5,0x542],
    [0x418,0x43d,0x456,0x476,-0x486,0x542],
    [0x4b0,0x4d5,0x4f5,0x50e,-0x51e,0x542]
  ];
  const clone=v=>JSON.parse(JSON.stringify(v)),w=(b,o=0)=>b[o]|b[o+1]<<8,sw=(b,o=0)=>(w(b,o)<<16)>>16;
  const long=(b,o)=>w(b,o)+w(b,o+2)*65536;
  const hex=b=>b.map(n=>n.toString(16).padStart(2,'0')).join('');
  function text(b,o,n){let end=o;while(end<o+n&&b[end]!==0)end++;return new TextDecoder('big5').decode(Uint8Array.from(b.slice(o,end))).trim();}
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function restore(s){
    const snap=s?.story?.snapshot,e=s?.story?.event,p=snap?.pending;
    if(!Story||snap?.mainSha256!==MAIN||Story.mainSha256!==MAIN||!e||!p)return null;
    if(e.type!==p.type||e.name!==p.name||!equal(e.source,p.source)||!equal(e.args,p.args)||!equal(e.options,p.options))return null;
    try{return Story.StoryVM.restore(snap);}catch{return null;}
  }
  function caller(v){const b=v.read(v.r.ss,v.r.sp,4);return{ip:w(b),cs:w(b,2)};}
  function readBoard(s,D){
    const v=restore(s),e=v?.pending;if(!v||e.type!=='choice'||e.name!=='menu.window'||e.source?.segment!==0x15dc||e.source?.offset!==0xee6)return null;
    const r=v.r,c=caller(v);
    if(c.ip!==0x1201||c.cs!==CODE||r.ds!==DATA||e.windowPointer?.segment!==r.ss||e.windowPointer?.offset!==((r.bp-0x2c)&65535))return null;
    const baseId=sw(v.read(r.ss,r.bp+6,2)),partyId=sw(v.read(r.ss,r.bp+8,2)),baseCount=w(v.read(0x4073,0x28ba,2));
    if(partyId<0||partyId>5||baseId<0||baseId>=baseCount||!Array.isArray(e.options)||e.options.length>6)return null;
    const u=v.read(0x4073,0x2bdf+partyId*382,382);
    if(sw(u,49)!==baseId||sw(u,38)!==2||sw(u,42)!==1||sw(u,44)!==0||sw(v.read(0x4073,CONTRACT+partyId*RECORD+25,2))>0)return null;
    const q=s.squads?.[partyId];if(q&&(q.currentBase!==baseId||q.originalOrder!==2||q.subtype!==0||!q.active))return null;
    const rows=[],specialRows=[],seen=new Set(),records=new Set();
    for(const option of e.options){
      const offerId=option.id;
      if(!Number.isInteger(offerId)||offerId!==seen.size||offerId>=6||seen.has(offerId))return null;
      seen.add(offerId);const recordIndex=v.read(r.ss,(r.bp-0x10+offerId)&65535,1)[0];
      if(recordIndex>=5){specialRows.push({offerId,recordIndex});continue;}
      if(records.has(recordIndex))return null;records.add(recordIndex);
      const b=v.read(DATA,TABLE+recordIndex*RECORD,RECORD),originId=sw(b),destinationId=sw(b,2),days=sw(b,25),cargoSelector=w(b,73),style=w(b,81),reward=long(b,75);
      if(originId!==baseId||destinationId<0||destinationId>=baseCount||days<=0||days!==w(b,27)||cargoSelector>=names.length||style>=paths.length||reward>0x7fffffff)return null;
      rows.push({offerId,recordIndex,partyId,baseId,kind:'civilian',type:'delivery',originId,destinationId,
        originName:D?.bases?.[originId]?.name??text(v.read(0x4073,0x1ab+originId*101,21),0,21),destinationName:text(b,4,21),
        days,remainingDays:days,originalDays:w(b,27),employerPortrait:sw(b,29),employer:text(b,31,21),cargoDescription:text(b,52,21),
        cargoSelector,name:names[cargoSelector],reward,bonus:b[83]!==0,earlyBonusPossible:style===0||b[83]!==0,
        bonusMultiplier:b[83]!==0?2:1,style,dialogueType:style,rawPathValue:w(b,79),rawRecord:b,fingerprint:hex(b),autoAcceptable:true});
    }
    return{partyId,baseId,boardBP:r.bp,stackSegment:r.ss,offers:rows,specialRows,source:{segment:0xb88,offset:0xf78},mainSha256:MAIN};
  }
  function canReadCurrentBoard(s){return readBoard(s,null)!==null;}
  function emptyBoard(s){
    const v=restore(s),e=v?.pending;if(!v||e.type!=='text'||e.name!=='input.acknowledgeText'||e.source?.segment!==0xf33||e.source?.offset!==0xc51)return null;
    const c=caller(v);if(c.cs!==CODE||c.ip!==0x11a2||v.r.ds!==DATA||v.r.si!==0||e.panels?.length!==1||e.panels[0].sourcePointer?.segment!==DATA||e.panels[0].sourcePointer.offset!==0x6fd)return null;
    const baseId=sw(v.read(v.r.ss,v.r.bp+6,2)),partyId=sw(v.read(v.r.ss,v.r.bp+8,2));if(partyId<0||partyId>5||baseId<0||baseId>=w(v.read(0x4073,0x28ba,2)))return null;
    const u=v.read(0x4073,0x2bdf+partyId*382,382),q=s.squads?.[partyId];
    if(!q||q.currentBase!==baseId||q.originalOrder!==2||q.subtype!==0||q.active!==1||sw(u,49)!==baseId||sw(u,38)!==2||sw(u,42)!==1||sw(u,44)!==0||sw(v.read(0x4073,CONTRACT+partyId*RECORD+25,2))>0)return null;
    return {partyId,baseId};
  }
  function tryEmpty(s,D,E,request={}){
    const board=emptyBoard(s);if(!board||request.partyId!==board.partyId||request.baseId!==board.baseId||!unblocked(s)||typeof E?.storyResume!=='function')return {ok:false,reason:'not-current-empty-board'};
    const draft=clone(s);try{E.storyResume(draft,D,{});if(draft.story?.event?.type!=='complete'||draft.story?.snapshot?.pending||draft.activeBattle||draft.money!==s.money||draft.seed!==s.seed||!equal(draft.ledger,s.ledger)||!equal(draft.originalCampaign,s.originalCampaign)||!equal(draft.storyFlags,s.storyFlags)||!equal(draft.storyCounters,s.storyCounters))return {ok:false,reason:'unexpected-empty-board-result'};return {ok:true,state:draft};}catch{return {ok:false,reason:'empty-board-error'};}
  }
  function offers(s,D){return readBoard(s,D)?.offers||[];}
  function traceEntry(v,e){const c=caller(v);return{type:e.type,name:e.name,source:e.source,caller:c};}
  function safeAcceptanceEvent(s,offer,board,expected){
    const v=restore(s);if(!v)return null;const e=v.pending,c=caller(v),isConfirm=expected<0;
    if(c.cs!==CODE||c.ip!==Math.abs(expected)||v.r.ss!==board.stackSegment)return null;
    if(sw(v.read(v.r.ss,v.r.bp+6,2))!==offer.recordIndex||w(v.read(v.r.ss,v.r.bp,2))!==board.boardBP)return null;
    if(sw(v.read(v.r.ss,board.boardBP+6,2))!==board.baseId||sw(v.read(v.r.ss,board.boardBP+8,2))!==board.partyId)return null;
    if(isConfirm){
      if(e.type!=='confirm'||e.name!=='menu.confirm'||e.source?.segment!==0x1344||e.source?.offset!==0x208||!equal(e.options?.map(o=>o.id),[1,0]))return null;
    }else if(e.type!=='text'||e.name!=='dialogue.line'||e.source?.segment!==0x137b||e.source?.offset!==0x1a3)return null;
    return v;
  }
  function unblocked(s){return !s?.ended&&!s?.activeBattle&&!s?.pendingNativeCommand&&!s?.pendingBattle;}
  function tryAccept(s,D,E,request={}){
    const trace=[],board=readBoard(s,D),fail=reason=>({ok:false,reason,trace});
    if(!board||!unblocked(s))return fail('not-current-safe-board');
    if(!Array.isArray(s.originalCampaign)||s.originalCampaign.length!==0x7c68||!Array.isArray(s.ledger))return fail('invalid-native-state');
    if(request.partyId!==board.partyId)return fail('wrong-party');
    const offer=board.offers.find(o=>o.offerId===request.offerId&&o.fingerprint===request.fingerprint);
    if(!offer)return fail('stale-or-special-offer');
    if(!E||typeof E.storyResume!=='function')return fail('missing-engine');
    const draft=clone(s),cash=s.money,ledger=clone(s.ledger),campaign=s.originalCampaign?.slice();
    try{
      E.storyResume(draft,D,{value:offer.offerId});
      for(const expected of paths[offer.style]){
        const v=safeAcceptanceEvent(draft,offer,board,expected);if(!v)return fail('unknown-acceptance-boundary');
        trace.push(traceEntry(v,v.pending));E.storyResume(draft,D,expected<0?{value:1}:{});
      }
      if(draft.story?.event?.type!=='complete'||draft.story?.snapshot?.pending||draft.activeBattle)return fail('acceptance-not-complete');
      const actual=draft.originalCampaign?.slice(CONTRACT+board.partyId*RECORD,CONTRACT+(board.partyId+1)*RECORD),expected=offer.rawRecord.slice();
      if(offer.style===0)expected[83]=1;
      if(!equal(actual,expected)||draft.money!==cash||!equal(draft.ledger,ledger)||draft.seed!==s.seed||!equal(draft.storyFlags,s.storyFlags)||!equal(draft.storyCounters,s.storyCounters))return fail('unexpected-native-result');
      // The source acceptance may update its presentation word at campaign byte 0x11.
      if(campaign)for(let i=0;i<campaign.length;i++)if(i!==0x11&&i!==0x12&&(i<CONTRACT+board.partyId*RECORD||i>=CONTRACT+(board.partyId+1)*RECORD)&&campaign[i]!==draft.originalCampaign[i])return fail('unexpected-campaign-change');
      return{ok:true,state:draft,offer,trace};
    }catch(error){return{...fail('acceptance-error'),detail:String(error?.message||error)};}
  }
  function tryCancel(s,D,E){
    const board=readBoard(s,D),trace=[],fail=reason=>({ok:false,reason,trace});
    if(!board||!unblocked(s)||typeof E?.storyResume!=='function')return fail('not-current-safe-board');
    const draft=clone(s),v=restore(s);trace.push(traceEntry(v,v.pending));
    try{
      E.storyResume(draft,D,{value:-1});
      if(draft.story?.event?.type!=='complete'||draft.story?.snapshot?.pending||draft.activeBattle)return fail('cancel-not-complete');
      if(draft.money!==s.money||draft.seed!==s.seed||!equal(draft.ledger,s.ledger)||!equal(draft.originalCampaign,s.originalCampaign)||!equal(draft.storyFlags,s.storyFlags)||!equal(draft.storyCounters,s.storyCounters))return fail('unexpected-cancel-change');
      return{ok:true,state:draft,trace};
    }catch(error){return{...fail('cancel-error'),detail:String(error?.message||error)};}
  }
  return Object.freeze({mainSha256:MAIN,canReadCurrentBoard,board:readBoard,offers,tryAccept,tryCancel,emptyBoard,tryEmpty});
});
