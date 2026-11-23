'use strict';
// Experimental authorization boundary. Identity MUST originate from a trusted
// kernel-backed attestation adapter, never from client-provided JSON or UID alone.
// Disabled by default until such an adapter is proven on the actual MGU.
const READ_ONLY_OPS=new Set(['read','signalNative','signalEnvironment','configCheck','report','ccPlan']);
function authorize(request, identity, allowedApps){
  if(!request||!READ_ONLY_OPS.has(request.op))return {allowed:false,reason:'Operation not authorized'};
  if(!identity||identity.verified!==true||typeof identity.appId!=='string')return {allowed:false,reason:'Trusted application identity unavailable'};
  if(!Array.isArray(allowedApps)||!allowedApps.includes(identity.appId))return {allowed:false,reason:'Application not allowlisted'};
  return {allowed:true};
}
function mode(options){
  const enabled=!!(options&&options.authorizationEnabled);
  return {enforced:enabled,identityAdapterConfigured:!!(options&&typeof options.resolveTrustedIdentity==='function'),
    productionReady:false};
}
module.exports={authorize,mode};
