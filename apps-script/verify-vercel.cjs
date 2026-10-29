async function main() {
  const base = new URL(process.argv[2]);
  if (base.protocol !== 'https:') throw new Error('Use the public HTTPS Vercel URL.');
  async function call(action, payload) {
    const response = await fetch(new URL('/api/photos', base), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }), signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || 'Album request failed'}`);
    return data;
  }
  const album = await call('list', {});
  console.log(`PASS: live Vercel album API returned ${album.photos.length} photos.`);
  if (album.photos.length) {
    const preview = await call('preview', { id: album.photos[0].id, large: false });
    if (typeof preview !== 'string' || !preview.startsWith('data:image/')) throw new Error('Invalid photo preview.');
    console.log('PASS: live Vercel photo preview returned image data.');
  }
  console.log('Read-only verification; no uploads or permission changes.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
