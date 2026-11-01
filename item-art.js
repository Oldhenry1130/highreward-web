/* Presentation-only artwork lookup. Vehicle icon numbers are local to their
 * PANZER/PLANE/CANNON archive, not indices into the ordinary ITEM archive. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HRItemArt=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const groups=Object.freeze({tank:'PANZER.MRG',plane:'PLANE.MRG',cannon:'CANNON.MRG'});
  function assetId(data,id){
    if(!Number.isInteger(id))return null;
    const item=data.items?.find(i=>i.index===id);if(!item)return null;
    if(id>=62){const v=data.original?.transport?.vehicles?.find(v=>v.itemId===id);return v&&Object.hasOwn(groups,v.kind)&&Number.isInteger(v.typeId)&&v.typeId>=0&&v.typeId<8?groups[v.kind]+':'+v.typeId:null;}
    return Number.isInteger(item.iconIdCandidate)&&item.iconIdCandidate>=0&&item.iconIdCandidate<62?'ITEM.MRG:'+item.iconIdCandidate:null;
  }
  return Object.freeze({assetId,groups});
});
