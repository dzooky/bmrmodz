'use strict';
// Inspect a dedicated, tool-owned CDS interface configuration. No copying app
// private configs, no ACL bypass, no native module load and no ECU traffic.
const fs=require('fs');
const path=require('path');
const NAME='de.bmw.infotainment.vehicle.CDS';
const DEFAULT='/var/opt/bmrmodz-data-tool/config/de_bmw_infotainment_vehicle_CDS.json';
function inspect(configPath,io){
  const sys=io||fs;
  const filename=configPath||process.env.BMRMODZ_CDS_CONFIG||DEFAULT;
  let cfg;
  try {
    const stat=sys.statSync(filename);
    if(!stat.isFile()||stat.size>1024*1024)throw new Error('Invalid file or size');
    cfg=JSON.parse(sys.readFileSync(filename,'utf8'));
    if(!cfg||typeof cfg!=='object'||!cfg.fields)throw new Error('Not a generated interface configuration');
    const fields=['statusEngineTemperature','statusEngineSpeed2'].map(field=>({field,available:!!cfg.fields[field]}));
    return {ok:fields.every(x=>x.available),exists:true,fields,path:filename,
      note:'Configuration presence does not prove SOME/IP permission or service access'};
  }catch(e){return {ok:false,exists:false,error:String(e.message||e),path:filename};}
}
module.exports={inspect,DEFAULT,NAME};
