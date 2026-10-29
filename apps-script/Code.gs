const FOLDER_ID = '1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;
const PART_BYTES = 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

function doGet() {
  return json_({ok:true,message:'Vince & Emy photo connection is online.'});
}

function doPost(event) {
  try {
    if (!event || !event.postData || event.postData.contents.length > 4 * 1024 * 1024 + 20000) throw new Error('Invalid photo request.');
    const input = JSON.parse(event.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
    if (!secret || secret.length < 32 || input.key !== secret) throw new Error('The album connection key is incorrect. Please check your settings.');
    const payload = input.payload || {};
    let data;
    if (input.action === 'upload') data = uploadPhoto_(payload);
    else if (input.action === 'begin') data = beginOriginal_(payload);
    else if (input.action === 'part') data = savePart_(payload);
    else if (input.action === 'finish') data = finishOriginal_(payload);
    else if (input.action === 'list') data = getAlbumPhotos_(payload.cursor || null);
    else if (input.action === 'preview') data = getPhotoPreview_(payload.id, payload.large === true);
    else throw new Error('Invalid photo action.');
    return json_({ok:true,data:data});
  } catch(error) {
    return json_({ok:false,error:String(error.message || 'The album is temporarily unavailable. Please try again.').slice(0,300)});
  }
}

function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function(n) { return ('0' + ((n + 256) % 256).toString(16)).slice(-2); }).join('');
}
function originalState_(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error('Invalid upload ID.');
  const props = PropertiesService.getScriptProperties();
  const receipt = props.getProperty('upload_' + id);
  if (receipt) { const saved = JSON.parse(receipt); if (saved.expires > Date.now()) return { complete: true, id: saved.id }; }
  const data = props.getProperty('parts_' + id);
  if (!data) throw new Error('Upload session expired. Remove the photo and select it again.');
  const state = JSON.parse(data);
  if (state.expires < Date.now()) throw new Error('Upload session expired. Remove the photo and select it again.');
  return state;
}
function discardParts_(state) {
  (state.parts || []).forEach(function(part) { if (part) try { const file = DriveApp.getFileById(part.id); if (belongsToAlbum_(file) && file.getMimeType() === 'application/octet-stream') file.setTrashed(true); } catch (_) {} });
}
function beginOriginal_(payload) {
  if (!payload || typeof payload.uploadId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(payload.uploadId)) throw new Error('Invalid upload ID.');
  if (!Number.isInteger(payload.size) || payload.size < 1 || payload.size > MAX_PHOTO_BYTES || !/^[a-f0-9]{64}$/.test(payload.sha256 || '')) throw new Error('Choose a photo up to 10 MB.');
  if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(String(payload.name || ''))) throw new Error('Choose JPG, PNG, WebP or HEIC photos.');
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('UPLOADS_ENABLED') === 'false') throw new Error('Uploads are paused.');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) throw new Error('The album is busy. Please retry.');
  try {
    const receipt = props.getProperty('upload_' + payload.uploadId);
    if (receipt && JSON.parse(receipt).expires > Date.now()) return { complete: true };
    const key = 'parts_' + payload.uploadId;
    const previous = props.getProperty(key);
    if (previous) {
      const state = JSON.parse(previous);
      if (state.expires > Date.now()) {
        if (state.sha256 !== payload.sha256 || state.size !== payload.size || state.name !== String(payload.name).slice(-150)) throw new Error('This upload belongs to a different photo. Select it again.');
        return { complete: false, received: state.parts.map(function(part,index) { return part ? index : null; }).filter(function(index) { return index !== null; }) };
      }
      discardParts_(state); props.deleteProperty(key);
    }
    let active = 0;
    const all = props.getProperties();
    Object.keys(all).filter(function(k) { return k.indexOf('parts_') === 0; }).forEach(function(k) { const state = JSON.parse(all[k]); if (state.expires < Date.now()) { discardParts_(state); props.deleteProperty(k); } else active++; });
    if (active >= 20) throw new Error('Many guests are uploading. Please retry shortly.');
    props.setProperty(key, JSON.stringify({ name: String(payload.name).slice(-150), size: payload.size, sha256: payload.sha256, guestName: String(payload.guestName || '').slice(0,80), expires: Date.now() + 86400000, parts: [] }));
    return { complete: false, received: [] };
  } finally { lock.releaseLock(); }
}
function savePart_(payload) {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) throw new Error('The album is busy. Please retry.');
  try {
    const state = originalState_(payload.uploadId); if (state.complete) return state;
    const count = Math.ceil(state.size / PART_BYTES);
    if (!Number.isInteger(payload.index) || payload.index < 0 || payload.index >= count || typeof payload.data !== 'string' || payload.data.length > Math.ceil(PART_BYTES / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.data)) throw new Error('Invalid photo part.');
    const bytes = Utilities.base64Decode(payload.data);
    const expected = Math.min(PART_BYTES, state.size - payload.index * PART_BYTES);
    if (bytes.length !== expected) throw new Error('Incomplete photo part. Please retry.');
    const hash = sha256_(bytes);
    if (state.parts[payload.index]) { if (state.parts[payload.index].sha256 !== hash) throw new Error('Photo part changed. Select the photo again.'); return { received: true }; }
    if (payload.index === 0 && !detectType_(bytes)) throw new Error('Unsupported photo contents.');
    const file = DriveApp.getFolderById(FOLDER_ID).createFile(Utilities.newBlob(bytes, 'application/octet-stream', '.wedding-part-' + payload.uploadId + '-' + payload.index));
    state.parts[payload.index] = { id: file.getId(), sha256: hash };
    PropertiesService.getScriptProperties().setProperty('parts_' + payload.uploadId, JSON.stringify(state));
    return { received: true };
  } finally { lock.releaseLock(); }
}
function finishOriginal_(payload) {
  const state = originalState_(payload.uploadId); if (state.complete) return state;
  let bytes = [];
  for (let index = 0; index < Math.ceil(state.size / PART_BYTES); index++) {
    const part = state.parts[index]; if (!part) throw new Error('Some photo parts are missing. Tap retry to continue.');
    const file = DriveApp.getFileById(part.id);
    if (!belongsToAlbum_(file) || file.getMimeType() !== 'application/octet-stream') throw new Error('Invalid photo part.');
    const data = file.getBlob().getBytes();
    if (sha256_(data) !== part.sha256) throw new Error('Photo part verification failed. Please select the photo again.');
    bytes = bytes.concat(data);
  }
  if (bytes.length !== state.size || sha256_(bytes) !== state.sha256) throw new Error('Original photo verification failed. Please select the photo again.');
  const result = uploadPhoto_({ uploadId: payload.uploadId, name: state.name, guestName: state.guestName, data: Utilities.base64Encode(bytes) });
  discardParts_(state);
  PropertiesService.getScriptProperties().deleteProperty('parts_' + payload.uploadId);
  return result;
}

