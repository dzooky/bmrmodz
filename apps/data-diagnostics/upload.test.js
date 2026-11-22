'use strict';
const assert=require('assert'),EventEmitter=require('events');
const {upload,HOST,ENDPOINT}=require('./upload');
const result={schema:1,application:'bmrmodz-data-diagnostics',startedAt:'2026-11-22T22:00:00Z',
 finishedAt:'2026-11-22T22:01:00Z',results:[{id:'dde',label:'DDE / DPF',status:'PASS',durationMs:12,detail:'Matching UDS response received'}],
 totals:{pass:1,fail:0,skip:0},deviceVerified:false,vin:'SHOULD_NEVER_LEAVE_MGU'};
const reportId='0123456789abcdef01234567';
let calls=0,body='';
const fake={
 request(options,callback){
  calls++;
  assert.strictEqual(options.hostname,HOST);
  assert.strictEqual(options.path,ENDPOINT);
  assert.strictEqual(options.method,'POST');
  assert.strictEqual(options.headers['X-BMRMODZ-Token'],'x'.repeat(40));
  const req=new EventEmitter();
  req.end=content=>{
   body=content;
   const res=new EventEmitter();res.statusCode=201;res.setEncoding=()=>{};
   process.nextTick(()=>{
    callback(res);res.emit('data',JSON.stringify({ok:true,id:reportId}));res.emit('end');
   });
  };
  req.destroy=error=>req.emit('error',error);
  return req;
 }
};
async function main(){
 const answer=await upload(result,'/unused',{token:'x'.repeat(40),https:fake});
 assert.strictEqual(answer.id,reportId);
 assert.strictEqual(calls,1);
 assert.strictEqual(body.includes('SHOULD_NEVER_LEAVE_MGU'),false);
 assert.strictEqual(JSON.parse(body).results[0].id,'dde');
 await assert.rejects(upload({},'/unused',{token:'x'.repeat(40),https:fake}),/Invalid diagnostic report/);
 assert.strictEqual(calls,1);
 console.log('Data Diagnostics: HTTPS destination, manual token and allowlisted JSON passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
