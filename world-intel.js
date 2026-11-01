/* Read-only map intelligence from current campaign bytes and explicit event context. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HRWorldIntel=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const normal=s=>String(s||'').replace(/[\s‧•・·]/g,'');
  const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<128&&p.y>=0&&p.y<96;
  const definitions={0:['open','可進入','◇','#82d9ac','可進入據點；抵達並駐留後確認當下店家。'],1:['open','可進入','◇','#82d9ac','可進入據點；抵達並駐留後確認當下店家。'],2:['hostile','敵對／交戰據點','⚔','#ff7c77','需先處理戰鬥或占領，無法直接進城採購。'],3:['blocked','要道封鎖','×','#ffbc66','此處與周邊通路封鎖，暫時不能進城採購。'],4:['special','特殊據點','◆','#87cbff','洞窟、渡場等特殊據點；可用服務依原作事件開放。'],5:['hidden','尚未開放','?','#99a3a2','尚未在目前劇情中開放。']};
  function baseStatus(s,data,id){
    const current=s.world?.bases,original=data.original?.transport?.bases,b=(current?.[id]?.id===id?current[id]:current?.find(b=>b.id===id))||(original?.[id]?.id===id?original[id]:original?.find(b=>b.id===id)),kind=b?.kind;

    const [tone,label,symbol,color,detail]=definitions[kind]||['unknown','狀態未明','?','#b4a4ce','目前無法確認進入與採購資格。'];
    return {kind,tone,label,symbol,color,detail,canEnter:[0,1,4].includes(kind),canShop:[0,1].includes(kind)?'after-docking':kind===4?'source-event':'unavailable'};
  }
  function basePoint(data,id,evidence='base-change'){const b=data.bases[id];return b?{type:'base',baseId:id,x:b.xCandidate,y:b.yCandidate,label:b.name,evidence}:null;}
  function partyPoint(s,data,id,native){
    const q=s.squads[id];if(!q)return null;const raw=native?.parties?.[id],v=raw?new DataView(Uint8Array.from(raw).buffer):null;
    const x=(v?v.getInt16(51,true):q.originalX10)/10,y=(v?v.getInt16(53,true):q.originalY10)/10,order=v?v.getInt16(38,true):q.originalOrder,baseId=v?v.getInt16(49,true):q.currentBase;
    if(!finitePoint({x,y}))return null;
    if(order===2&&data.bases[baseId])return {...basePoint(data,baseId,'party'),partyId:id};
    const near=data.bases.find(b=>{const raw=s.world?.bases?.find(r=>r.id===b.index)||data.original?.transport?.bases?.[b.index];return raw?.kind!==5&&Math.abs(Math.floor(x)-b.xCandidate)<=2&&Math.abs(Math.floor(y)-b.yCandidate)<=2;});
    return {type:'field',partyId:id,x,y,label:(near?near.name+'周邊':'野外')+'（'+x+'，'+y+'）',evidence:'party'};
  }
  function mentionedBases(data,text){
    let remaining=normal(text);const ids=[];
    for(const b of [...data.bases].sort((a,b)=>normal(b.name).length-normal(a.name).length)){const n=normal(b.name);if(n.length<3||!remaining.includes(n))continue;ids.push(b.index);remaining=remaining.split(n).join(' '.repeat(n.length));}
    return ids;
  }
  function locate(s,data,event,native=null,world=false){
    if(!event)return [];const points=[];
    if(Number.isInteger(event.partyId)&&s.squads[event.partyId])points.push(partyPoint(s,data,event.partyId,native));
    const changed=[];if(world&&native?.campaignBytes&&s.originalCampaign)for(const b of data.bases){const o=0x1AB+b.index*101+23;if(native.campaignBytes[o]!==s.originalCampaign[o])changed.push(b.index);}
    points.push(...changed.map(id=>basePoint(data,id)));
    if(world&&event.type!=='complete'){
      const text=[event.text,...(event.lines||[])].filter(Boolean).join('\n');
      if(!points.length)points.push(...mentionedBases(data,text).map(id=>basePoint(data,id,'mentioned')));
      if(!points.length)for(const q of s.squads)if(normal(text).includes(normal(q.name))&&normal(q.name).length>2)points.push(partyPoint(s,data,q.id,native));
    }
    const seen=new Set();return points.filter(p=>{if(!finitePoint(p))return false;const key=p.type+':'+p.x+':'+p.y;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
  }
  function capture(s,data,event,native,world){
    const locations=locate(s,data,event,native,world);if(!locations.length)return;
    event.mapLocations=locations;
    if(!world&&event.type!=='battle')return;
    const clock=native?.date||s.calendar,clockBytes=native?.campaignBytes?new DataView(Uint8Array.from(native.campaignBytes).buffer):null,key=[clock?.year,clock?.month,clock?.day,clockBytes?clockBytes.getInt16(0x23,true):s.clock?.subtick,event.type,...locations.map(p=>p.type+':'+p.x+':'+p.y)].join('/');
    const notice={key,title:event.type==='battle'?'突發戰鬥':event.type==='complete'?'據點局勢變動':'世界事件',locations,text:String(event.text||event.lines?.join('\n')||'').slice(0,240),day:s.day,date:clock,hour:clockBytes?clockBytes.getInt16(0x21,true):s.hour};
    s.story??={history:[]};s.story.mapNotices=[notice,...(Array.isArray(s.story.mapNotices)?s.story.mapNotices:[]).filter(n=>n&&n.key!==key)].slice(0,8);
  }
  function notices(s,data){
    const result=(Array.isArray(s.story?.mapNotices)?s.story.mapNotices:[]).slice(0,8).filter(n=>n&&typeof n.key==='string'&&Array.isArray(n.locations)).map(n=>({...n,locations:n.locations.filter(finitePoint).slice(0,8)})).filter(n=>n.locations.length);
    const e=s.story?.event,pending=e&&!['complete','tick-complete'].includes(e.type),world=!!s.story?.snapshot?.worldBreak;
    if(pending&&(e.type==='battle'||world)){const locs=(Array.isArray(e.mapLocations)?e.mapLocations:locate(s,data,e,null,world)).filter(finitePoint);if(locs.length){const key=result[0]?.locations.some(p=>locs.some(l=>l.x===p.x&&l.y===p.y))?result[0].key:'pending-event';return [{key,title:e.type==='battle'?'突發戰鬥':'目前事件',locations:locs,pending:true},...result.filter(n=>n.key!==key)].slice(0,8);}}
    return result;
  }
  return Object.freeze({baseStatus,basePoint,partyPoint,mentionedBases,locate,capture,notices});
});
