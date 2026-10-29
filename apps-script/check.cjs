const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const ts = require("typescript");
const { createHash } = require("node:crypto");
const folderId = "1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32";
const secret = "test-connection-key-" + "x".repeat(40);
const properties = { APPS_SCRIPT_SECRET: secret };
let writes = 0;
const saved = new Map();
const iterator = (values) => {
  let i = 0;
  return {
    hasNext: () => i < values.length,
    next: () => values[i++],
    getContinuationToken: () => "continuation",
  };
};
function file(id, blob, parent = folderId) {
  let trashed = false;
  return {
    getId: () => id,
    getName: () => blob.name,
    getMimeType: () => blob.mime,
    getSize: () => blob.bytes.length,
    getBlob: () => blob,
    getThumbnail: () => blob,
    getParents: () => iterator([{ getId: () => parent }]),
    isTrashed: () => trashed,
    setTrashed: (value) => {
      trashed = value;
    },
    getDateCreated: () => new Date(),
    setDescription: () => {},
  };
}
const folder = {
  getName: () => "Wedding folder",
  isTrashed: () => false,
  getFiles: () => iterator([...saved.values()]),
  createFile: (blob) => {
    writes++;
    const result = file("photo_" + writes, blob);
    saved.set(result.getId(), result);
    return result;
  },
};
const context = vm.createContext({
  console: { log: () => {} },
  ContentService: {
    MimeType: { JSON: "json" },
    createTextOutput: (text) => ({ setMimeType: () => text }),
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_algorithm, bytes) => [
      ...createHash("sha256").update(Buffer.from(bytes)).digest(),
    ],
    base64Decode: (data) => [...Buffer.from(data, "base64")],
    base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
    formatDate: () => "2026-10-30",
    newBlob: (bytes, mime, name) => ({
      bytes,
      mime,
      name,
      getBytes: () => bytes,
      getContentType: () => mime,
    }),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => properties[key] || null,
      setProperty: (key, value) => (properties[key] = value),
      getProperties: () => ({ ...properties }),
      deleteProperty: (key) => delete properties[key],
    }),
  },
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
  },
  DriveApp: {
    getFolderById: (id) => {
      assert.equal(id, folderId);
      return folder;
    },
    getFileById: (id) => saved.get(id),
    continueFileIterator: () => iterator([...saved.values()]),
  },
});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8"),
  context,
);
function call(action, payload, key = secret) {
  return JSON.parse(
    context.doPost({
      postData: { contents: JSON.stringify({ action, payload, key }) },
    }),
  );
}
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
const upload = {
  name: "memory.png",
  data: png,
  uploadId: "test-upload-123456789",
  guestName: "Guest",
};
assert.match(context.setupAlbum(), /connected/);
assert.equal(writes, 0);
assert.equal(call("upload", upload, "wrong-key").ok, false);
assert.equal(writes, 0);
const result = call("upload", upload);
assert.equal(result.ok, true);
assert.equal(writes, 1);
assert.equal(call("upload", upload).data.id, result.data.id);
assert.equal(writes, 1);
assert.equal(call("upload", { ...upload, name: "renamed.jpg" }).ok, false);
assert.equal(call("upload", { ...upload, name: "script.svg" }).ok, false);
assert.equal(call("list", {}).data.photos.length, 1);
assert.match(
  call("preview", { id: result.data.id }).data,
  /^data:image\/png;base64,/,
);
saved.set(
  "outside_123",
  file(
    "outside_123",
    { mime: "image/png", name: "private.png", bytes: [1] },
    "private-folder",
  ),
);
assert.equal(call("preview", { id: "outside_123" }).ok, false);
assert.equal(call("list", {}).data.photos.length, 1);
properties.UPLOADS_ENABLED = "false";
assert.equal(call("upload", upload).ok, false);
assert.ok(
  !fs
    .readFileSync(path.join(__dirname, "Code.gs"), "utf8")
    .includes(".setSharing("),
);

