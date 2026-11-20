'use strict';
// Transport adapter: the same read-only gateway read used by Climate Comfort.
// Supports an optional locally installed adapter configured by CAR_EQUIPMENT_ADAPTER.
// The adapter module must export createLink(), returning {ready,init(),read(target,did,timeoutMs)}.
// No external diagnostic access is attempted if the adapter is not configured.
function createLink(){
 const modulePath=process.env.CAR_EQUIPMENT_ADAPTER;
 if(!modulePath)throw new Error('CAR_EQUIPMENT_ADAPTER not configured; MGU-compatible diagnostic adapter still required');
 const adapter=require(modulePath);
 if(typeof adapter.createLink!=='function')throw new Error('Adapter must export createLink()');
 const link=adapter.createLink();
 if(!link||typeof link.init!=='function'||typeof link.read!=='function')throw new Error('Invalid diagnostic link');
 return {get ready(){return link.ready;},init:()=>link.init(),read:(target,did,ms)=>{
   if(target!==0x10||did!==0x3F06)throw new Error('Car Equipment permits only gateway VO read');
   return link.read(target,did,ms);
 }};
}
module.exports={createLink};
