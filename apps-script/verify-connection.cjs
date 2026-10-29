const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const endpoint = process.argv[2];
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) throw new Error('Provide the Apps Script /exec URL.');
  const config = fs.readFileSync(path.join(__dirname,'.env'),'utf8');
  const key = config.match(/^APPS_SCRIPT_SECRET=(.+)$/m)?.[1]?.trim();
  if (!key) throw new Error('Local apps-script/.env connection key is missing.');
  async function call(action,payload) {
    const response = await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload,key}),signal:AbortSignal.timeout(50000)});
    if (!response.ok) throw new Error(`Apps Script returned HTTP ${response.status}. Check anonymous deployment access.`);
    let result;try { result=await response.json(); } catch {throw new Error('Apps Script returned HTML instead of JSON. Check the deployment version and access.');}
    if (!result.ok) throw new Error(result.error||'Apps Script request failed.');
    return result.data;
  }
  const album = await call('list',{});
  console.log(`PASS: authenticated album listing; ${album.photos.length} photos returned${album.nextCursor?' (more pages available)':''}.`);
  if(album.photos.length){const preview=await call('preview',{id:album.photos[0].id,large:false});if(typeof preview!=='string'||!preview.startsWith('data:image/'))throw new Error('Photo preview is not image data.');console.log('PASS: private photo preview returned through Apps Script.');}
  console.log('Read-only test completed. No photos or sharing permissions were changed.');
}
main().catch(error=>{console.error('Connection check: '+error.message);process.exitCode=1;});
