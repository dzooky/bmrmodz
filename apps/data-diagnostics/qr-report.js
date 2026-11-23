'use strict';
// Compact offline QR export: no network request or sensitive raw vehicle data.
const makeQr=require('./qrcode');
function payload(report){
  if(!report||report.schema!==1||!Array.isArray(report.results))throw Error('Invalid report');
  const summary=report.results.map(row=>{
    const name=String(row.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,22);
    const status=['PASS','FAIL','SKIP'].includes(row.status)?row.status:'SKIP';
    const reason=status==='FAIL'?':'+String(row.detail||'').replace(/[\r\n|]/g,' ').slice(0,42):'';
    return name+':'+status+reason;
  }).join('|');
  return 'BMRMODZ-DATA/1;'+String(report.finishedAt||'').slice(0,24)+';'+summary;
}
function create(report){
  const text=payload(report);
  if(text.length>1600)throw Error('QR report too large');
  const qr=makeQr(0,'M');qr.addData(text);qr.make();return qr;
}
module.exports={payload,create};
