/* Read-only native contract decoder. Source evidence: research/hr-full-restoration/contracts. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OriginalContracts=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const mainSha256='08ed144e8f8d6e97d19f0759bce2420665998143f2f0f056ab7adc718e550e3e';
const civilianNames=['酒壺的運送','信的運送','書的運送','書籍的運送','機器的運送','槍的護送','手槍的運送'];
const performanceNames=['可倫特民族舞','德利卡組舞','拉克修之舞','塞南之舞','秘舞「美神謝蕾德」','誘惑之舞'];
const subtypeNames=['駐留','公演','建築','商賣','潛入'];
const w=(b,o)=>(b[o]|b[o+1]<<8),s=(b,o)=>(w(b,o)<<16)>>16,l=(b,o)=>(w(b,o)|w(b,o+2)<<16);
function text(b,o,n){let end=o;while(end<o+n&&b[end]!==0)end++;return new TextDecoder('big5').decode(Uint8Array.from(b.slice(o,end))).trim();}
function decodeNativeTask(campaignBytes,unitBytes,unitId){
 if(!campaignBytes||campaignBytes.length!==0x7c68)throw new RangeError('Expected complete native campaign (0x7C68 bytes)');
 if(!unitBytes||unitBytes.length!==382)throw new RangeError('Expected native 382-byte unit');
 if(!Number.isInteger(unitId)||unitId<0||unitId>=6)throw new RangeError('Native unitId must be 0..5');
 const c=campaignBytes,u=unitBytes,order=s(u,38),subtype=s(u,44),baseId=s(u,49),active=s(u,42)===1;
 const baseName=id=>id>=0&&id<w(c,0x28ba)?text(c,0x1ab+id*101,21):null;
 const activity={order,subtype,active,baseId,baseName:baseName(baseId),name:order===2?(subtypeNames[subtype]??null):null,rawHeaderWords:[77,79,81,83].map(o=>s(u,o)),unknownHeaderWordMeaning:true};
 const tasks=[],o=0x6445+unitId*84,remainingDays=s(c,o+25),reward=l(c,o+75),record=c.slice(o,o+84);
 const civilian=remainingDays>0?{kind:'civilian',scope:'unit',unitId,sourceOffset:o,name:civilianNames[w(c,o+73)]??null,cargoSelector:w(c,o+73),dialogueType:w(c,o+81),originId:s(c,o),originName:baseName(s(c,o)),destinationId:s(c,o+2),destinationName:text(c,o+4,21),remainingDays,originalDays:s(c,o+27),employer:text(c,o+31,21),employerPortrait:s(c,o+29),cargoDescription:text(c,o+52,21),reward,bonusMultiplier:c[o+83]!==0?2:1,payableReward:c[o+83]!==0?Math.imul(reward,2):reward,status:active?'進行中':'隊伍未啟用',statusCode:active?'active':'unit-inactive',rawRecord:Array.from(record)}:null;
 if(civilian)tasks.push(civilian);
 const military=[];
 for(let i=0;i<10;i++){
  const p=0x691d+i*95,destinationId=s(c,p+2);if(destinationId===-1)continue;
  const type=c[p],destinationName=baseName(destinationId),suffix=text(c,p+50,41),employerTitle=text(c,p+9,41),participating=active&&order===2&&subtype===2&&baseId===destinationId&&type===1;
  military.push({kind:type===1?'construction':type===0?'military':'unknown',scope:'campaign',slot:i,sourceOffset:p,destinationId,destinationName,name:destinationName&&suffix?destinationName+'的'+suffix:null,employer:type===1&&destinationName?destinationName+'的'+employerTitle:employerTitle||null,employerBaseName:type===1?destinationName:null,employerBaseUnknown:type!==1,reward:l(c,p+4),remainingDays:null,deadlineSpecified:false,targetDurability:type===1?s(c,p+93):null,currentDurability:type===1&&destinationName?s(c,0x1ab+destinationId*101+26):null,participating,status:participating?'施工中':'共同契約進行中',statusCode:participating?'working':'campaign-active',dialogueType:s(c,p+91),rawType:type,rawRecord:Array.from(c.slice(p,p+95))});
 }
 // Construction rewards are shared by native eligibility; no permanent party owner is stored.
 for(const m of military)if(m.participating)tasks.push(m);
 let performance=null;
 if(active&&order===2&&subtype===1){const type=baseId>=0&&baseId<128?c[0x6d53+baseId]:null;performance={kind:'performance',scope:'unit',unitId,name:performanceNames[type]??'公演',performanceType:type,destinationId:baseId,destinationName:baseName(baseId),remainingDays:(c[0x6dd3+unitId]<<24)>>24,originalDays:(c[0x6dd9+unitId]<<24)>>24,employer:'主辦人',reward:null,rewardSpecified:false,status:'公演中',statusCode:'working',sourceOffsets:[0x6dd3+unitId,0x6dd9+unitId,baseId>=0?0x6d53+baseId:null]};tasks.push(performance);}
 return{unitId,activity,civilian,performance,military,tasks,hasCurrentTask:tasks.length>0,unknowns:['unit +0x4D..0x54 meaning','completed versus expired civilian record when remainingDays is zero','military employer base is not retained in the active 95-byte record','performance income is calculated at outcome, not a fixed promised reward']};
}
return{version:1,mainSha256,decodeNativeTask,civilianNames,performanceNames,subtypeNames};
});
