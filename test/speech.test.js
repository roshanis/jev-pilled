import { test } from "node:test";
import assert from "node:assert/strict";
import { speech } from "../api/_lib/handlers.js";

test("speech reports a missing ElevenLabs key", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  const r = await speech({ side: "claude", text: "hi" });
  assert.equal(r.status, 503);
});

test("speech validates side and length", async () => {
  process.env.ELEVENLABS_API_KEY = "test";
  assert.equal((await speech({ side: "gpt", text: "hi" })).status, 400);
  assert.equal((await speech({ side: "jev", text: "x".repeat(1001) })).status, 400);
  delete process.env.ELEVENLABS_API_KEY;
});

test("speech accepts the openai side", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal((await speech({ side: "openai", text: "hi" })).status, 503);
});
