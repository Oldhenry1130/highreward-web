/* Native campaign helpers recovered from resident DOS functions and BC8:2109. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.OriginalCampaign=factory();
})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const i8=v=>(v<<24)>>24;
  function random32768(state){state.seed=(Math.imul(state.seed,0x015A4E35)+1)>>>0;return (state.seed>>>16)&32767;}
  function decodeEncounter(bytes){
    if(!bytes||bytes.length!==81)throw new RangeError('Original encounter requires 81 bytes');
    const raw=Uint8Array.from(bytes),view=new DataView(raw.buffer),classes=Array.from(raw.slice(23,26),i8);
    return {weapon:i8(raw[21]),armor:i8(raw[22]),classes,members:Array.from({length:11},(_,slot)=>{
      const offset=26+slot*5,group=i8(raw[offset]);
      return {slot,group,classId:group===-1?-1:classes[group],level:view.getInt16(offset+1,true),hp:view.getInt16(offset+3,true)};
    })};
  }
  // Resident 0E5F:06AD checks the original commander classes 0..5, HP, fatigue.
  function leaderStatus(bytes){
    if(!bytes||bytes.length!==382)throw new RangeError('Original company requires 382 bytes');
    const view=new DataView(Uint8Array.from(bytes).buffer);
    for(let slot=0;slot<11;slot++){
      const offset=85+slot*27,classId=view.getInt16(offset,true);
      if(classId!==-1&&classId<=5&&(view.getInt16(offset+2,true)<=0||view.getInt16(offset+18,true)>=100))return -1;
    }
    return 1;
  }
  // Resident 198A:0187. Six companies, sixteen 32-bit accounting categories.
  function addLedger(ledger,companyId,category,amount){
    if(!Array.isArray(ledger)||ledger.length!==96)throw new RangeError('Original ledger requires 96 cells');
    if(!Number.isInteger(companyId)||companyId<0||companyId>=6)return 0;
    if(!Number.isInteger(category)||category<0||category>=16)throw new RangeError('Invalid accounting category');
    const index=companyId*16+category;ledger[index]=(ledger[index]+amount)>>>0;return ledger[index];
  }
  // BC8:2210..2231 adds the accumulator once after the battle has ended in victory.
  // The caller supplies the real E95/E97 accumulator, never all initial enemy HP.
  function settleVictory(cash,ledger,companyId,defeatedMaxHp){
    if(!Number.isInteger(defeatedMaxHp)||defeatedMaxHp<0||defeatedMaxHp>0xffffffff)throw new RangeError('Invalid original battle accumulator');
    const next=ledger.slice();addLedger(next,companyId,0,defeatedMaxHp);
    return {cash:(cash+defeatedMaxHp)>>>0,ledger:next,reward:defeatedMaxHp};
  }
  return Object.freeze({random32768,decodeEncounter,leaderStatus,addLedger,settleVictory,
    source:{mainSha256:'08ed144e8f8d6e97d19f0759bce2420665998143f2f0f056ab7adc718e550e3e',ledger:'198A:0187',leader:'0E5F:06AD',victory:'FBOV BC8:2210..2231'}});
});
