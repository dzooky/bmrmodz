'use strict';
// Same FA decoder and validation as BMRMODZ apps/climate-comfort/vehicle-order.js.
// Source of truth: Climate Comfort; do not silently substitute a different FA format.
const GATEWAY=0x10, VEHICLE_ORDER_DID=0x3F06;
function bits(bytes, offset, count) { let value=0; for(let bit=offset;bit<offset+count;bit++) value=(value<<1)|((bytes[bit>>3]>>(7-(bit&7)))&1); return value; }
function characters(bytes,offset,count) { let value=''; for(let i=0;i<count;i++) value+=String.fromCharCode(0x20+bits(bytes,offset+i*6,6)); return value; }
function decodeVehicleOrder(reply) {
  if(!reply||reply.length<5||reply[0]!==0x62||reply[1]!==0x3F||reply[2]!==0x06) return null;
  const length=(reply[3]<<8)|reply[4]; if(length<18||length>reply.length-5)return null;
  const fa=reply.slice(5,5+length), date=characters(fa,8,4),series=characters(fa,32,4);
  if(!/^(0[1-9]|1[0-2])[0-9]{2}$/.test(date)||!/^[A-Z][0-9]{3}$/.test(series)||bits(fa,128,4)!==8)return null;
  const codes=new Set(),limit=fa.length*8;
  for(let offset=132;offset+2<=limit;offset+=18) {
    if(bits(fa,offset,2)===0)return codes.size?codes:null;
    if(offset+18>limit)return null;
    const code=characters(fa,offset,3);
    if(!/^[0-9A-Z]{3}$/.test(code))return null;
    codes.add(code);
  }
  return null;
}
async function readVehicleOrder(link) {
  if(!link.ready)await link.init();
  if(!link.ready)return {error:'Vehicle order: diagnostics unavailable'};
  const reply=await link.read(GATEWAY,VEHICLE_ORDER_DID,3000);
  if(!reply)return {error:'Vehicle order: gateway did not respond'};
  if(reply[0]===0x7F&&reply.length>=3)return {error:'Vehicle order: gateway NRC '+reply[2].toString(16).toUpperCase().padStart(2,'0')};
  const codes=decodeVehicleOrder(reply);
  return codes?{codes}:{error:'Vehicle order: unsupported reply ('+reply.length+' bytes)'};
}
module.exports={GATEWAY,VEHICLE_ORDER_DID,decodeVehicleOrder,readVehicleOrder};
