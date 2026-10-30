import { createServer } from "node:http";
import { once } from "node:events";
import { randomBytes, createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import assert from "node:assert/strict";
import handler from "../api/drive.js";
import { driveFetch } from "../backend/src/services/drive.js";
import { config } from "../backend/src/config.js";

// A valid PNG just above 4 MiB exercises two original binary chunks through the Vercel adapter.
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const kind = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([size, kind, data, crc]);
}
const width = 1000,
  height = 1100,
  row = width * 4 + 1;
const pixels = randomBytes(row * height);
for (let y = 0; y < height; y++) pixels[y * row] = 0;
const header = Buffer.alloc(13);
header.writeUInt32BE(width);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
const bytes = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  pngChunk("IHDR", header),
  pngChunk("IDAT", deflateSync(pixels, { level: 0 })),
  pngChunk("IEND", Buffer.alloc(0)),
]);
assert.ok(bytes.length > 4 * 1024 * 1024 && bytes.length < 10 * 1024 * 1024);
const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://local");
  if (!url.pathname.startsWith("/api/")) {
    res.writeHead(404).end();
    return;
  }
  url.searchParams.set("route", url.pathname.slice(5));
  req.url = "/api/drive" + url.search;
  void handler(req, res);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw Error("Server unavailable");
const base = `http://127.0.0.1:${address.port}`;
async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...init,
    signal: AbortSignal.timeout(90000),
  });
  const data = await response.json();
  assert.ok(response.ok, `${path}: ${data.error || response.status}`);
  return data;
}
try {
  const auth = await call("/api/authorize", { method: "POST" });
  const name = `original-drive-api-verification-${Date.now()}.png`;
  const session = await call("/api/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + auth.token,
    },
    body: JSON.stringify({
      name,
      size: bytes.length,
      guestName: "Google Drive API verification",
    }),
  });
  const headers = { Authorization: "Bearer " + session.session };
  const first = await call("/api/uploads/chunk", {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/octet-stream",
      "X-Upload-Offset": "0",
    },
    body: new Uint8Array(bytes.subarray(0, 4 * 1024 * 1024)),
  });
  assert.equal(first.offset, 4 * 1024 * 1024);
  assert.equal(first.complete, false);
  const interrupted = await call("/api/uploads/status", { headers });
  assert.equal(interrupted.offset, first.offset);
  const final = await call("/api/uploads/chunk", {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/octet-stream",
      "X-Upload-Offset": String(first.offset),
    },
    body: new Uint8Array(bytes.subarray(first.offset)),
  });
  assert.equal(final.complete, true);
  const recovered = await call("/api/uploads/status", { headers });
  assert.equal(recovered.complete, true);
  const query = `'${config.GOOGLE_DRIVE_FOLDER_ID}' in parents and name = '${name}' and trashed = false`;
  const metadata = await (
    await driveFetch(
      "https://www.googleapis.com/drive/v3/files?" +
        new URLSearchParams({
          q: query,
          fields: "files(id,size,parents,md5Checksum)",
        }),
    )
  ).json();
  assert.equal(metadata.files.length, 1);
  const file = metadata.files[0];
  assert.equal(Number(file.size), bytes.length);
  assert.equal(file.md5Checksum, createHash("md5").update(bytes).digest("hex"));
  assert.ok(file.parents.includes(config.GOOGLE_DRIVE_FOLDER_ID));
  const album = await call("/api/album");
  assert.ok(album.photos.some((photo: { id: string }) => photo.id === file.id));
  console.log(
    `PASS: Vercel adapter + real Drive API uploaded ${bytes.length} original bytes in two binary chunks; interruption status and completed-response recovery passed; exact folder, size and MD5 verified. Test PNG retained: ${name}.`,
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
