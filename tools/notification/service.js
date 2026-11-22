'use strict';
// Single central KOMBI layer; does not guarantee restoration of factory BC slots.
const net=require('net'),fs=require('fs'),path=require('path');
const SOCKET=process.env.BMRMODZ_NOTIFICATION_SOCKET||'/run/bmrmodz-notification/ctl.sock';
const RENDERER=process.env.BMRMODZ_CLUSTER_RENDER_SOCKET||'/dev/shm/cluster-render/render.sock';
const WIDTH=430,HEIGHT=76,MAX_REQUEST=256*1024;
function packet(type,body){
  const header=Buffer.alloc(5);header.writeUInt32LE(body.length+1,0);header[4]=type;
  return Buffer.concat([header,body]);
}
function command(value){return packet(0x4a,Buffer.from(JSON.stringify(value)));}
function frame(pixels,id){
  const body=Buffer.alloc(14+pixels.length);body.writeUInt32LE(1,0);body.writeUInt32LE(id,4);
  pixels.copy(body,14);return packet(0x46,body);
}
function valid(req){
  if(!req||req.op!=='show'||req.target!=='kombi')return 'Unsupported target or operation';
  if(typeof req.app!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(req.app))return 'Invalid app';
  if(!Number.isInteger(req.durationMs)||req.durationMs<500||req.durationMs>15000)return 'Invalid duration';
  if(!Number.isInteger(req.blinkMs)||req.blinkMs<0||req.blinkMs>3000)return 'Invalid blink interval';
  if(!Number.isInteger(req.repeat)||req.repeat<1||req.repeat>10)return 'Invalid repeat count';
  if(!Number.isInteger(req.repeatIntervalMs)||req.repeatIntervalMs<0||req.repeatIntervalMs>60000)return 'Invalid repeat interval';
  if(req.durationMs*req.repeat+req.repeatIntervalMs*(req.repeat-1)>120000)return 'Notification too long';
  if(typeof req.rgba!=='string'||req.rgba.length!==Math.ceil(WIDTH*HEIGHT*4/3)*4)return 'Invalid frame size';
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(req.rgba))return 'Invalid frame encoding';
  return null;
}
function serve(options){
  options=options||{};
  const target=options.socket||SOCKET,renderer=options.renderer||RENDERER;
  let active=null,closing=false;
  function release(){
    const current=active;active=null;if(!current)return;
    current.timers.forEach(clearTimeout);
    if(!current.socket.destroyed){
      try{current.socket.write(command({op:'drop',ref:1}));current.socket.end();}
      catch(err){current.socket.destroy();}
      const forced=setTimeout(()=>current.socket.destroy(),1000);forced.unref();
      current.socket.once('close',()=>clearTimeout(forced));
    }
  }
  function show(req,reply){
    if(active)return reply({ok:false,error:'busy'});
    const error=valid(req);if(error)return reply({ok:false,error});
    const pixels=Buffer.from(req.rgba,'base64');
    if(pixels.length!==WIDTH*HEIGHT*4)return reply({ok:false,error:'Invalid decoded frame'});
    const socket=net.createConnection(renderer),session={socket,timers:[],replied:false,frame:0};
    active=session;
    function respond(value){if(!session.replied){session.replied=true;reply(value);}}
    function after(ms,fn){const timer=setTimeout(fn,ms);timer.unref();session.timers.push(timer);}
    function draw(data){
      if(active!==session||socket.destroyed)return;
      session.frame=(session.frame+1)>>>0;socket.write(frame(data,session.frame));
    }
    const deadline=setTimeout(()=>{
      respond({ok:false,error:'Renderer timeout'});if(active===session)release();
    },3000);
    deadline.unref();session.timers.push(deadline);
    socket.once('connect',()=>{
      clearTimeout(deadline);if(active!==session)return socket.destroy();
      socket.write(command({op:'hello',app:'bmrmodz-notification',proto:1}));
      socket.write(command({op:'layer',ref:1,kind:'image',target:'panel',class:'overlay',
        x:745,y:539,w:WIDTH,h:HEIGHT,iw:WIDTH,ih:HEIGHT,exclusive:0,contend:0}));
      const transparent=Buffer.alloc(pixels.length);
      for(let i=0;i<req.repeat;i++){
        const start=i*(req.durationMs+req.repeatIntervalMs);
        after(start,()=>draw(pixels));
        if(req.blinkMs){
          for(let offset=req.blinkMs;offset<req.durationMs;offset+=req.blinkMs)
            after(start+offset,((on)=>()=>draw(on?pixels:transparent))(Math.floor(offset/req.blinkMs)%2===0));
        }
        if(i+1<req.repeat)after(start+req.durationMs,()=>draw(transparent));
      }
      const total=req.repeat*req.durationMs+(req.repeat-1)*req.repeatIntervalMs;
      after(total,()=>{if(active===session)release();});
      respond({ok:true,status:'sent_to_renderer',target:'kombi'});
    });
    socket.on('data',()=>{});
    socket.once('error',err=>{
      respond({ok:false,error:'Renderer unavailable: '+(err.code||err.message)});
      if(active===session)release();
    });
    socket.once('close',()=>{
      if(active===session){respond({ok:false,error:'Renderer disconnected'});release();}
    });
  }
  try{fs.mkdirSync(path.dirname(target));}catch(err){if(err.code!=='EEXIST')throw err;}
  try{fs.unlinkSync(target);}catch(err){if(err.code!=='ENOENT')throw err;}
  const server=net.createServer(client=>{
    client.setEncoding('utf8');let buffer='',processed=false;
    client.on('data',chunk=>{
      if(processed)return;buffer+=chunk;
      if(buffer.length>MAX_REQUEST){processed=true;client.end(JSON.stringify({ok:false,error:'Request too large'})+'\n');return;}
      const n=buffer.indexOf('\n');if(n<0)return;processed=true;let req;
      try{req=JSON.parse(buffer.slice(0,n));}
      catch(err){client.end(JSON.stringify({ok:false,error:'Invalid JSON'})+'\n');return;}
      const reply=value=>{if(!client.destroyed)client.end(JSON.stringify(value)+'\n');};
      if(req&&req.op==='status')return reply({ok:true,active:!!active,target:'kombi',hudSupported:false});
      show(req,reply);
    });
    client.on('error',()=>{});
  });
  server.listen(target,()=>fs.chmodSync(target,0o666));
  function close(){
    if(closing)return;closing=true;release();server.close();
    try{fs.unlinkSync(target);}catch(err){if(err.code!=='ENOENT')throw err;}
  }
  if(options.signals!==false){process.on('SIGINT',close);process.on('SIGTERM',close);}
  return {server,close};
}
if(require.main===module)serve();
module.exports={serve,valid,WIDTH,HEIGHT};
