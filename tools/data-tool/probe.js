'use strict';
// Manual on-car probe; no repeating reads or actuator commands.
const net=require('net');
const socket=process.env.BMRMODZ_DATA_SOCKET||'/run/bmrmodz-data-tool/ctl.sock';
const arg=process.argv.slice(2),op=arg[0]||'status';
function numeric(value){if(!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value||''))throw new Error('Expected decimal or 0x-prefixed integer');return Number(value);}
let request;
if(op==='status'||op==='capabilities'||op==='signalEnvironment')request={op};
else if(op==='read'&&arg.length===3)request={op,ecu:numeric(arg[1]),did:numeric(arg[2])};
else throw new Error('Usage: node probe.js status | capabilities | signalEnvironment | read 0x12 0x44BB');
const client=net.createConnection(socket);let buffer='';
client.setTimeout(12000,()=>client.destroy(new Error('Service timeout')));
client.on('connect',()=>client.write(JSON.stringify(request)+'\n'));
client.on('data',part=>{
 buffer+=part.toString('utf8');
 if(buffer.length>65536){client.destroy(new Error('Reply too large'));return;}
 if(buffer.indexOf('\n')>=0){console.log(JSON.stringify(JSON.parse(buffer.split('\n')[0]),null,2));client.end();}
});
client.on('error',error=>{console.error(error.message);process.exitCode=1;});
