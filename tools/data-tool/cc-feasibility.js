'use strict';
// Static CC feasibility contract. Never transmits UDS commands.
// Only the explicitly enumerated actuator operations can be proposed for
// a future, separate parked-car test harness with physical confirmation.
const OPERATIONS=Object.freeze({
  frontLeftBelt: {kind:'routine-as-sensor',ecu:0x01,sid:0x31,data:[0x01,0xA0,0xD2,0x01],echo:[0x71,0x01,0xA0,0xD2],risk:'read-like routine; requires vehicle validation'},
  frontRightBelt:{kind:'routine-as-sensor',ecu:0x01,sid:0x31,data:[0x01,0xA0,0xD2,0x02],echo:[0x71,0x01,0xA0,0xD2],risk:'read-like routine; requires vehicle validation'},
  seatPress: {kind:'actuation',ecu:0x78,sid:0x31,template:[0x01,0xA1,0x26,'seatButton','pressed'],echo:[0x71,0x01,0xA1,0x26],risk:'button press MUST have release even on failure'},
  seatStop:{kind:'actuation',ecu:0x78,sid:0x31,data:[0x02,0xA1,0x26],echo:[0x71,0x02,0xA1,0x26],risk:'release/cleanup after actuation'},
  wheelHeat:{kind:'actuation',ecu:0x40,sid:0x2e,template:[0xD0,0x74,'seconds'],echo:[0x6e,0xD0,0x74],risk:'changes heated steering state; confirm via 22 D074'}
});
const SEAT_BUTTONS=Object.freeze({
  frontLeft:{Heating:0x1b,Ventilation:0x1d},
  frontRight:{Heating:0x1c,Ventilation:0x1e},
  rearLeft:{Heating:0x22,Ventilation:0x24},
  rearRight:{Heating:0x23,Ventilation:0x25}
});
const COVERAGE=[
  {app:'CC',name:'IHKA temperature',type:'read',ecu:0x78,sid:0x22,data:[0xD8,0xD7]},
  {app:'CC',name:'IHKA seat levels',type:'read',ecu:0x78,sid:0x22,data:[0xD8,0xDB]},
  {app:'CC',name:'ACSM rear belt',type:'read',ecu:0x01,sid:0x22,data:[0x40,0x53]},
  {app:'CC',name:'ACSM front belt left',type:'routine-as-sensor',operation:'frontLeftBelt'},
  {app:'CC',name:'ACSM front belt right',type:'routine-as-sensor',operation:'frontRightBelt'},
  {app:'CC',name:'IHKA seat press/release/stop',type:'actuation',operation:'seatPress',dependsOn:['seatStop','frontLeftBelt','frontRightBelt']},
  {app:'CC',name:'BDC wheel heating read',type:'read',ecu:0x40,sid:0x22,data:[0xD0,0x74]},
  {app:'CC',name:'BDC wheel heating change',type:'actuation',operation:'wheelHeat',dependsOn:['frontLeftBelt']}
];
function plan(){
  return {ok:true,mode:'static-only',controlsEnabled:false,operations:OPERATIONS,seatButtons:SEAT_BUTTONS,
    coverage:COVERAGE,requirements:[
      'No service-side execution of UDS 0x31 or 0x2E exists in this build',
      'An explicit operator-approved parked-car test with working safety conditions is required',
      'Verify TASU response echo and actual ECU state after any authorized command',
      'IHKA press must always be followed by release and stop, including on failure',
      'Verify seat-belt gating and temporary wheel heating timeout on vehicle',
      'No commands should be issued when car motion/safety state is unknown'
    ]};
}
function echoMatches(name,uds){
 const op=OPERATIONS[name];
 if(!op||!Array.isArray(uds))return false;
 return op.echo.every((v,i)=>uds[i]===v);
}
module.exports={plan,echoMatches,OPERATIONS,SEAT_BUTTONS};
