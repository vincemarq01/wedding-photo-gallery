const { randomUUID, createHash } = require('node:crypto');
async function main() {
  const base = new URL(process.argv[2]);
  if (base.protocol !== 'https:') throw new Error('Use the HTTPS wedding website URL.');
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const uploadId = randomUUID();
  async function call(action,payload) {
    const response=await fetch(new URL('/api/photos',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(60000)});
    const text=await response.text();let result;try{result=JSON.parse(text);}catch{throw new Error(action+': HTTP '+response.status+'; non-JSON response');}
    if(!response.ok)throw new Error(action+': '+(result.error||'Request failed'));
    console.log('PASS: '+action);return result;
  }
  await call('begin',{uploadId,name:'original-upload-verification-'+Date.now()+'.png',size:bytes.length,sha256,guestName:'Upload verification'});
  await call('part',{uploadId,index:0,data:bytes.toString('base64')});
  const result=await call('finish',{uploadId});
  const original=await call('preview',{id:result.id,large:true});
  const actual=Buffer.from(original.split(',')[1],'base64');
  if(createHash('sha256').update(actual).digest('hex')!==sha256)throw new Error('Original file checksum changed.');
  console.log('PASS: actual saved PNG checksum matches the original. The tiny verification photo is retained in the wedding folder.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
