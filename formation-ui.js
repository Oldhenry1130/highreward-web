/* Direct company-card arrangement. Native transfers preserve personal data and slot formation bytes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'),require('./armory.js'));else root.HRFormationUI=factory(root.HREngine,root.HRArmory);})(typeof globalThis==='object'?globalThis:this,function(E,A){
  'use strict';
  function move(state,data,party,from,to){
    const q=state.squads[party];if(!q)throw Error('部隊不存在');A.ready(state,q);
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>10||to<0||to>10)throw Error('成員位置無效');
    const source=q.members.find((m,i)=>(m.originalSlot??i)===from),target=q.members.find((m,i)=>(m.originalSlot??i)===to);
    if(!source)throw Error('來源位置沒有成員');if((source.classId??source.face)<=5||(target&&(target.classId??target.face)<=5))throw Error('隊長固定，請編排其他成員');
    if(from===to)return {changed:false};
    E.command(state,data,{type:'transfer',kind:'person',squad:party,target:party,fromSlot:from,toSlot:to});return {changed:true,swapped:!!target};
  }
  function create(a){
    const {data:D,esc,icon,portrait}=a;let selection=null,pressed=null,ghost=null,suppressUntil=0;
    const faceHTML=a.faceHTML||((id,label='',cls='')=>`<img src="${esc(portrait(id))}" class="${esc(cls)}" alt="${esc(label)}">`);
    const state=()=>a.state(),member=(p,slot)=>state().squads[p]?.members.find((m,i)=>(m.originalSlot??i)===slot);
    function available(p){try{A.ready(state(),state().squads[p]);return '';}catch(e){return e.message;}}
    function render(p){const q=state().squads[p],blocked=available(p);if(selection?.party!==p)selection=null;if(selection&&!member(p,selection.slot))selection=null;
      return `<section class="inline-formation" aria-label="隊內成員排序"><div class="roster-arrange-guide" role="status">${icon('move')}<span>${esc(blocked|| (selection?`已選位置 ${selection.slot+1}：點選空位移動，或點其他成員交換。`:'拖曳成員卡片調整位置；也可先點成員，再點目標。'))}<small>隊長固定 · 裝備與能力隨成員移動</small></span>${selection?'<button data-roster-cancel aria-label="取消編排選取">取消</button>':''}</div><div class="inline-roster-grid">${Array.from({length:11},(_,slot)=>{const m=member(p,slot),leader=m&&(m.classId??m.face)<=5,chosen=selection?.party===p&&selection.slot===slot;return `<div class="inline-roster-cell"><button class="inline-roster-slot ${m?'':'empty'} ${leader?'leader':''} ${chosen?'arrange-selected':''}" data-roster-party="${p}" data-roster-slot="${slot}" ${m&&!leader&&!blocked?'data-roster-draggable':''} aria-label="位置${slot+1} ${esc(m?.name||'空位')}" aria-pressed="${!!chosen}" ${blocked?'disabled':''}><b class="arrange-slot-number">${slot+1}</b>${m?`${faceHTML(m.classId??m.face,`${m.name}`,``)}<span class="arrange-handle">${leader?'♛ 隊長固定':'⠿ 拖曳移動'}</span><strong>${esc(m.name)}</strong><small>LV ${m.level??0} · ${m.hp}/${m.maxHp}</small><span class="hp-bar"><i style="width:${m.hp/Math.max(1,m.maxHp)*100}%"></i></span>`:`${icon('people')}<strong>空位</strong><small>拖到這裡</small>`}</button>${m?`<button class="roster-inspect" data-roster-inspect="${slot}" data-roster-party="${p}" aria-label="位置${slot+1} ${esc(m.name)}能力與裝備">${icon('book')}能力與裝備</button>`:''}</div>`;}).join('')}</div></section>`;
    }
    function clearDrag(){if(pressed?.el.hasPointerCapture?.(pressed.id))pressed.el.releasePointerCapture(pressed.id);pressed?.el.classList.remove('arrange-dragging');pressed=null;ghost?.remove();ghost=null;document.querySelectorAll('.arrange-drop,.arrange-invalid').forEach(e=>e.classList.remove('arrange-drop','arrange-invalid'));}
    function targetAt(x,y){return document.elementFromPoint(x,y)?.closest('[data-roster-slot]');}
    function commit(source,target){if(!target||+target.dataset.rosterParty!==source.party)return false;try{a.pause();const result=move(state(),D,source.party,source.slot,+target.dataset.rosterSlot);selection=null;a.save();a.render();if(result.changed)a.toast(result.swapped?'已交換成員位置，裝備與能力一併保留。':'已將成員移到空位。');return true;}catch(e){a.toast(e.message);return false;}}
    document.addEventListener('click',event=>{
      const el=event.target.closest('[data-roster-slot],[data-roster-inspect],[data-roster-cancel]');if(!el)return;
      event.preventDefault();event.stopImmediatePropagation();if(performance.now()<suppressUntil||el.disabled)return;
      if(el.hasAttribute('data-roster-cancel')){selection=null;a.render();return;}
      if(el.dataset.rosterInspect!==undefined){selection=null;a.inspect(+el.dataset.rosterInspect);return;}
      const p=+el.dataset.rosterParty,slot=+el.dataset.rosterSlot,m=member(p,slot);
      if(selection?.party===p){if(selection.slot===slot){selection=null;a.render();return;}commit(selection,el);return;}
      if(!m){a.toast('先選一名成員，再點這個空位；也可直接拖曳。');return;}
      if((m.classId??m.face)<=5){a.toast('隊長的位置固定，可拖曳其他成員。');return;}
      a.pause();selection={party:p,slot};a.render();
    },true);
    document.addEventListener('pointerdown',event=>{
      const el=event.target.closest('[data-roster-draggable]');if(event.button!==0||!el||el.disabled)return;
      a.pause();pressed={id:event.pointerId,party:+el.dataset.rosterParty,slot:+el.dataset.rosterSlot,x:event.clientX,y:event.clientY,el,dragging:false};el.setPointerCapture(event.pointerId);
    });
    document.addEventListener('pointermove',event=>{
      if(!pressed||event.pointerId!==pressed.id)return;if(!pressed.dragging&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<7)return;
      event.preventDefault();if(!pressed.dragging){pressed.dragging=true;ghost=document.createElement('div');ghost.className='formation-drag-ghost';ghost.innerHTML=pressed.el.innerHTML;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);a.rekey?.(ghost);pressed.el.classList.add('arrange-dragging');}
      ghost.style.left=event.clientX+'px';ghost.style.top=event.clientY+'px';document.querySelectorAll('.arrange-drop,.arrange-invalid').forEach(e=>e.classList.remove('arrange-drop','arrange-invalid'));
      const target=targetAt(event.clientX,event.clientY);if(target&&+target.dataset.rosterParty===pressed.party){const m=member(pressed.party,+target.dataset.rosterSlot);target.classList.add(m&&(m.classId??m.face)<=5?'arrange-invalid':'arrange-drop');}
      const panel=pressed.el.closest('.desk-content'),rect=panel?.getBoundingClientRect();if(panel&&panel.scrollHeight>panel.clientHeight){if(event.clientY>rect.bottom-38)panel.scrollTop+=12;else if(event.clientY<rect.top+38)panel.scrollTop-=12;}else{if(event.clientY>innerHeight-50)window.scrollBy(0,12);else if(event.clientY<50)window.scrollBy(0,-12);}
    },{passive:false});
    document.addEventListener('pointerup',event=>{if(!pressed||event.pointerId!==pressed.id)return;const source={party:pressed.party,slot:pressed.slot},dragged=pressed.dragging,target=targetAt(event.clientX,event.clientY);clearDrag();if(dragged){suppressUntil=performance.now()+400;commit(source,target);}},true);
    document.addEventListener('pointercancel',event=>{if(pressed?.id===event.pointerId)clearDrag();});
    document.addEventListener('dragstart',event=>{if(event.target.closest('[data-roster-slot]'))event.preventDefault();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')&&(pressed||selection)){event.preventDefault();clearDrag();selection=null;a.render();}});
    window.addEventListener('blur',clearDrag);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearDrag();});
    return {render,clear(){clearDrag();selection=null;}};
  }
  return {move,create};
});
