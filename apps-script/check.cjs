const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const ts = require("typescript");
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
  return {
    getId: () => id,
    getName: () => blob.name,
    getMimeType: () => blob.mime,
    getSize: () => blob.bytes.length,
    getBlob: () => blob,
    getThumbnail: () => blob,
    getParents: () => iterator([{ getId: () => parent }]),
    isTrashed: () => false,
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
      "PASS: Vercel proxy secret forwarding, origin rejection, action allowlist, missing configuration; Apps Script secret checks, fixed-folder upload, receipt retries, signatures, private previews, folder isolation and upload pause. External services were mocked; deployment verification is still required.",
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
