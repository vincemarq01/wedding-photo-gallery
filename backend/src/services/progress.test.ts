import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgress } from "./progress.js";
test("a fresh Drive session starts at byte zero", () => {
  assert.deepEqual(parseProgress(new Response(null, { status: 308 }), 1000), {
    offset: 0,
    complete: false,
  });
});
test("resume starts after the inclusive last byte acknowledged by Drive", () => {
  assert.deepEqual(
    parseProgress(
      new Response(null, { status: 308, headers: { Range: "bytes=0-262143" } }),
      1000000,
    ),
    { offset: 262144, complete: false },
  );
});
test("only successful final Drive responses mark the entire file complete", () => {
  for (const status of [200, 201])
    assert.deepEqual(parseProgress(new Response("{}", { status }), 1000), {
      offset: 1000,
      complete: true,
    });
});
