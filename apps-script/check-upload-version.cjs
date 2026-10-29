const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const key = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^APPS_SCRIPT_SECRET=(.+)$/m)?.[1]?.trim();
  if (!key) throw new Error('Local connection key is missing.');
  for (const [name,url,body] of [
    ['Apps Script',process.argv[2],{key,action:'begin',payload:{}}],
    ['Vercel',new URL('/api/photos',process.argv[3]).href,{action:'begin',payload:{}}],
  ]) {
    // Missing uploadId deliberately stops validation before any files/session are created.
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
    const text=await response.text();
    let result;
    try {result=JSON.parse(text);} catch {console.log(name+': HTTP '+response.status+'; '+text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,220));continue;}
    console.log(name+': HTTP '+response.status+'; '+(result.error||'Unexpected response'));
  }
  console.log('Read-only version probe completed; no upload ID or photo data was supplied.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
