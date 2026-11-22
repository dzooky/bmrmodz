'use strict';
// Shared BMRMODZ client: apps pass text/colours; only the tool owns the KOMBI layer.
const net=require('net');
const {Canvas}=require('./canvas');
const SOCKET='/run/bmrmodz-notification/ctl.sock';
const WIDTH=430,HEIGHT=76;
function request(payload,options){
  options=options||{};
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(options.socket||SOCKET);let data='',done=false;
    function finish(err,value){if(done)return;done=true;socket.destroy();if(err)reject(err);else resolve(value);}
    socket.setTimeout(options.timeout||4000);
    socket.once('connect',()=>socket.write(JSON.stringify(payload)+'\n'));
    socket.on('data',chunk=>{
      data+=chunk.toString('utf8');
      if(data.length>8192)return finish(new Error('Oversized reply'));
      const n=data.indexOf('\n');if(n>=0){
        try{finish(null,JSON.parse(data.slice(0,n)));}catch(err){finish(err);}
      }
    });
    socket.once('error',err=>finish(err));
    socket.once('timeout',()=>finish(new Error('Notification tool timeout')));
    socket.once('end',()=>finish(new Error('Notification tool closed without reply')));
  });
}
function render(segments){
  if(!Array.isArray(segments)||segments.length<1||segments.length>8)throw new Error('Invalid segments');
  const values=segments.map(s=>{
    if(!s||typeof s.text!=='string'||typeof s.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(s.color))
      throw new Error('Invalid segment');
    return {text:s.text,color:s.color};
  });
  const chars=values.map(s=>Array.from(s.text).length).reduce((a,b)=>a+b,0);
  if(chars<1||chars>90)throw new Error('Message must be 1-90 characters');
  const cv=new Canvas(WIDTH,HEIGHT),style={font:'bold',literal:true};
  let font=28;
  function measure(){return values.map(s=>cv.textWidth(s.text,font,style)).reduce((a,b)=>a+b,0);}
  while(font>15&&measure()>WIDTH-16)font--;
  const total=measure();if(total>WIDTH-16)throw new Error('Notification too wide');
  let x=Math.round((WIDTH-total)/2);
  values.forEach(s=>{
    cv.text(s.text,x+1,49,font,[0,0,0,190],style);
    cv.text(s.text,x,47,font,s.color,style);
    x+=cv.textWidth(s.text,font,style);
  });
  return Buffer.from(cv.d).toString('base64');
}
function show(app,segments,options){
  options=options||{};
  const rgba=render(segments);
  const durationMs=options.durationMs===undefined?3000:options.durationMs;
  const blinkMs=options.blinkMs===undefined?0:options.blinkMs;
  const repeat=options.repeat===undefined?1:options.repeat;
  const repeatIntervalMs=options.repeatIntervalMs===undefined?0:options.repeatIntervalMs;
  return request({op:'show',app,target:'kombi',durationMs,blinkMs,repeat,repeatIntervalMs,rgba},options);
}
module.exports={show,request,render,SOCKET};
