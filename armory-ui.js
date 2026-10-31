(function(root){
  'use strict';
  root.HRArmoryUI={create(a){
    const {data:D,engine:E,esc,icon,img,portrait,itemStats}=a,A=root.HRArmory;
    let view='equipment',party=0,peer=1,selection=null,selectedOffer=null,quantity=1,shopEvent=null,pressed=null,ghost=null,suppressClick=false;
    const state=()=>a.state(),q=id=>state().squads[id],cash=n=>n.toLocaleString('en-US'),keys=['weapon','armor','consumable'],labels={weapon:'武器',armor:'防具',consumable:'持物'};
    const member=(p,slot)=>q(p).members.find((m,i)=>(m.originalSlot??i)===slot);
    const packItem=id=>D.items.find(i=>i.index===id),same=(x,y)=>!!x&&!!y&&['kind','party','slot','item','key'].every(k=>x[k]===y[k]);
    function peers(){return state().squads.filter(x=>x.active!==0&&x.originalOrder===2&&!x.position&&(x.currentBase??x.at)===(q(party).currentBase??q(party).at));}
    function chip(p,action,active){return `<button class="company-chip ${active?'selected':''}" data-armory-action="${action}" data-party="${p.id}" aria-label="${action==='peer'?'接收部隊':'管理部隊'} ${esc(p.name)}"><img src="${esc(portrait(p.face))}" alt=""><span>${esc(p.name)}<small>${p.members.length}/11</small></span></button>`;}
    function dragAttrs(x){return `data-drag-kind="${x.kind}" data-party="${x.party}" ${x.slot!==undefined?`data-slot="${x.slot}"`:''} ${x.item!==undefined?`data-item="${x.item}"`:''} ${x.key?`data-key="${x.key}"`:''}`;}
    function payload(el){return{kind:el.dataset.dragKind,party:+el.dataset.party,...(el.dataset.slot!==undefined?{slot:+el.dataset.slot}:{}),...(el.dataset.item!==undefined?{item:+el.dataset.item}:{}),...(el.dataset.key?{key:el.dataset.key}:{})};}
    function hint(){return `<p class="drag-guide" role="status">${icon('move')}<span>${selection?selection.kind==='person'?'已選成員：點選目標位置移動或交換。':`已選${esc(packItem(selection.item)?.name||'裝備')}：點選成員裝備，或拖回倉庫。`:shopEvent?'拖曳倉庫物品到成員，或將穿戴裝備拖回倉庫；也可先點物品，再點成員。':'拖曳頭像調整編制；拖曳物品裝備。也可先點來源，再點目標。'}</span>${selection?'<button data-armory-action="cancelSelection">取消選取</button>':''}</p>`;}
    function preview(m){
      const candidate=selection&&['stock','gear'].includes(selection.kind)?selection.item:shopEvent?.options.find(o=>o.id===selectedOffer)?.itemId;if(candidate===undefined)return '';
      const item=packItem(candidate);if(!item)return '';const key=A.slotOf(item.index),old=packItem(m[key]);
      if(!A.compatible(D,item.index,m))return '<small class="equip-ineligible">無法使用此裝備</small>';
      const field=key==='weapon'?'power':key==='armor'?'protection':null;
      if(!field)return '<small class="equip-eligible">可配備此持物</small>';
      const before=old?.recoveredStats?.[field]||0,after=item.recoveredStats?.[field]||0,diff=after-before;
      return `<small class="equip-${diff>=0?'eligible':'decrease'}">${key==='weapon'?'威力':'防護'} ${before} → ${after}（${diff>0?'+':''}${diff}）</small>`;
    }
    function roster(p,equipment=true){
      return `<section class="visual-company"><h3><img src="${esc(portrait(q(p).face))}" alt="">${esc(q(p).name)} <small>${q(p).members.length}/11</small></h3><div class="visual-roster">${Array.from({length:11},(_,slot)=>{
        const m=member(p,slot),person={kind:'person',party:p,slot},chosen=same(person,selection),canUse=m&&selection&&selection.kind!=='person'&&A.compatible(D,selection.item,m);
        if(!m)return `<button class="loadout-card empty-member" data-drop-kind="member" data-party="${p}" data-slot="${slot}" aria-label="${esc(q(p).name)} 位置${slot+1} 空位"><span class="slot-number">${slot+1}</span>${icon('people')}<strong>空位</strong><small>將傭兵拖到這裡</small></button>`;
        const leader=(m.classId??m.face)<=5;
        return `<article class="loadout-card ${chosen?'drag-selected':''} ${canUse?'can-equip':''}" data-drop-kind="member" data-party="${p}" data-slot="${slot}" tabindex="0" role="group" aria-label="${esc(q(p).name)} 位置${slot+1} ${esc(m.name)}"><span class="slot-number">${slot+1}</span><button class="member-drag-handle" ${shopEvent?'':dragAttrs(person)} aria-label="${leader?'查看隊長':'移動'} ${esc(m.name)} 位置${slot+1}" ${leader?'data-leader="true"':''}><img src="${esc(portrait(m.face))}" alt="${esc(m.name)}"><span>${leader?'♛ 隊長固定':shopEvent?'角色裝備':'⠿ 拖曳移動'}</span></button><strong>${esc(m.name)}</strong><small>HP ${m.hp}/${m.maxHp} · 等級 ${m.level}</small>${equipment?`<div class="member-equipment">${keys.map(key=>{const id=m[key],item=packItem(id),x={kind:'gear',party:p,slot,key,item:id};return `<button class="gear-slot ${item?'occupied':''}" ${item?dragAttrs(x):''} title="${labels[key]}：${esc(item?.name||'未裝備')}" aria-label="${esc(m.name)}的${labels[key]} ${esc(item?.name||'未裝備')}">${item?img('ITEM.MRG:'+item.iconIdCandidate,'',item.name):icon(key==='weapon'?'sword':key==='armor'?'shield':'bag')}<span>${labels[key]}${key==='consumable'&&item?` ×${m.consumableCount||1}`:''}</span></button>`;}).join('')}</div>${preview(m)}`:''}</article>`;
      }).join('')}</div></section>`;
    }
    function warehouse(p,selling=false){
      return `<section class="pack-panel" data-drop-kind="warehouse" data-party="${p}" tabindex="0" aria-label="${esc(q(p).name)}的部隊倉庫"><h3>${icon('chest')}部隊倉庫 <small>${(q(p).pack||[]).reduce((n,x)=>n+x.count,0)} 件</small></h3><p>隨${esc(q(p).name)}保存 · 舊裝備可拖回</p><div class="pack-grid">${(q(p).pack||[]).map(r=>{const item=packItem(r.itemId),x={kind:'stock',party:p,item:r.itemId};return `<div class="pack-entry"><button class="pack-item ${same(x,selection)?'drag-selected':''}" ${dragAttrs(x)} aria-label="${esc(item.name)} 倉庫數量${r.count}">${img('ITEM.MRG:'+item.iconIdCandidate,'',item.name)}<strong>${esc(item.name)}</strong><b>× ${r.count}</b><small>${A.slotOf(r.itemId)==='weapon'?`威力 ${item.recoveredStats.power}`:A.slotOf(r.itemId)==='armor'?`防護 ${item.recoveredStats.protection}`:'持物／補給'}</small></button>${selling?`<button class="sell-stock" data-armory-action="sell" data-item="${r.itemId}" ${shopEvent.shopState.selectedCategory!==(r.itemId<23?0:r.itemId<40?1:2)||!item.priceCandidate?'disabled':''}>售出 1 件 · ${cash(Math.trunc(item.priceCandidate/2))} G</button>`:''}</div>`;}).join('')||`<div class="pack-empty">${icon('bag')}<strong>倉庫尚無物品</strong><span>在商店購買後會存入這裡。<br>也能將成員的裝備拖回倉庫。</span></div>`}</div></section>`;
    }
    function manager(){
      shopEvent=null;const all=peers();if(!all.some(p=>p.id===peer)||peer===party)peer=all.find(p=>p.id!==party)?.id??party;
      a.open(`<span class="eyebrow">HIGH REWARD · COMPANY & ARMORY</span><h2>編制與部隊倉庫</h2><div class="armory-tabs"><button data-armory-action="mode" data-mode="equipment" class="${view==='equipment'?'selected':''}">${icon('shield')}裝備與倉庫</button><button data-armory-action="mode" data-mode="formation" class="${view==='formation'?'selected':''}">${icon('people')}隊伍移交</button></div><div class="company-chips">${all.map(p=>chip(p,'party',p.id===party)).join('')}</div>${hint()}${view==='equipment'?`<div class="armory-layout">${warehouse(party)}${roster(party)}</div>`:`<p class="peer-label">選擇接收部隊</p><div class="company-chips">${all.filter(p=>p.id!==party).map(p=>chip(p,'peer',p.id===peer)).join('')}</div><div class="transfer-board">${roster(party,false)}${peer!==party?roster(peer,false):'<p class="pack-empty">目前沒有其他同城駐留部隊；可在左側調整本隊位置。</p>'}</div>${peer!==party?`<div class="vehicle-transfer-grid">${['tank','plane','cannon'].map(kind=>{const source=D.original.transport.vehicles.find(v=>v.kind===kind&&v.typeId===q(party)[kind+'Id']),target=D.original.transport.vehicles.find(v=>v.kind===kind&&v.typeId===q(peer)[kind+'Id']);return `<button data-armory-action="vehicle" data-kind="${kind}" ${!source?'disabled':''}>${icon(kind==='cannon'?'sword':kind)}<strong>${{tank:'車輛',plane:'飛機',cannon:'火砲'}[kind]}移交</strong><span>${esc(source?.name||'未配置')} → ${esc(target?.name||'空位')}</span></button>`;}).join('')}</div>`:''}<p class="small muted">拖到空位會移交，拖到其他傭兵會交換；隊長保留原位。</p>`}`,'armory');
    }
    function show(p=0,mode='equipment'){try{A.ready(state(),q(p));party=p;view=mode;selection=null;manager();}catch(e){a.toast(e.message);}}
    function renderShop(e){
      if(e.shopState?.mode!==0||e.shopState.selectedCategory===3||!e.options.some(o=>A.slotOf(o.itemId)&&o.offerIndex!==undefined))return false;
      shopEvent=e;party=a.selected();const offers=e.options.filter(o=>o.offerIndex!==undefined&&A.slotOf(o.itemId)),categories=e.options.filter(o=>o.id>=100&&o.id<104);
      if(!offers.some(o=>o.id===selectedOffer))selectedOffer=offers[0]?.id;const selected=offers.find(o=>o.id===selectedOffer),item=packItem(selected?.itemId),cost=(selected?.price||0)*quantity;
      a.open(`<span class="eyebrow">HIGH REWARD · EQUIPMENT SHOP</span><h2>裝備採購</h2><div class="purchase-steps"><span>① 選購商品</span><b>→</b><span>② 收入部隊倉庫</span><b>→</b><span>③ 拖給角色或傭兵</span></div><div class="native-shop-heading"><span>${icon('coin')} ${cash(state().money)} G</span><strong>${esc(q(party).name)}</strong></div><div class="native-shop-categories">${categories.map(o=>`<button data-armory-action="category" data-value="${o.id}" class="${e.shopState.selectedCategory===o.category?'selected':''}">${icon(o.id===100?'sword':o.id===101?'shield':o.id===102?'bag':'people')}<span>${esc(o.text)}</span></button>`).join('')}</div><section class="shop-catalog"><h3>① 選擇商品</h3><div class="shop-product-grid">${offers.map(o=>{const i=packItem(o.itemId);return `<button class="shop-product ${o.id===selectedOffer?'selected':''}" data-armory-action="offer" data-value="${o.id}" aria-label="選購 ${esc(i.name)} ${o.price} G">${img('ITEM.MRG:'+i.iconIdCandidate,'',i.name)}<strong>${esc(i.name)}</strong><b>${cash(o.price)} G／件</b>${A.slotOf(i.index)==='consumable'?`<div class="supply-summary">${i.recoveredStats.recoveryCode>0?'生命回復 ＋'+i.recoveredStats.recoveryCode:'隊伍持物／補給'}</div>`:itemStats(i)}</button>`;}).join('')}</div>${selected?`<div class="purchase-checkout"><h3>${esc(item.name)}</h3><div class="quantity-controls"><span>購買數量</span><button data-armory-action="quantity" data-delta="-1" aria-label="減少購買數量" ${quantity<=1?'disabled':''}>−</button><output aria-label="購買數量">${quantity}</output><button data-armory-action="quantity" data-delta="1" aria-label="增加購買數量" ${quantity>=99?'disabled':''}>＋</button></div><p>單價 ${cash(selected.price)} G × ${quantity} = <strong>${cash(cost)} G</strong></p><button class="buy-to-pack primary" data-armory-action="buy" ${state().money<cost?'disabled':''}>${icon('chest')}購買 → 部隊倉庫</button><small>先預覽下方成員的適用性與能力差異。購買後不會自動穿戴，舊裝備也不會自動出售。</small></div>`:''}</section><h3 class="step-caption">② 部隊倉庫 → ③ 拖給成員</h3>${hint()}<div class="armory-layout">${warehouse(party,true)}${roster(party)}</div><div class="modal-actions"><button data-armory-action="leaveShop">${icon('back')}離開商店</button></div>`,'story');return true;
    }
    function refresh(){if(shopEvent)renderShop(state().story.event);else manager();}
    function committed(){a.save();a.renderMain();refresh();}
    function drop(x,target){
      if(!target)return false;const p=+target.dataset.party,slot=+target.dataset.slot;
      try{
        a.invalidate();
        if(target.dataset.dropKind==='member'){
          if(x.kind==='person'){if(x.party===p&&x.slot===slot){selection=null;refresh();return true;}E.command(state(),D,{type:'transfer',kind:'person',squad:x.party,fromSlot:x.slot,target:p,toSlot:slot});}
          else if(x.kind==='stock')E.manageStock(state(),D,{type:'equipStock',squad:p,fromSquad:x.party,slot,item:x.item});
          else if(x.kind==='gear'){
            if(x.party===p&&x.slot===slot){selection=null;refresh();return true;}
            if(shopEvent)throw Error('跨成員換裝請先離開商店，再使用編制與倉庫');
            E.command(state(),D,{type:'transfer',kind:x.key==='consumable'?'third':x.key,squad:x.party,fromSlot:x.slot,target:p,toSlot:slot});
          }
        }else if(target.dataset.dropKind==='warehouse'){
          if(x.kind==='person')throw Error('成員請放到部隊的空位或其他成員位置');
          if(x.kind==='stock')E.manageStock(state(),D,{type:'moveStock',squad:x.party,target:p,item:x.item});
          else{if(x.party!==p)throw Error('請先卸回所屬部隊倉庫，再移交物品');E.manageStock(state(),D,{type:'unequipStock',squad:p,slot:x.slot,key:x.key});}
        }
        selection=null;committed();a.toast(x.kind==='person'?'編制已更新':'裝備與倉庫已更新');return true;
      }catch(e){a.toast(e.message);return false;}
    }
    document.addEventListener('click',event=>{
      if(!event.target.closest('.visual-company,.pack-panel,.armory-tabs,.company-chips,.shop-catalog,.native-shop-categories,.modal-actions,.drag-guide'))return;
      if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;return;}
      const b=event.target.closest('[data-armory-action]');
      if(b&&!b.disabled){event.preventDefault();a.invalidate();try{switch(b.dataset.armoryAction){
        case 'party':party=+b.dataset.party;manager();break;case 'peer':peer=+b.dataset.party;manager();break;
        case 'mode':view=b.dataset.mode;selection=null;manager();break;
        case 'vehicle':E.command(state(),D,{type:'transfer',kind:b.dataset.kind,squad:party,target:peer});committed();a.toast('載具移交完成');break;
        case 'cancelSelection':selection=null;refresh();break;
        case 'category':selection=null;selectedOffer=null;quantity=1;a.resumeStory({value:+b.dataset.value});break;
        case 'offer':selectedOffer=+b.dataset.value;selection=null;quantity=1;renderShop(shopEvent);break;
        case 'quantity':quantity=Math.max(1,Math.min(99,quantity+(+b.dataset.delta)));renderShop(shopEvent);break;
        case 'buy':{const r=E.manageStock(state(),D,{type:'purchaseStock',squad:party,offer:selectedOffer,quantity});selection={kind:'stock',party,item:r.itemId};committed();document.querySelector('.armory-layout')?.scrollIntoView({block:'start',behavior:'smooth'});a.toast(`已購買 ${quantity} 件，收入部隊倉庫；可拖給成員。`);break;}
        case 'sell':E.manageStock(state(),D,{type:'sellStock',squad:party,item:+b.dataset.item});selection=null;committed();a.toast('已出售 1 件倉庫物品');break;
        case 'leaveShop':selection=null;shopEvent=null;a.resumeStory({value:-1});break;
      }}catch(e){a.toast(e.message);}return;}
      const source=event.target.closest('[data-drag-kind]'),target=event.target.closest('[data-drop-kind]');
      if(selection&&target&&(!source||target.dataset.dropKind==='member')){if(drop(selection,target))return;}
      if(source){const x=payload(source);if(source.dataset.leader){a.toast('隊長的位置固定，可拖曳其他傭兵調整編制。');return;}selection=same(selection,x)?null:x;refresh();}
    },true);
    document.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;const el=event.target.closest('[data-drag-kind]');if(!el||el.dataset.leader)return;
      a.invalidate();pressed={id:event.pointerId,x:event.clientX,y:event.clientY,source:payload(el),el,dragging:false};
    });
    document.addEventListener('pointermove',event=>{
      if(!pressed||event.pointerId!==pressed.id)return;
      if(!pressed.dragging&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<7)return;
      event.preventDefault();
      if(!pressed.dragging){pressed.dragging=true;ghost=document.createElement('div');ghost.className='armory-drag-ghost';ghost.innerHTML=pressed.el.innerHTML;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);pressed.el.classList.add('is-dragging');}
      ghost.style.left=event.clientX+'px';ghost.style.top=event.clientY+'px';
      document.querySelectorAll('.drop-hover').forEach(el=>el.classList.remove('drop-hover','drop-invalid'));const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-kind]');if(target){target.classList.add('drop-hover');const m=target.dataset.dropKind==='member'?member(+target.dataset.party,+target.dataset.slot):null;if(target.dataset.dropKind==='member'&&(pressed.source.kind==='person'?m&&(m.classId??m.face)<=5:!m||!A.compatible(D,pressed.source.item,m)))target.classList.add('drop-invalid');}
      const dialog=document.querySelector('#modal'),r=dialog.getBoundingClientRect();if(event.clientY>r.bottom-65)dialog.scrollTop+=18;else if(event.clientY<r.top+65)dialog.scrollTop-=18;
    },{passive:false});
    function release(event){
      if(!pressed||event.pointerId!==pressed.id)return;const current=pressed;pressed=null;ghost?.remove();ghost=null;current.el.classList.remove('is-dragging');document.querySelectorAll('.drop-hover').forEach(el=>el.classList.remove('drop-hover','drop-invalid'));
      if(current.dragging){suppressClick=true;setTimeout(()=>{suppressClick=false;},200);drop(current.source,document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-kind]'));}
    }
    document.addEventListener('pointerup',release);document.addEventListener('pointercancel',event=>{if(pressed?.id===event.pointerId){pressed.el.classList.remove('is-dragging');pressed=null;ghost?.remove();ghost=null;}});
    document.addEventListener('dragstart',event=>{if(event.target.closest('[data-drag-kind]'))event.preventDefault();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selection){event.preventDefault();event.stopPropagation();selection=null;refresh();}else if(['Enter',' '].includes(event.key)&&event.target.matches('[data-drop-kind]')&&selection){event.preventDefault();drop(selection,event.target);}});
    return{show,renderShop,refresh,clear(){selection=null;pressed=null;ghost?.remove();ghost=null;shopEvent=null;}};
  }};
})(typeof globalThis==='object'?globalThis:this);
