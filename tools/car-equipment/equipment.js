'use strict';
const {readVehicleOrder}=require('./vehicle-order');
const ALIASES=Object.freeze({hud:'610',head_up_display:'610',cluster_6wb:'6WB',digital_cluster:'6WB',live_cockpit_professional:'6U3'});
function normalize(x) { if(typeof x!=='string')return null; const s=x.trim().toLowerCase();const code=ALIASES[s]||s.toUpperCase();return /^[0-9A-Z]{3}$/.test(code)?code:null; }
function status(code,codes) { return !codes?'unknown':codes.has(code); }
class Equipment {
  constructor(link) {this.link=link;this.codes=null;this.error='Not loaded';this.updatedAt=null;this.pending=null;this.attemptedAt=0;}
  async refresh() {
    if(this.pending)return this.pending;
    this.attemptedAt=Date.now();
    this.pending=(async()=>{try{
      const result=await readVehicleOrder(this.link);
      if(result.codes){this.codes=result.codes;this.error=null;this.updatedAt=new Date().toISOString();}
      else {this.codes=null;this.error=result.error;this.updatedAt=null;}
    }catch(e){this.codes=null;this.error=String(e&&e.message||e);this.updatedAt=null;}
    return this.summary();})().then(value=>{this.pending=null;return value;},error=>{this.pending=null;throw error;});
    return this.pending;
  }
  summary(){return {available:!!this.codes,source:'vehicle_order',updatedAt:this.updatedAt,error:this.error};}
  check(requested){
    if(!Array.isArray(requested)||requested.length>128)return {ok:false,error:'Expected array of at most 128 equipment codes'};
    const result={};for(const item of requested){const code=normalize(item);if(!code)return {ok:false,error:'Invalid equipment code: '+String(item)};
      result[item]=status(code,this.codes);}
    return {ok:true,results:result,source:'vehicle_order',updatedAt:this.updatedAt,error:this.error};
  }
}
module.exports={Equipment,normalize,status};
