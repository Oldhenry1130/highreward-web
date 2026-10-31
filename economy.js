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
  const REWARD_WORDS=/(?:酬勞|酬金|報酬|報償|獎金|賞金|收入|收益|謝禮)/;
  function dialogueContext(story){
    if(typeof story?.rewardContext==='boolean')return story.rewardContext;
    // Older saves may be paused on the amount-only page of a reward dialogue.
    if(story?.event?.type!=='text')return false;
    return (story.history||[]).slice(-3).some(h=>h.speaker===(story.speaker||'')&&REWARD_WORDS.test(h.text));
  }
  function dialogueText(value,rewardContext=false){
    const text=String(value??'');
    // Source dialogue often puts the reward label and the amount on separate
    // lines or separate dialogue pages. Keep that context within this dialogue.
    if(!(rewardContext||REWARD_WORDS.test(text)))return rewardText(text);
    return text.split('\n').map(line=>/(?:購買|售價|費用|花費|支出|工資|薪資|還款|付款|支付|欠款|負債)/.test(line)?rewardText(line):line.replace(/(?<![\d-])(\d[\d,]*)\s*([ＧG])/g,(_,n,u)=>amount(Number(n.replaceAll(',',''))).toLocaleString('en-US')+u)).join('\n');
  }
  function incomeReceipt(before,after,serial){
    const incomeCategories=[0,1,2,3,6,7,8];let gross=0;
    for(let p=0;p<6;p++)for(const c of incomeCategories){const i=p*16+c,delta=((after.ledger?.[i]||0)-(before.ledger?.[i]||0))|0;if(delta>0)gross+=delta;}
    const credited=after.money-before.money;
    return gross>0&&credited>0?{serial,multiplier:MULTIPLIER,gross,credited,before:before.money,after:after.money}:null;
  }
  return Object.freeze({MULTIPLIER,CASH_LIMIT,configure,amount,rewardText,dialogueText,dialogueContext,incomeReceipt,isRewardText:text=>REWARD_WORDS.test(String(text??''))});
});
