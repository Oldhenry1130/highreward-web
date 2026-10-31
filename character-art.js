/* Named character artwork. Presentation only: no game-state writes or RNG. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./character-art-data.js'));else root.HRCharacterArt=factory(root.HR_CHARACTER_ART_DATA);})(typeof globalThis==='object'?globalThis:this,function(data){
  'use strict';
  const entries=new Map((data?.records||[]).map(r=>[r.id,r])),loaded=new Set(),observed=new Set(),actors=new WeakMap();let serial=0,observer=null,queued=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=s=>String(s??'').replace(/[\s‧・·]/g,'');
  function get(id){return entries.get(Number(id))||null;}
  function name(id,fallback=''){return get(id)?.name||fallback;}
  function pose(actor){const s=actor.state;return actor.hp<=0||s>=30?'down':s>=28?'leaving':s>=8&&s<=13||s>=24&&s<=27?'hit':[2,3,5,7,18,19,20,21,22,23].includes(s)?'firing':'ready';}
  function frame(p){return p==='firing'?'fire':p==='hit'?'hit':'ready';}
  function image(id,kind='portrait',label='',className='',immediate=false){
    const r=get(id),key=kind==='portrait'?'portrait':frame(kind),f=r?.frames[key];if(!r||!f)return '';
    const uid='hr-char-'+(++serial),asset=r.asset+'?v='+r.sha256.slice(0,12),ready=immediate||loaded.has(asset),src=ready?'href':'data-character-src';
    if(immediate)loaded.add(asset);
    return `<svg xmlns="http://www.w3.org/2000/svg" class="character-art ${key==='portrait'?'character-portrait':'character-body'} ${esc(className)}" role="img" aria-label="${esc(label||r.name)}" viewBox="${f.viewBox.join(' ')}" preserveAspectRatio="xMidYMax meet" data-character-id="${r.id}" data-character-frame="${key}" data-character-clip="${uid}"><defs><clipPath id="${uid}" clipPathUnits="userSpaceOnUse"><path d="${esc(f.clip)}" clip-rule="evenodd"/></clipPath></defs><image ${src}="${esc(asset)}" width="${r.width}" height="${r.height}" clip-path="url(#${uid})"/></svg>`;
  }
  function setPose(svg,p){
    if(!svg)return;const r=get(svg.dataset.characterId),key=frame(p),f=r?.frames[key];if(!f||svg.dataset.characterFrame===key)return;
    svg.dataset.characterFrame=key;svg.setAttribute('viewBox',f.viewBox.join(' '));svg.querySelector('clipPath path').setAttribute('d',f.clip);
  }
  function speakerClass(face,speaker){
    const n=normalize(speaker),records=[...entries.values()];
    if(n){const exact=records.find(r=>normalize(r.name)===n);if(exact)return exact.id;
      const partial=records.filter(r=>normalize(r.name).length>=3&&n.length>=2&&(normalize(r.name).startsWith(n)||normalize(r.name).endsWith(n)||n.startsWith(normalize(r.name))));if(partial.length===1)return partial[0].id;}
    const matches=records.filter(r=>r.sourceSpriteId===face);return matches.length===1?matches[0].id:null;
  }
  function hydrate(root){
    if(typeof document==='undefined')return;
    const load=svg=>{const img=svg.querySelector('image[data-character-src]');if(!img)return;const src=img.getAttribute('data-character-src');img.setAttribute('href',src);img.removeAttribute('data-character-src');loaded.add(src);};
    if(!observer&&typeof IntersectionObserver!=='undefined')observer=new IntersectionObserver(rows=>rows.forEach(row=>{if(row.isIntersecting){load(row.target);observer.unobserve(row.target);observed.delete(row.target);}}),{rootMargin:'160px'});
    for(const svg of observed)if(!svg.isConnected){observer.unobserve(svg);observed.delete(svg);}
    for(const svg of root.querySelectorAll('svg.character-art')){const img=svg.querySelector('image[data-character-src]');if(!img)continue;if(loaded.has(img.getAttribute('data-character-src'))||!observer)load(svg);else if(!observed.has(svg)){observer.observe(svg);observed.add(svg);}}
  }
  function rekey(root){for(const svg of root.querySelectorAll('svg.character-art')){const id='hr-char-'+(++serial);svg.dataset.characterClip=id;svg.querySelector('clipPath').id=id;svg.querySelector('image').setAttribute('clip-path','url(#'+id+')');}}
  if(typeof document!=='undefined'){
    new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;hydrate(document);});}).observe(document.documentElement,{childList:true,subtree:true});
    queueMicrotask(()=>hydrate(document));
  }
  function updateActors(layer,list){
    let pool=actors.get(layer);if(!pool){pool=new Map();actors.set(layer,pool);}const seen=new Set();
    for(const d of list){const key=d.side+':'+d.index;seen.add(key);let node=pool.get(key);
      if(!node){node=layer.ownerDocument.createElement('button');node.type='button';node.dataset.battleInspect=d.index;node.dataset.battleSide=d.side;layer.append(node);pool.set(key,node);}
      node.hidden=!d.visible;node.className=`battle-actor ${d.side} ${d.pose}`;node.setAttribute('aria-label','查看'+d.name+'能力');node.title=d.name+' · '+d.hp+'/'+d.maxHp;
      Object.assign(node.style,{left:d.position.left+'%',top:d.position.top+'%',height:d.position.height+'%',zIndex:d.position.depth});
      if(node.dataset.actorClass!==String(d.id)){node.dataset.actorClass=d.id;node.innerHTML='<span class="actor-foot-shadow"></span><span class="actor-visual">'+image(d.id,d.pose,d.name+'戰鬥立繪','',true)+'</span><span class="actor-caption"><span class="mini-bar"><i></i></span><small></small></span>';}
      setPose(node.querySelector('svg.character-art'),d.pose);node.querySelector('.mini-bar i').style.width=Math.max(0,d.hp)/Math.max(1,d.maxHp)*100+'%';node.querySelector('.actor-caption small').textContent=d.hp+'/'+d.maxHp;
    }
    for(const[key,node]of pool)if(!seen.has(key)){node.remove();pool.delete(key);}
  }
  return Object.freeze({get,name,pose,frame,image,setPose,speakerClass,hydrate,rekey,updateActors,records:data?.records||[]});
});
