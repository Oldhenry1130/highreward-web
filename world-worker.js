/* The same original campaign engine, isolated from rendering and input. */
'use strict';
self.window=self;
importScripts(...['data/game-data.js','data/original-data.js','original-transport.js','original-combat.js','original-campaign.js','battle-bridge.js','original-story.js','story-bridge.js','engine.js'].map(p=>p+'?v=0.5.0'));
self.onmessage=function(event){
  const {state,generation,ticks}=event.data;
  try{
    self.HREngine.step(state,self.HR_DATA,Math.max(1,Math.min(8,Math.trunc(ticks)||1)));
    self.postMessage({generation,state});
  }catch(error){self.postMessage({generation,error:error.message});}
};
