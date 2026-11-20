'use strict';
const fs=require('fs'),path=require('path');
const {readVehicleOrder}=require('./vehicle-order');
const ALIASES=Object.freeze({hud:'610',head_up_display:'610',cluster_6wb:'6WB',digital_cluster:'6WB',live_cockpit_professional:'6U3'});
function normalize(x) { if(typeof x!=='string')return null; const s=x.trim().toLowerCase();const code=ALIASES[s]||s.toUpperCase();return /^[0-9A-Z]{3}$/.test(code)?code:null; }
function status(code,codes) { return !codes?'unknown':codes.has(code); }
const DEFAULT_CACHE='/var/lib/bmrmodz-car-equipment/vehicle-order.json';
function validCode(code){return typeof code==='string'&&/^[0-9A-Z]{3}$/.test(code);}
class Equipment {
  constructor(link,options) {
    this.link=link;this.codes=null;this.error='Not loaded';this.updatedAt=null;this.pending=null;this.attemptedAt=0;
    this.cacheFile=options&&options.cacheFile===null?null:(options&&options.cacheFile||DEFAULT_CACHE);
    this.cached=false;
    this.loadCache();
  }
  loadCache(){
    if(!this.cacheFile)return false;
    try{
      const saved=JSON.parse(fs.readFileSync(this.cacheFile,'utf8'));
      if(saved.schema!==1||!Array.isArray(saved.codes)||saved.codes.length===0||saved.codes.length>512||
         saved.codes.some(code=>!validCode(code))||new Set(saved.codes).size!==saved.codes.length||
         typeof saved.updatedAt!=='string'||!Number.isFinite(Date.parse(saved.updatedAt))||
         Date.parse(saved.updatedAt)>Date.now()+60000)throw new Error('Invalid cached vehicle order');
      this.codes=new Set(saved.codes);this.updatedAt=saved.updatedAt;this.cached=true;this.error=null;
      return true;
    }catch(e){
      this.codes=null;this.updatedAt=null;this.cached=false;
      if(e.code!=='ENOENT')this.error='Cache ignored: '+String(e.message||e);
      return false;
    }
  }
  saveCache(){
    if(!this.cacheFile||!this.codes)return;
    const folder=path.dirname(this.cacheFile),tmp=this.cacheFile+'.'+process.pid+'.tmp';
    try{
      fs.mkdirSync(folder,{recursive:true,mode:0o700});
      fs.writeFileSync(tmp,JSON.stringify({schema:1,codes:Array.from(this.codes).sort(),updatedAt:this.updatedAt})+'\n',{mode:0o600});
      fs.renameSync(tmp,this.cacheFile);
    }catch(e){
      try{fs.unlinkSync(tmp);}catch(ignore){}
      this.error='Equipment detected, cache save failed: '+String(e.message||e);
    }
  }
  async refresh(){
    if(this.pending)return this.pending;
    this.attemptedAt=Date.now();
    this.pending=(async()=>{try{
      const result=await readVehicleOrder(this.link);
      if(result.codes){
        this.codes=result.codes;this.error=null;this.updatedAt=new Date().toISOString();this.cached=false;
        this.saveCache();
      }else{
        // On transient failures keep the last known VO instead of hammering ECUs.
        // Clients are told if the data is cached, never silently label it live.
        this.error=result.error||'Vehicle order unavailable';
      }
    }catch(e){this.error=String(e&&e.message||e);}
    return this.summary();})().then(value=>{this.pending=null;return value;},error=>{this.pending=null;throw error;});
    return this.pending;
  }
  summary(){return {available:!!this.codes,cached:this.cached,source:'vehicle_order',updatedAt:this.updatedAt,error:this.error};}
  check(requested){
    if(!Array.isArray(requested)||requested.length>128)return {ok:false,error:'Expected array of at most 128 equipment codes'};
    const result={};for(const item of requested){const code=normalize(item);if(!code)return {ok:false,error:'Invalid equipment code: '+String(item)};
      result[item]=status(code,this.codes);}
    return {ok:true,results:result,cached:this.cached,source:'vehicle_order',updatedAt:this.updatedAt,error:this.error};
  }
}
module.exports={Equipment,normalize,status,DEFAULT_CACHE};