// Run once in the editor as the folder owner/editor. This never creates a folder.
function setupAlbum() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  if (folder.isTrashed()) throw new Error('The wedding folder is in the trash.');
  console.log('Connected to existing wedding folder: ' + folder.getName());
  return 'Wedding folder connected. You can deploy the web app now.';
}

function uploadPhoto_(payload) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('UPLOADS_ENABLED') === 'false') throw new Error('Uploads are paused. Please try again later.');
  if (!payload || typeof payload.data !== 'string' || payload.data.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 100) throw new Error('Choose a photo up to 10 MB.');
  if (typeof payload.uploadId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(payload.uploadId)) throw new Error('Invalid upload. Select the photo again.');
  const name = String(payload.name || 'photo.jpg').normalize('NFKC').replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(-150);
  const ext = name.split('.').pop().toLowerCase();
  const extensions = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
  if (!extensions[ext]) throw new Error('Choose JPG, PNG, WebP or HEIC photos.');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.data) || payload.data.length % 4 !== 0) throw new Error('This photo could not be read.');
  const bytes = Utilities.base64Decode(payload.data);
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('Choose a photo up to 10 MB.');
  const actual = detectType_(bytes);
  const expected = extensions[ext];
  if (actual !== expected && !(actual === 'image/heic' && expected === 'image/heif')) throw new Error('The photo contents do not match its file extension.');
  const guest = String(payload.guestName || '').replace(/[\x00-\x1f]/g, '').trim().slice(0, 80);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Other guests are uploading. Please retry in a moment.');
  try {
    const now = Date.now();
    const receiptKey = 'upload_' + payload.uploadId;
    const receipt = props.getProperty(receiptKey);
    if (receipt) {
      const saved = JSON.parse(receipt);
      if (saved.expires > now) return { id: saved.id, name: name };
    }
    const day = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd');
    const quota = JSON.parse(props.getProperty('DAILY_UPLOAD_USAGE') || '{}');
    const usage = quota.day === day ? quota : { day: day, count: 0, bytes: 0 };
    if (usage.count >= 1000 || usage.bytes + bytes.length > 2 * 1024 * 1024 * 1024) throw new Error('Today\'s album upload limit has been reached. Please let Vince & Emy know.');
    const folder = DriveApp.getFolderById(FOLDER_ID);
    if (folder.isTrashed()) throw new Error('The album is temporarily unavailable.');
    // Keep inherited permissions. Never make files or the folder publicly writable/viewable.
    const file = folder.createFile(Utilities.newBlob(bytes, actual, name));
    const result = { id: file.getId(), name: name };
    // Record the completed file before optional metadata work so retries do not duplicate it.
    props.setProperty(receiptKey, JSON.stringify({ id: result.id, expires: now + 86400000 }));
    props.setProperty('DAILY_UPLOAD_USAGE', JSON.stringify({ day: day, count: usage.count + 1, bytes: usage.bytes + bytes.length }));
    try { file.setDescription('Wedding photo' + (guest ? ' shared by ' + guest : '')); } catch (_) {}
    const all = props.getProperties();
    Object.keys(all).filter(function(key) { return key.indexOf('upload_') === 0; }).forEach(function(key) {
      try { if (JSON.parse(all[key]).expires < now) props.deleteProperty(key); } catch (_) { props.deleteProperty(key); }
    });
    return result;
  } catch (error) {
    if (/quota|storage|limit exceeded/i.test(String(error.message))) throw new Error('The album is busy or storage is full. Please let Vince & Emy know.');
    throw error;
  } finally { lock.releaseLock(); }
}

