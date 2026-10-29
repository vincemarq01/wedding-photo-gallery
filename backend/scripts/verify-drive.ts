import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { checkFolder, driveFetch } from "../src/services/drive.js";
import { config } from "../src/config.js";
// This deliberately exercises the guest HTTP flow, then independently verifies Drive metadata.
if (config.NODE_ENV === "production")
  throw new Error("Run the verification against a local backend.");
const base = `http://localhost:${config.PORT}`;
async function call(path: string, init: RequestInit) {
  const response = await fetch(base + path, init);
  const body = await response.json();
  assert.ok(response.ok, JSON.stringify(body));
  return body;
}
await checkFolder();
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
  "base64",
);
const batch = await call("/api/authorize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});
const name = `wedding-upload-verification-${Date.now()}.png`;
const upload = await call("/api/uploads", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + batch.token,
  },
  body: JSON.stringify({
    name,
    size: bytes.length,
    guestName: "End-to-end verification",
  }),
});
const complete = await call("/api/uploads/chunk", {
  method: "PUT",
  headers: {
    "Content-Type": "application/octet-stream",
    Authorization: "Bearer " + upload.session,
    "X-Upload-Offset": "0",
  },
  body: new Uint8Array(bytes),
});
assert.equal(complete.complete, true);
const resumed = await call("/api/uploads/status", {
  headers: { Authorization: "Bearer " + upload.session },
});
assert.equal(resumed.complete, true);
const query = `'${config.GOOGLE_DRIVE_FOLDER_ID}' in parents and name = '${name}' and trashed = false`;
const files = await (
  await driveFetch(
    "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent(query) +
      "&fields=files(id,name,size,parents,md5Checksum)&supportsAllDrives=true&includeItemsFromAllDrives=true",
  )
).json();
assert.equal(files.files.length, 1);
const file = files.files[0];
assert.equal(Number(file.size), bytes.length);
assert.ok(file.parents.includes(config.GOOGLE_DRIVE_FOLDER_ID));
assert.equal(file.md5Checksum, createHash("md5").update(bytes).digest("hex"));
console.log(
  `PASS: guest API uploaded and verified ${name} in folder ${config.GOOGLE_DRIVE_FOLDER_ID}. File ID: ${file.id}. The tiny verification photo is retained.`,
);
