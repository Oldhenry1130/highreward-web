/* Read-only item and town information, based on shipped records and recovered rules. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(id=>require('./original-combat.js').originalData.items[id],require('./world-intel.js'));else root.HRFieldGuide=factory(id=>root.OriginalCombat?.originalData.items[id],root.HRWorldIntel);})(typeof globalThis==='object'?globalThis:this,function(originalItem,Intel){
  'use strict';
  const categories={0:'補給品',1:'手槍',2:'步槍',3:'機槍',4:'重型槍械',5:'輕鎧',6:'鎧甲',7:'重鎧',8:'公演皇冠',9:'公演飾物',10:'商業持物',11:'工事工具'};
  function item(data,id){
    const r=data.items.find(i=>i.index===id);if(!r)return null;
    const raw=r.rawBytes||originalItem(id),s=r.recoveredStats||{},v=data.original?.transport.vehicles.find(v=>v.itemId===id),type=r.categoryCandidate;
    const g={id,name:r.name.trim(),category:categories[type]||'部隊裝備',summary:'',effect:'',use:'購買後收入部隊倉庫；將物品拖曳到適用角色或傭兵身上。換下的裝備會歸還倉庫。',notes:[],stats:[],price:r.priceCandidate,resale:Math.trunc(r.priceCandidate/2),compatible:[],source:'原作物品記錄與裝備適用表'};
    if(id<23){g.summary=`${g.name}是個人${g.category}，供可使用此類槍械的成員作戰。`;g.effect=`武器威力 ${s.power}，射速累積係數 ${s.parameter39}。實際傷害另受攻擊能力、命中與敵方防禦影響；係數不是每秒射擊次數。`;g.stats=[['威力',s.power],['射速係數',s.parameter39]];if(id>=21)g.notes.push('這筆原作記錄的價格與戰鬥數值為 0；尚無證據確認特殊用途，請勿當成高階武器購買。');}
    else if(id<40){g.summary=`${g.name}是穿戴於個人的${g.category}。`;g.effect=`提供防護 ${s.protection}，在戰鬥傷害判定時使用；不會直接增加生命上限。`;g.stats=[['防護',s.protection]];g.notes.push('不同兵種的穿戴資格不同，商店與倉庫會標示是否適用。');}
    else if(id<=43){g.summary=`${g.name}是戰鬥生命補給品。`;g.effect=id===43?'觸發時將生命回復至該等級的生命上限。':`觸發時回復 ${s.recoveryCode} HP，不超過生命上限。`;g.use='放入成員的「持物」欄。原作戰鬥在生命比例降至 25% 以下時自動使用，每次消耗 1 個；放在倉庫中不會自動使用。';g.stats=[['生命回復',id===43?'全滿':s.recoveryCode]];}
    else if(id<=47){g.summary=`${g.name}的原作記錄含疲勞回復欄位 ${raw[43]}。`;g.effect='生命回復值為 0，不能當作回復膠囊使用。疲勞欄位已讀出，但其完整使用條件尚未核實。';g.notes.push('目前不宣稱可手動消除疲勞；休養請使用駐留回復、野外休息或病院。');g.stats=[['生命回復',0],['疲勞回復欄位',raw[43]]];}
    else if(id<=51){g.summary=`${g.name}是原檔中的特殊補給品。`;g.effect='記錄的生命回復與一般能力加成欄位皆為 0；特殊觸發效果尚未確認。';g.notes.push('售價高不代表可復活或永久強化。本版不附加原作未核實的效果，建議確認需求後再購買。');}
    else if(id<62){const skill=type===10?'商業':type===11?'工事':'公演',offset=type===10?40:type===11?42:41,bonus=(raw[offset]<<24)>>24;g.bonus=bonus;g.skillIndex=type===10?0:type===11?2:1;g.summary=`${g.name}是提升${skill}能力的${g.category}。`;g.effect=`${skill}能力 ＋${bonus}（加固定值，並非 ＋${bonus}%）。僅對本身${skill}能力大於 0 的持有人生效，無法讓沒有該能力的成員學會技能。`;g.stats=[[skill+'加成','＋'+bonus]];g.use=`配備在具有${skill}能力的成員「持物」欄，執行${type===10?'商賣':type===11?'工事':'公演'}流程時由原作判定使用；倉庫中不生效。同一人只能配備一種持物。`;g.notes.push('加成提高對應能力；最終收益或進度仍依任務、據點與原作條件計算。');if(id===59)g.notes.push('會員證是商業能力持物；沒有證據顯示它提供所有商店通用折扣。');}
    else if(v){g.category={tank:'部隊車輛',plane:'部隊飛機',cannon:'部隊火砲'}[v.kind];g.summary=`${g.name}是${g.category}，由整支部隊持有。`;g.stats=[['威力',v.attack],['防護',v.defense]];if(v.kind!=='cannon')g.stats.unshift(['最大耐久',v.maxDurability]);g.use='在原作載具商店交易，直接配置到部隊相應欄位；不拖到個別角色身上。同城駐留的部隊可透過「隊伍移交」交換載具。每隊各有一個車輛、飛機與火砲欄。';g.effect=v.kind==='tank'?'可啟用車輛移動。路線受地形與封鎖影響，戰車作戰依原作車輛、操作成員與據點反擊規則結算。':v.kind==='plane'?'可在符合條件的據點間選擇飛行。起降據點、跨國路線、封鎖與劇情條件都會影響可行性；擁有飛機並不代表能飛往任何位置。':'部隊攻城用火砲，參與原作據點攻擊計算；不會替換成員的手持槍械，也不提供移動方式。';g.notes.push(v.kind==='cannon'?'火砲沒有與車輛／飛機相同的耐久槽，不以 0 耐久表示損壞。':'請留意剩餘耐久。原作整備、行軍、戰鬥受損與撤退條件會改變載具狀態。');g.notes.push('換購時舊載具以原價一半折抵，實際費用以商店交易畫面為準。');}
    if(id<62){const row=data.original?.transport.equipmentCompatibility[type]||[];g.compatible=data.classes.filter(c=>row[c.index]===1).map(c=>({id:c.index,name:c.name.trim()}));}
    return g;
  }
  function flight(state,data,id,engine){
    const site=Intel.flightSite(state,data,id),q=state.squads[state.selectedSquad]||state.squads[0];let journey='unavailable',message=site.detail;
    if(site.marked&&!site.restricted&&q){
      if(q.planeId===undefined||q.planeId===null||q.planeId<0||q.planeId===255){journey='no-plane';message='此處有起降點，但本隊未配置飛機；需先購入或移交部隊飛機。';}
      else if(q.moveMode===2){journey='in-flight';message='本隊目前飛行中，請依原航路抵達，或使用退卻返回原起降點。';}
      else if(q.planeDurability<=0){journey='repair';message='本隊已配置飛機，但耐久已耗盡；請先維修，避免起飛後故障退卻。';}
      else if(engine.atBase(q)&&q.at===id){journey='origin';message='本隊正駐留此起降點；選擇另一處起降點，再確認飛行航路。';}
      else if(!engine.commandAvailability(state,data,q.id).move){journey='busy';message='目前部隊狀態無法下達新的行軍命令。';}
      else if(!engine.movementOptions(state,data,q.id,id).choices.includes(2)){journey='conditions';message='本隊目前不符合飛行條件；請確認出發地起降資格、載具及部隊狀態。';}
      else if(!engine.routePlan(data,engine.position(q,data),id,2,state)){journey='blocked';message='起降地點符合，但目前沒有可行航路；地形或沿途據點封鎖尚未解除。';}
      else{journey='ready';message='本隊目前可規劃飛往此處；可在交通方式選擇「飛行移動」。';}
    }
    return {...site,journey,message};
  }
  function town(state,data,id,engine){
    const b=data.bases[id];if(!b)return null;
    const raw=state.world?.bases[id]||data.original?.transport.bases[id],q=state.squads[state.selectedSquad]||state.squads[0];
    const stationed=state.squads.filter(p=>p.active!==0&&engine.atBase(p)&&p.at===id);
    const local=stationed.find(p=>p.id===q.id)||stationed[0];let services=[];if(local&&Intel.baseStatus(state,data,id).canEnter){try{services=engine.townActions(state,data,local.id).actions.map(a=>a.label.trim());}catch{}}
    const vehicles=engine.vehiclesAt(data,id).map(s=>({shop:s.name,...data.original.transport.vehicles.find(v=>v.kind===s.kind&&v.typeId===s.typeId)}));
    const origin=engine.position(q,data),routes=[0,1,2].map(mode=>{const plan=engine.routePlan(data,origin,b,mode,state);return {mode,cells:plan?plan.cells.length-1:null};});
    return {status:Intel.baseStatus(state,data,id),flight:flight(state,data,id,engine),id,name:b.name,country:data.countries[b.countryIndexCandidate]?.name||'未知國家',x:b.xCandidate,y:b.yCandidate,kind:raw?.kind,durability:raw?.raw1A,maxDurability:raw?.raw1C,blocked:raw?.kind===3,flightRestricted:!!raw?.state5D,services,visited:!!local,shops:b.shopRecords.map(s=>s.name.trim()),vehicles,stationed:stationed.map(p=>({id:p.id,name:p.name,members:p.members.length})),routes};
  }
  return Object.freeze({item,town,flight,categories});
});