function getAlbumPhotos_(cursor) {
  const iterator = cursor ? DriveApp.continueFileIterator(String(cursor).slice(0, 4000)) : DriveApp.getFolderById(FOLDER_ID).getFiles();
  const photos = [];
  let scanned = 0;
  while (iterator.hasNext() && photos.length < 24 && scanned < 200) {
    const file = iterator.next(); scanned++;
    // Continuation tokens may come from a visitor: always recheck folder membership.
    if (!belongsToAlbum_(file) || file.isTrashed() || PHOTO_TYPES.indexOf(file.getMimeType()) === -1) continue;
    photos.push({ id: file.getId(), name: file.getName(), createdAt: file.getDateCreated().toISOString() });
  }
  photos.sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
  return { photos: photos, nextCursor: iterator.hasNext() ? iterator.getContinuationToken() : null };
}

function getPhotoPreview_(id, large) {
  if (typeof id !== 'string' || !/^[\w-]{5,200}$/.test(id)) throw new Error('Photo not found.');
  const file = DriveApp.getFileById(id);
  if (!belongsToAlbum_(file) || file.isTrashed() || PHOTO_TYPES.indexOf(file.getMimeType()) === -1) throw new Error('Photo not found.');
  let blob;
  if (large && ['image/jpeg', 'image/png', 'image/webp'].indexOf(file.getMimeType()) !== -1 && file.getSize() <= MAX_PREVIEW_BYTES) blob = file.getBlob();
  else blob = file.getThumbnail();
  if (!blob && ['image/jpeg', 'image/png', 'image/webp'].indexOf(file.getMimeType()) !== -1 && file.getSize() <= MAX_PREVIEW_BYTES) blob = file.getBlob();
  if (!blob) throw new Error('Preview is being prepared. Refresh in a moment.');
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

function belongsToAlbum_(file) {
  const parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === FOLDER_ID) return true;
  return false;
}

function detectType_(bytes) {
  const b = bytes.slice(0, 64).map(function(n) { return (n + 256) % 256; });
  function text(start, length) { return b.slice(start, start + length).map(function(n) { return String.fromCharCode(n); }).join(''); }
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 8 && b.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png';
  if (b.length >= 12 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') return 'image/webp';
  if (b.length >= 16 && text(4, 4) === 'ftyp' && /heic|heix|hevc|hevx/.test(text(8, Math.min(56, b.length - 8)))) return 'image/heic';
  return '';
}
