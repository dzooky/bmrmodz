'use strict';
// Passive, read-only capability survey. NEVER require/load the native module here:
// a broken or incompatible binding must not crash the long-running data service.
const fs=require('fs'),path=require('path'),Module=require('module');
const CATALOG='/etc/oap/someip/someip-interfaces.json';
const NODE_CANDIDATES=[
  '/usr/lib/node_modules',
  '/usr/local/lib/node_modules',
  '/usr/lib/oap/node_modules',
  '/usr/lib/oap-mainapp/node_modules'
];
const SIGNALS=Object.freeze({
  'de.bmw.infotainment.vehicle.CDS':['statusEngineTemperature','statusEngineSpeed2'],
  'de.bmw.infrastructure.EnvironmentalInformation':['ExteriorTemperature'],
  'de.bmw.infotainment.vehicle.Vehicle2':['statusCarSpeed2'],
  'de.bmw.infotainment.KombiIF':['statusRangeTankStatus','statusBordcomputerTravelData','statusBordcomputerAverage'],
  'de.bmw.infotainment.navigation.guiding.Guidance':['currentRoad']
});
function safeExists(f,io){try{return io.statSync(f).isFile();}catch(_){return false;}}
function hasConfig(catalog,iface,field){
  const match=catalog&&catalog.interfaces&&catalog.interfaces[iface];
  return !!(match&&match.fields&&match.fields[field]);
}
function inspect(options){
  const opts=options||{},io=opts.fs||fs;
  const catalogPath=opts.catalogPath||CATALOG;
  const roots=opts.moduleRoots||NODE_CANDIDATES;
  let parsed=null,catalogError=null;
  try{
    if(!safeExists(catalogPath,io))throw new Error('catalog not present');
    const size=io.statSync(catalogPath).size;
    if(size>20*1024*1024)throw new Error('catalog too large');
    parsed=JSON.parse(io.readFileSync(catalogPath,'utf8'));
  }catch(e){catalogError=String(e.message||e);}
  let moduleResolved=null,moduleError=null;
  if(opts.resolveModule){
    try{moduleResolved=opts.resolveModule('someip');}catch(e){moduleError=String(e.message||e);}
  }else{
    // Only resolve the module path: do not execute native code.
    try{moduleResolved=require.resolve('someip',{paths:roots});}
    catch(e){moduleError='someip not resolved in known tool paths';}
  }
  const interfaces=Object.keys(SIGNALS).map(name=>({
    interface:name,
    fields:SIGNALS[name].map(field=>({name:field,inCatalog:hasConfig(parsed,name,field)})),
    catalogInterfacePresent:!!(parsed&&parsed.interfaces&&parsed.interfaces[name])
  }));
  return {ok:true,mode:'passive-only',catalog:{present:!!parsed,error:catalogError,path:catalogPath},
    nativeModule:{resolved:!!moduleResolved,error:moduleError},
    interfaces:interfaces,
    limitations:[
      'Native binding was not loaded',
      'No proxy was created',
      'No SOME/IP subscription was attempted',
      'Service access and ACL authorization remain unverified'
    ]};
}
module.exports={inspect,SIGNALS,hasConfig};
