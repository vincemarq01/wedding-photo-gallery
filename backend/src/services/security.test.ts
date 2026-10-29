import { test } from "node:test";
import assert from "node:assert/strict";
import { seal, unseal } from "./tokens.js";
import { safeName, validateContent } from "./validation.js";
const key = "ab".repeat(32);
test("encrypted upload capabilities reject tampering, other keys and expiration", () => {
  const token = seal(
    { expires: Date.now() + 10000, url: "https://secret.example/upload" },
    key,
  );
  assert.equal(
    unseal<{ expires: number; url: string }>(token, key).url,
    "https://secret.example/upload",
  );
  assert.ok(!token.includes("secret.example"));
  assert.throws(() => unseal(token.slice(0, -5) + "AAAAA", key));
  assert.throws(() => unseal(token, "cd".repeat(32)));
  assert.throws(() => unseal(seal({ expires: 0 }, key), key));
});
test("file signatures reject a renamed executable and accept a valid PNG header", async () => {
  await assert.rejects(
    validateContent(Buffer.from("MZ malicious executable"), "memory.jpg"),
  );
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489",
    "hex",
  );
  assert.equal(await validateContent(png, "memory.png"), "image/png");
  await assert.rejects(validateContent(png, "memory.jpg"));
});
test("filenames cannot contain path separators or control characters", () => {
  assert.equal(safeName("../evil\\name\u0000.jpg"), ".._evil_name_.jpg");
});
