'use strict';
// Passive JSON report. Deliberately no UDS read or native worker invocation.
const os=require('os');
const signalEnvironment=require('./signal-environment');
const configCheck=require('./config-check');
function create(status,options){
  const env=(options&&options.environment)||signalEnvironment.inspect();
  const cfg=(options&&options.config)||configCheck.inspect();
  const capabilities=(status&&status.capabilities)||null;
  return {
    reportVersion:1,
    generatedAt:new Date().toISOString(),
    source:'data-tool-passive-report',
    platform:{node:process.version,arch:process.arch,platform:process.platform},
    service:{version:status&&status.version||'unknown',transportReady:!!(status&&status.transportReady),
      stats:status&&status.stats||{},capabilities},
    checks:{
      catalog:!!env.catalog.present,
      moduleResolved:!!env.nativeModule.resolved,
      cdsConfigPresent:!!cfg.exists,
      cdsConfigFieldsValid:!!cfg.ok,
      nativeProxyVerified:false,
      nativeSubscriptionVerified:false,
      udsVehicleVerified:false,
      ccControlVerified:false
    },
    someip:{environment:env,config:cfg},
    limitations:[
      'Passive report only: no ECU read or native module loading',
      'Vehicle signal reception and permissions are not verified',
      'A successful CI test is not an in-car test'
    ]
  };
}
module.exports={create};
