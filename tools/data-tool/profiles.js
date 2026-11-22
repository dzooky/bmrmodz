'use strict';
// Feasibility read allowlist taken from currently used BMRMODZ diagnostic paths.
// No arbitrary request, writes, routine controls, functional scans or ECU discovery.
const READS = Object.freeze({
  dde: { ecu: 0x12, dids: [0xF150,0x44BE,0x44BD,0x44BF,0x4B2F,0x44BB,0x467E,0x44EB,0x44EF,0x44B7,0x44C2,0x4B4A,0x4C78,0x44C7] },
  egs: { ecu: 0x18, dids: [0xF150,0x6000] },
  ihka: { ecu: 0x78, dids: [0xD8D7,0xD8DB] },
  bdc: { ecu: 0x40, dids: [0xD074] },
  acsm: { ecu: 0x01, dids: [0x4053] },
  gateway: { ecu: 0x10, dids: [0x3F06] }
});
function getRead(ecu,did) {
  if (!Number.isInteger(ecu) || !Number.isInteger(did)) return null;
  return Object.keys(READS).find(k=>READS[k].ecu===ecu && READS[k].dids.indexOf(did)!==-1) || null;
}
module.exports={READS,getRead};
