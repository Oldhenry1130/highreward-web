/* Browser inventory extension: original item ids, eligibility and shop offers. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HRArmory=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MAX_STACK=9999,CASH_LIMIT=99999999;
  const slotOf=id=>!Number.isInteger(id)?null:id>=0&&id<23?'weapon':id<40&&id>=23?'armor':id>=40&&id<62?'consumable':null;
  function count(q,id){return (q.pack||[]).find(x=>x.itemId===id)?.count||0;}
  function change(q,id,amount){const current=count(q,id),next=current+amount;if(next<0||next>MAX_STACK)throw Error(next<0?'倉庫物品數量不足':'此物品的倉庫數量已達上限');q.pack??=[];const index=q.pack.findIndex(x=>x.itemId===id);if(next===0){if(index>=0)q.pack.splice(index,1);}else if(index<0)q.pack.push({itemId:id,count:next});else q.pack[index].count=next;q.pack.sort((a,b)=>a.itemId-b.itemId);}
  function validate(q,data){
    if(q.pack===undefined)return;
    if(!Array.isArray(q.pack)||q.pack.length>62)throw Error('部隊倉庫資料無效');const seen=new Set();
    for(const r of q.pack){if(!r||!Number.isInteger(r.itemId)||!slotOf(r.itemId)||!data.items.some(i=>i.index===r.itemId)||seen.has(r.itemId)||!Number.isInteger(r.count)||r.count<1||r.count>MAX_STACK)throw Error('部隊倉庫物品無效');seen.add(r.itemId);}
  }
  function ready(s,q,allowShop=false){
    if(s.ended)throw Error('戰役已結束');if(s.activeBattle?.phase==='active')throw Error('戰鬥中不能調整裝備');
    if(q.active===0||q.originalOrder!==2||q.position)throw Error('請先讓部隊駐留據點再整備');
    const e=s.story?.event;if(e&&!['complete','tick-complete'].includes(e.type)&&!(allowShop&&e.name==='shop.grid'&&e.shopState?.mode===0))throw Error('請先完成目前對話或交易');
  }
  function compatible(data,id,m){const item=data.items.find(x=>x.index===id);return !!item&&data.original.transport.equipmentCompatibility[item.categoryCandidate]?.[m.classId??m.face]===1;}
  function member(q,slot){const m=q.members.find((m,i)=>(m.originalSlot??i)===slot);if(!m)throw Error('請將裝備放到有成員的位置');return m;}
  function ledger(s,party,amount){s.ledger??=Array(96).fill(0);const index=party*16+4;s.ledger[index]=((s.ledger[index]|0)+amount)>>>0;}
  function purchase(s,data,party,offerId,quantity=1){
    const q=s.squads[party];if(!q)throw Error('部隊不存在');ready(s,q,true);
    const e=s.story?.event,o=e?.options?.find(o=>o.id===offerId&&o.offerIndex!==undefined);
    if(e?.name!=='shop.grid'||e.shopState?.mode!==0||!o||!slotOf(o.itemId)||!Number.isSafeInteger(o.price)||o.price<=0)throw Error('請從目前商店選擇可購買的裝備');
    if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw Error('購買數量須為 1–99');
    const cost=o.price*quantity;if(s.money<cost)throw Error('資金不足');if(count(q,o.itemId)+quantity>MAX_STACK)throw Error('倉庫數量已達上限');
    change(q,o.itemId,quantity);s.money-=cost;ledger(s,party,-cost);return {itemId:o.itemId,quantity,cost};
  }
  function equip(s,data,fromParty,toParty,slot,id){
    const a=s.squads[fromParty],b=s.squads[toParty];if(!a||!b)throw Error('部隊不存在');ready(s,a,true);ready(s,b,true);
    if((a.currentBase??a.at)!==(b.currentBase??b.at))throw Error('兩支部隊必須駐留在同一據點');
    const m=member(b,slot),key=slotOf(id);if(!key||!compatible(data,id,m))throw Error('這名成員無法使用此裝備');if(count(a,id)<1)throw Error('倉庫中沒有此物品');
    const old=m[key],same=old===id;
    if(key==='consumable'&&same&&m.consumableCount>=255)throw Error('成員持物數量已達 255');
    if(old!==null&&old!==undefined&&!same&&count(b,old)+(key==='consumable'?m.consumableCount||1:1)>MAX_STACK)throw Error('舊裝備無法放回倉庫，數量已滿');
    if(same&&key!=='consumable')throw Error('已裝備相同物品');
    change(a,id,-1);if(old!==null&&old!==undefined&&!same)change(b,old,key==='consumable'?m.consumableCount||1:1);
    m[key]=id;if(key==='consumable')m.consumableCount=same?(m.consumableCount||0)+1:1;
    return {itemId:id,previous:old,key};
  }
  function unequip(s,data,party,slot,key){
    const q=s.squads[party];if(!q)throw Error('部隊不存在');ready(s,q,true);const m=member(q,slot);if(!['weapon','armor','consumable'].includes(key)||m[key]==null)throw Error('這個欄位沒有裝備');
    const id=m[key],amount=key==='consumable'?m.consumableCount||1:1;change(q,id,amount);m[key]=null;if(key==='consumable')m.consumableCount=0;return{id,amount};
  }
  function moveStock(s,data,fromParty,toParty,id){
    const a=s.squads[fromParty],b=s.squads[toParty];if(!a||!b)throw Error('部隊不存在');ready(s,a,true);ready(s,b,true);if(fromParty===toParty)return;
    if((a.currentBase??a.at)!==(b.currentBase??b.at))throw Error('兩支部隊必須駐留在同一據點');if(count(a,id)<1||!slotOf(id))throw Error('倉庫中沒有此物品');if(count(b,id)>=MAX_STACK)throw Error('接收倉庫數量已滿');change(a,id,-1);change(b,id,1);
  }
  function sell(s,data,party,id,quantity=1){
    const q=s.squads[party];if(!q)throw Error('部隊不存在');ready(s,q,true);const e=s.story?.event;
    if(e?.name!=='shop.grid'||e.shopState?.mode!==0)throw Error('請在商店出售倉庫物品');
    const item=data.items.find(i=>i.index===id),category=slotOf(id)==='weapon'?0:slotOf(id)==='armor'?1:2;
    if(!slotOf(id)||e.shopState.selectedCategory!==category)throw Error('請切換至此物品對應的商店分類再出售');
    const price=Math.trunc((item?.priceCandidate||0)/2);if(price<=0)throw Error('此物品無法出售');if(!Number.isInteger(quantity)||quantity<1||quantity>count(q,id))throw Error('出售數量無效');
    const income=price*quantity;if(s.money+income>CASH_LIMIT)throw Error('持有金額已達上限，請先使用資金');change(q,id,-quantity);s.money+=income;ledger(s,party,income);return {income,quantity};
  }
  function cheat(s){if(s.ended)throw Error('戰役已結束');if(s.money+50000>CASH_LIMIT)throw Error('持有金額接近原作上限，無法再增加 50,000 G');s.money+=50000;s.cheatsUsed=(s.cheatsUsed||0)+1;return 50000;}
  return Object.freeze({MAX_STACK,CASH_LIMIT,slotOf,count,validate,ready,compatible,purchase,equip,unequip,moveStock,sell,cheat});
});
