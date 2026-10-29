import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { seal, unseal } from "../services/tokens.js";

test("album lists only destination images and refuses media outside the wedding folder", async () => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    GOOGLE_REFRESH_TOKEN: "test-refresh",
    SESSION_SECRET: "ab".repeat(32),
    GOOGLE_DRIVE_FOLDER_ID: "wedding-folder",
  });
  const { album } = await import("./album.js");
  const { authorize } = await import("../controllers/uploads.js");
  const { auth } = await import("../services/drive.js");
  const originalToken = auth.getAccessToken;
  auth.getAccessToken = (async () => ({
    token: "fake-access-token",
  })) as typeof auth.getAccessToken;
  const nativeFetch = globalThis.fetch;
  const calls: string[] = [];
  let outsideFolder = false;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/files?")) {
      const query = new URL(url).searchParams.get("q")!;
      assert.ok(query.includes("'wedding-folder' in parents"));
      assert.ok(query.includes("mimeType contains 'image/'"));
      return Response.json({
        files: [
          {
            id: "photo-1",
            name: "Our photo.png",
            createdTime: "2026-10-29T00:00:00Z",
          },
        ],
      });
    }
    if (url.includes("/files/photo-1?"))
      return Response.json({
        parents: [outsideFolder ? "another-folder" : "wedding-folder"],
        mimeType: "image/png",
        size: 5,
      });
    throw Error("Unexpected upstream request: " + url);
  }) as typeof fetch;
  const app = express();
  app.post("/api/authorize", authorize);
  app.use("/api", album);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const authorization = await nativeFetch(base + "/api/authorize", {
      method: "POST",
    });
    assert.equal(authorization.status, 200);
    const credentials = await authorization.json();
    const grant = unseal<{ kind: string; expires: number }>(
      credentials.token,
      process.env.SESSION_SECRET!,
    );
    assert.equal(grant.kind, "batch");
    assert.ok(grant.expires > Date.now());
    assert.equal(
      calls.length,
      0,
      "Guest authorization must not call an external challenge service",
    );
    const response = await nativeFetch(base + "/api/album");
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.photos[0].name, "Our photo.png");
    assert.ok(data.photos[0].image.startsWith("/api/album/image/"));
    assert.ok(!JSON.stringify(data).includes("fake-access-token"));
    outsideFolder = true;
    const image = await nativeFetch(base + data.photos[0].image);
    assert.equal(image.status, 404);
    assert.equal(calls.filter((url) => url.includes("alt=media")).length, 0);
    const wrongKind = seal(
      { kind: "batch", expires: Date.now() + 10000 },
      process.env.SESSION_SECRET!,
    );
    assert.equal(
      (await nativeFetch(base + "/api/album/image/" + wrongKind)).status,
      404,
    );
  } finally {
    globalThis.fetch = nativeFetch;
    auth.getAccessToken = originalToken;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
