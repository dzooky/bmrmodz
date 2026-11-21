'use strict';
// Highest valid distance-from-last-regeneration observed by this installation.
// DDE supplies the live distance; only the historical maximum is stored here.
const fs=require('fs'),path=require('path');
function create(dataDir,log){
  const file=path.join(dataDir,'dpf-distance-record.json');
  let maxKm=0;
  try {
    const saved=JSON.parse(fs.readFileSync(file,'utf8'));
    if(saved&&saved.schema===1&&Number.isFinite(saved.maxKm)&&saved.maxKm>=0&&saved.maxKm<=100000)
      maxKm=saved.maxKm;
  } catch(e) { if(e.code!=='ENOENT'&&log)log.warn('DPF distance record load: '+e.message); }
  function observe(km){
    if(!Number.isFinite(km)||km<0||km>100000||km<=maxKm)return false;
    maxKm=km;
    const tmp=file+'.tmp';
    try{
      fs.writeFileSync(tmp,JSON.stringify({schema:1,maxKm})+'\n');
      fs.renameSync(tmp,file);
    }catch(e){
      if(log)log.warn('DPF distance record save: '+e.message);
      try{fs.unlinkSync(tmp);}catch(ignore){}
    }
    return true;
  }
  function scale(averageKm,currentKm){
    // Average is a useful starting reference, not a regeneration limit.
    // Keep 10% headroom and round upwards to a readable 50 km scale.
    const base=Math.max(100,maxKm,Number.isFinite(averageKm)?averageKm:0,
      Number.isFinite(currentKm)?currentKm:0);
    return Math.ceil(base*1.1/50)*50;
  }
  return {observe,scale,get maxKm(){return maxKm;}};
}
module.exports={create};
