/* Presentation only: do not consume randomness or mutate native combat state. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HRBattleArt=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const assets=['field',...Array.from({length:6},(_,i)=>'hero-'+i), 'infantry','armored','crew'].map(n=>'assets/battle-v2/'+n+'.webp');
  function layout(actor){const x=actor.x+32,y=actor.y+32;return {left:x/640*100,top:y/400*100,depth:Math.max(1,Math.min(399,y)),height:actor.classId<6?23:18,hidden:actor.classId===-1||x< -50||x>690||y< -50||y>450};}
  function pose(actor){return actor.hp<=0||actor.state>=30?'down':actor.state>=28?'leaving':actor.state>=8&&actor.state<=13||actor.state>=24&&actor.state<=27?'hit':actor.state>=1&&actor.state<=7?'firing':'ready';}
  function hero(id){if(!Number.isInteger(id))return null;if(id>=0&&id<6)return assets[id+1];if([7,8,9,41,43,54,58,63,72].includes(id))return assets[8];if(id>=12&&id<=14)return assets[9];if(id===6||id===10||id>=29&&id<=84&&![37,38,39,40,56,57,69,74,75,76,77].includes(id))return assets[7];return null;}
  return Object.freeze({assets:Object.freeze(assets),background:assets[0],layout,pose,hero});
});
