/* Web edition income policy. Source contract records retain their base values. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HREconomy=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MULTIPLIER=5,CASH_LIMIT=99999999;
  function configure(state){state.economy={version:1,incomeMultiplier:MULTIPLIER};return state;}
  function amount(base){return Number.isSafeInteger(base)&&base>=0?base*MULTIPLIER:base;}
  function rewardText(value,quote=false){const text=String(value??'');
    if(quote)return text.replace(/(\d+)(\s*)$/,(_,n,space)=>amount(Number(n)).toLocaleString('en-US')+' G'+space);
    return text.replace(/((?:酬勞|酬金|報酬|報償|獎金|賞金|收入|收益|謝禮|獲得)[^0-9\n。！？-]{0,12})(\d[\d,]*)\s*([ＧG])|(?<![\d-])(\d[\d,]*)\s*([ＧG])([^0-9\n。！？]{0,8}(?:酬勞|酬金|報酬|報償|獎金|賞金|收入|收益|謝禮))/g,
      (_,prefix,n,unit,postNumber,postUnit,suffix)=>prefix?prefix+amount(Number(n.replaceAll(',',''))).toLocaleString('en-US')+unit:amount(Number(postNumber.replaceAll(',',''))).toLocaleString('en-US')+postUnit+suffix);
  }
  return Object.freeze({MULTIPLIER,CASH_LIMIT,configure,amount,rewardText});
});
