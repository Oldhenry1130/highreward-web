/* Local, atomic supply transactions through the original town and C18 shop. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./original-story.js'));
  else root.HRAutoSupplyService=factory(root.HR_ORIGINAL_STORY);
})(typeof globalThis==='object'?globalThis:this,function(Story){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const MAIN='08ed144e8f8d6e97d19f0759bce2420665998143f2f0f056ab7adc718e550e3e';
  const MENU={segment:0x1344,offset:0xef},GRID={segment:0x18eb,offset:0x105};
  const allowedItem=id=>Number.isInteger(id)&&id>=40&&id<=43;
  const atSource=(e,p)=>e?.source?.segment===p.segment&&e.source.offset===p.offset;
  const count=(q,id)=>(q.pack||[]).find(x=>x.itemId===id)?.count||0;
  function fail(reason,message,requiresPlayer=false){return {ok:false,cost:0,quantity:0,reason,message,requiresPlayer};}
  function stop(reason,message,requiresPlayer=false){throw Object.assign(new Error(message),{supplyReason:reason,requiresPlayer});}
  function isMenu(e){return e?.type==='choice'&&e.name==='menu.choose'&&atSource(e,MENU)&&Array.isArray(e.options)&&e.options.every(o=>Number.isInteger(o.id)&&o.id>=0&&o.id<8);}
  function isGrid(e,partyId,shopSlot){return e?.type==='choice'&&e.name==='shop.grid'&&atSource(e,GRID)&&e.partyId===partyId&&e.shopIndex===shopSlot&&e.shopState?.source?.bankToken===0xc18&&e.shopState.mode===0&&e.shopState.selectedCategory===2;}
  function prepare(s,D,E,partyId){
    if(!Number.isInteger(partyId)||partyId<0||partyId>5||!s?.squads?.[partyId])stop('party-invalid','部隊不存在。');
    if(s.mode!=='native-original'||Story?.mainSha256!==MAIN||D.original?.mainSha256!==MAIN||!s.story?.snapshot)stop('source-unavailable','原作商店資料尚未就緒。',true);
    if(s.ended)stop('campaign-ended','戰役已結束。');
    if(s.activeBattle?.phase==='active'||s.pendingNativeCommand)stop('player-event','請先完成目前戰鬥或指令。',true);
    if(s.story.pendingOpeningEvents||s.story.event&&!['complete','tick-complete'].includes(s.story.event.type))stop('player-event','請先完成目前原作事件。',true);
    const q=s.squads[partyId],baseId=q.currentBase;
    if(q.active!==1||q.originalOrder!==2||q.position||q.at!==baseId||!D.bases[baseId]||!E.atBase(q))stop('not-docked','部隊必須實際駐留城鎮才能補給。');
    const kind=s.world?.bases?.find(b=>b.id===baseId)?.kind;
    if(![0,1].includes(kind))stop('town-unavailable','目前據點不是可採購的和平城鎮。');
    const trial=clone(s),town=E.townActions(trial,D,partyId);
    if(town.slotId!==baseId)stop('location-mismatch','原作所在地與駐留城鎮不一致。',true);
    const action=town.actions.find(a=>a.id===64);
    if(!action?.activateTask||action.activateTask.partyId!==partyId||action.activateTask.slotId!==baseId)stop('shop-closed','目前城鎮未開放商店。');
    E.storyEvent(trial,D,action.activateTask);
    if(!isMenu(trial.story.event))stop('unexpected-event','商店入口出現其他事件，請由玩家處理。',true);
    // Town action 64 loads exactly eight local records at 3930:050C.
    // Never use the extracted global catalogue, shop names, or a remote city.
    const vm=Story.StoryVM.restore(trial.story.snapshot);
    const candidates=[];
    for(const option of trial.story.event.options){
      const record=vm.read(0x4930,0x50c+25*option.id,25),kind=record[23],variant=record[24];
      if(kind!==0||variant>63)continue;
      const raw=vm.read(0x4930,0xc+variant*20,20),items=[];
      for(let i=0;i<4;i++){const p=i*5,id=raw[p+1]|raw[p+2]<<8;if(raw[p]===2&&id<=3)items.push(40+id);}
      if(items.length)candidates.push({slot:option.id,name:option.text.trim(),variant,items});
    }
    return {trial,baseId,candidates};
  }
  function open(prepared,D,E,partyId,itemId){
    const shop=prepared.candidates.find(c=>itemId===undefined||c.items.includes(itemId));
    if(!shop)stop('no-medicine-shop','本城目前沒有開放且販售指定回復膠囊的藥店。');
    E.storyResume(prepared.trial,D,{value:shop.slot});
    if(!isGrid(prepared.trial.story.event,partyId,shop.slot))stop('unexpected-event','藥店出現其他事件，請由玩家處理。',true);
    const offers=prepared.trial.story.event.options.filter(o=>allowedItem(o.itemId)&&Number.isInteger(o.offerIndex)&&o.category===2&&Number.isSafeInteger(o.price)&&o.price>0).map(o=>({offerId:o.id,itemId:o.itemId,unitPrice:o.price,name:o.text}));
    return {...prepared,shop,offers};
  }
  function exception(error){return fail(error.supplyReason||'transaction-failed',error.message||'原作補給交易未完成。',error.requiresPlayer??true);}
  function inspect(s,D,E,partyId){
    try{
      const p=open(prepare(s,D,E,partyId),D,E,partyId);
      return {ok:true,baseId:p.baseId,shopSlot:p.shop.slot,shopName:p.shop.name,offers:p.offers,cost:0,quantity:0,reason:null};
    }catch(error){return exception(error);}
  }
  function buy(s,D,E,request={}){
    try{
      const {partyId,itemId,quantity,maxSpend}=request;
      if(!allowedItem(itemId))stop('item-invalid','自動補給僅購買回復膠囊１～４。');
      if(!Number.isInteger(quantity)||quantity<1||quantity>99)stop('quantity-invalid','單次購買數量須為１～９９。');
      if(!Number.isSafeInteger(maxSpend)||maxSpend<0)stop('budget-invalid','補給預算無效。');
      const p=open(prepare(s,D,E,partyId),D,E,partyId,itemId),offer=p.offers.find(o=>o.itemId===itemId);
      if(!offer)stop('item-unavailable','目前藥店沒有販售指定藥品。');
      const cost=offer.unitPrice*quantity;
      if(!Number.isSafeInteger(cost)||cost>maxSpend)stop('budget-insufficient','補給費用超過本次可用預算。');
      if(cost>p.trial.money)stop('cash-insufficient','資金不足。');
      const previous=count(p.trial.squads[partyId],itemId),cash=p.trial.money;
      E.manageStock(p.trial,D,{type:'purchaseStock',squad:partyId,offer:offer.offerId,quantity});
      if(p.trial.money!==cash-cost||count(p.trial.squads[partyId],itemId)!==previous+quantity)stop('purchase-mismatch','原作交易結果不一致，未提交補給。',true);
      // Only the known browse grid -> original shop list -> complete may close.
      E.storyResume(p.trial,D,{value:-1});
      if(!isMenu(p.trial.story.event))stop('unexpected-exit','離店時出現其他事件，請由玩家處理。',true);
      E.storyResume(p.trial,D,{value:-1});
      if(p.trial.story.event?.type!=='complete'||p.trial.money!==cash-cost||count(p.trial.squads[partyId],itemId)!==previous+quantity)stop('unexpected-exit','離店交易尚未安全完成。',true);
      const result={ok:true,partyId,baseId:p.baseId,shopSlot:p.shop.slot,itemId,unitPrice:offer.unitPrice,cost,quantity,reason:null};
      Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,p.trial);
      return result;
    }catch(error){return exception(error);}
  }
  return Object.freeze({inspect,buy,allowedItems:Object.freeze([40,41,42,43])});
});
