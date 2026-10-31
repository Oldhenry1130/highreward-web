/* Cosmetic company heraldry. IDs are portable save data, never native stat bytes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HRHeraldry=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const designs=[
    ['lion','赤獅','勇氣與統率','#892f31','M22 39l7-7-1-10 8-8 10 3 5 10-7 8 2 8-7 6-9-3 3-9-6-3m8-8 7 2m-7 8 8 1m-3-19 3 1m-12 14-8 9 5 7h7m16-15 8-6v-9'],
    ['eagle','蒼鷹','紀律與機動','#24475c','M32 16l5 12 17-7-10 14 12-2-14 10-4-6-6 16-6-16-4 6L8 33l12 2L10 21l17 7 5-12m0 12v14'],
    ['scales','金秤','商賣與信用','#735821','M32 16v34m-13 0h26M16 24h32M20 24l-9 17h18l-9-17m24 0-9 17h18l-9-17M29 16h6'],
    ['rose','緋薔薇','探索與情誼','#793b52','M32 17l7 3 7-1 1 8 5 5-6 7-2 7-9-1-6 4-6-7-7-3 3-8-1-8 9-2 5-4zm-5 10 10-2 5 8-7 8-10-5 2-9m5 14v12m0-6-10-4m10 0 10-4'],
    ['lyre','月琴','公演與藝術','#5a4278','M19 20l-3 6 3 15 9 7h8l9-7 3-15-3-6-6 4-1 17H26l-1-17-6-4m3 7h20M29 28v13m6-13v13m-10 9h14'],
    ['spear','銀槍','槍兵與工事','#425b50','M29 28l3-17 3 17-3 7-3-7m3 7v20M17 24l4-9 3 9-3 5-4-5m4 5v22m19-27 3-9 4 9-4 5-3-5m3 5v22'],
    ['wolf','霜狼','警戒與追蹤','#40546b','M18 17l12 10 7-1 11-9-2 18-8 14h-8L18 35V17m7 16 5 3m9 0 4-3m-13 9 4 3 4-3'],
    ['phoenix','不死鳥','逆境與重生','#974831','M32 13l5 11 14-5-9 13 11 3-14 4 3 13-10-9-10 9 3-13-14-4 11-3-9-13 14 5 5-11m0 15v14'],
    ['bolt','雷霆','迅捷與突破','#57515e','M34 12L18 36h12l-3 18 19-28H33l1-14'],
    ['dragon','翠龍','威勢與守護','#326357','M21 47l-3-10 7-13 10-5 11 3-7 5 6 6-10-1-6 8 8 4 7-7 3 11-12 6-14-7m11-26 1-9 7 6m-15 11-10-6 2 15 9-3'],
    ['stag','白鹿','林野與耐心','#637044','M26 28l6-4 6 4-2 16-4 5-4-5-2-16m-2 1-7-7-1-11m6 17-1-13m19 14 7-7 1-11m-6 17 1-13m-13 20h1m9 0h1'],
    ['tower','堅塔','駐防與堅守','#515b63','M18 19v-6h7v6h14v-6h7v6l-3 8v25H21V27l-3-8m3 8h22M29 52V40h6v12m-8-20h1m8 0h1'],
    ['sun','旭日','希望與榮譽','#8a6d29','M32 23a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0-12v6m0 32v6M10 33h6m32 0h6M17 18l5 5m20 20 5 5M47 18l-5 5M22 43l-5 5'],
    ['moon','弦月','夜行與謀略','#414570','M40 14c-5 7-5 17 1 23 3 3 7 5 11 5-7 13-26 15-35 2-10-15 1-33 23-30zm6 8v7m-3-3h6'],
    ['wings','雙翼','遠征與自由','#376b7a','M31 28L13 17l4 12 10 6-13-4 8 11 10 4 10-4 8-11-13 4 10-6 4-12-18 11m-1 0v23'],
    ['axes','戰斧','力量與決斷','#734039','M18 49l26-34m-24 2 27 32M18 15l-7 8 10 7 7-8-10-7m27 0 7 8-10 7-7-8 10-7'],
    ['anchor','海錨','渡航與團結','#2f5867','M32 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 0v30M21 28h22M15 36v8l17 9 17-9v-8m-34 0 8 5m26-5-8 5'],
    ['thorn','荊冠','韌性與守望','#66563c','M19 45l-5-9 3-12 7-7m-5 28 13 7 13-7 5-9-3-12-7-7m-22 8-7-4m13-4-2-7m22 15 7-4m-13-4 2-7M23 40l9-19 9 19h-18m9 0v6'],
    ['stars','群星','協作與指引','#4e507c','M32 14l4 9 10 1-8 6 2 10-8-5-8 5 2-10-8-6 10-1 4-9M15 40l2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1 2-4m34 0 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1 2-4'],
    ['compass','羅盤','開拓與領航','#596a61','M32 12v6m0 30v6M11 33h6m30 0h6M25 26l16-7-7 17-16 10 7-20m0 0 9 10m-2-17a14 14 0 1 1-1 0']
  ].map(([id,name,meaning,color,path])=>Object.freeze({id,name,meaning,color,path}));
  const defaults=['lion','eagle','scales','rose','lyre','spear'];
  function get(id){return designs.find(d=>d.id===id)||designs[0];}
  function normalize(q){if(!designs.some(d=>d.id===q.emblemId))q.emblemId=defaults[q.id]||'lion';return q.emblemId;}
  function set(q,id){if(!designs.some(d=>d.id===id))throw Error('隊徽不存在');q.emblemId=id;return id;}
  function svg(id){const d=get(id);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 70" fill="none" aria-hidden="true"><path d="M4 5L32 1l28 4v28c0 16-12 27-28 35C16 60 4 49 4 33Z" fill="${d.color}" stroke="#e4c787" stroke-width="2.5"/><path d="M9 10L32 6l23 4v23c0 13-10 23-23 30C19 56 9 46 9 33Z" stroke="#ffffff" opacity=".18"/><path d="${d.path}" fill="none" stroke="#ffe7af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
  function dataURL(id){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(id));}
  function marker(anchor,index,count,width,height,scale){const size=34*scale,cols=Math.min(3,count),rows=Math.ceil(count/3),dx=39*scale,dy=43*scale;if(anchor.x<0||anchor.x>width||anchor.y<0||anchor.y>height)return {x:anchor.x,y:anchor.y,size,radius:size*.54};let left=anchor.x+24*scale,bottom=anchor.y-20*scale;if(left+(cols-1)*dx+size/2>width)left=anchor.x-24*scale-(cols-1)*dx;if(bottom-(rows-1)*dy-size*.55<0)bottom=anchor.y+20*scale+(rows-1)*dy;left=Math.max(size/2,Math.min(width-size/2-(cols-1)*dx,left));bottom=Math.max(size*.55+(rows-1)*dy,Math.min(height-size*.55,bottom));return {x:left+(index%3)*dx,y:bottom-Math.floor(index/3)*dy,size,radius:size*.54};}
  return Object.freeze({designs:Object.freeze(designs),defaults:Object.freeze(defaults),get,normalize,set,svg,dataURL,marker});
});