// A photo larger than the Vercel request limit must be reconstructed byte-for-byte.
delete properties.UPLOADS_ENABLED;
const original = Buffer.alloc(4 * 1024 * 1024 + 317, 173);
Buffer.from(png, "base64").copy(original);
const originalHash = createHash("sha256").update(original).digest("hex");
const originalRequest = {
  uploadId: "original-upload-123456789",
  name: "original-photo.png",
  size: original.length,
  sha256: originalHash,
  guestName: "Guest",
};
assert.equal(call("begin", originalRequest).ok, true);
assert.equal(
  call("finish", { uploadId: originalRequest.uploadId }).ok,
  false,
  "Missing parts must not create a photo",
);
for (let index = 0; index < Math.ceil(original.length / 1048576); index++) {
  const data = original
    .subarray(index * 1048576, (index + 1) * 1048576)
    .toString("base64");
  const payload = { uploadId: originalRequest.uploadId, index, data };
  assert.equal(call("part", payload).ok, true);
  if (index === 0) {
    const before = writes;
    assert.equal(call("part", payload).ok, true);
    assert.equal(writes, before, "Retry must not duplicate a part");
    const resume = call("begin", originalRequest);
    assert.equal(resume.data.received[0], 0);
  }
}
const finalized = call("finish", { uploadId: originalRequest.uploadId });
assert.equal(finalized.ok, true, JSON.stringify(finalized));
const stored = saved.get(finalized.data.id);
assert.equal(stored.getName(), "original-photo.png");
assert.equal(stored.getSize(), original.length);
assert.equal(
  createHash("sha256")
    .update(Buffer.from(stored.getBlob().getBytes()))
    .digest("hex"),
  originalHash,
  "Original bytes must remain unchanged",
);
const beforeRetry = writes;
assert.equal(
  call("finish", { uploadId: originalRequest.uploadId }).data.id,
  finalized.data.id,
);
assert.equal(
  writes,
  beforeRetry,
  "Completed retry must not duplicate the original",
);
assert.ok(
  [...saved.values()]
    .filter((f) => f.getMimeType() === "application/octet-stream")
    .every((f) => f.isTrashed()),
  "Temporary parts must be cleaned up",
);
assert.equal(
  call("list", {}).data.photos.length,
  2,
  "Temporary parts must not appear in the album",
);

async function proxyChecks() {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../api/photos.ts"), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  const exports = {};
  let calls = 0;
  const env = {
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/testdeployment/exec",
    APPS_SCRIPT_SECRET: secret,
    VERCEL_ENV: "production",
  };
  const sandbox = vm.createContext({
    exports,
    process: { env },
    Buffer,
    URL,
    AbortSignal,
    Date,
    Map,
    fetch: async (url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.key, secret);
      assert.equal(url.hostname, "script.google.com");
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: { photos: [], nextCursor: null },
        }),
      };
    },
  });
  vm.runInContext(code, sandbox);
  async function request(headers, body = { action: "list", payload: {} }) {
    const res = {
      headers: {},
      statusCode: 0,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(text) {
        this.body = JSON.parse(text);
      },
    };
    await exports.default({ method: "POST", headers, body }, res);
    return res;
  }
  const good = await request({
    host: "wedding.vercel.app",
    origin: "https://wedding.vercel.app",
  });
  assert.equal(good.statusCode, 200);
  assert.ok(!JSON.stringify(good.body).includes(secret));
  assert.equal(calls, 1);
  assert.equal(
    (
      await request({
        host: "wedding.vercel.app",
        origin: "https://bad.example",
      })
    ).statusCode,
    403,
  );
  assert.equal(calls, 1);
  assert.equal(
    (
      await request(
        { host: "wedding.vercel.app" },
        { action: "delete", payload: {} },
      )
    ).statusCode,
    400,
  );
  delete env.APPS_SCRIPT_SECRET;
  assert.equal((await request({ host: "wedding.vercel.app" })).statusCode, 503);
}
proxyChecks()
  .then(() =>
    console.log(
      "PASS: original 4+ MiB photo reconstructed with identical SHA-256, size and filename; chunk/final retries, missing-part rejection and temporary cleanup; proxy secret forwarding, origin checks, file validation and folder isolation. External services were mocked; deployment verification is still required.",
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
