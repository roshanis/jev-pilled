import { test } from "node:test";
import assert from "node:assert/strict";
import { JEV_IMAGE_REF, jevImageRequest, readImage } from "../api/_lib/image.js";
import { buildPrompt } from "../api/_lib/prompt.js";
import { compare } from "../api/_lib/handlers.js";

const tiny = { format: "PNG", data_base64: "iVBORw0KGgo=" };

test("no image is fine", () => {
  assert.equal(readImage(undefined), null);
});

test("images are checked and normalized", () => {
  assert.deepEqual(readImage(tiny), { format: "png", mediaType: "image/png", data: "iVBORw0KGgo=" });
  assert.equal(readImage({ format: "jpeg", data_base64: "AAAA" }).format, "jpg");
  assert.throws(() => readImage({ format: "gif", data_base64: "AAAA" }), /PNG or JPEG/);
  assert.throws(() => readImage({ format: "png", data_base64: "data:image/png;base64,AAAA" }), /plain base64/);
});

test("Jev gets the image as an asset the state points to", () => {
  const img = readImage(tiny);
  const req = jevImageRequest("Tuesday, 9:40 AM", img);
  assert.deepEqual(req.state, { image: JEV_IMAGE_REF, notes: "Tuesday, 9:40 AM" });
  assert.deepEqual(req.assets[JEV_IMAGE_REF], { type: "image", format: "png", data_base64: "iVBORw0KGgo=" });
  assert.deepEqual(jevImageRequest("", img).state, { image: JEV_IMAGE_REF });
});

test("the LLM prompt says the image is the state", () => {
  const q = { ok: { type: "noul", instructions: "Is it ok?" } };
  assert.match(buildPrompt("", q, { image: true }), /^STATE:\nThe attached image is the state\.\n\nQUESTIONS:/);
  assert.match(buildPrompt("notes here", q, { image: true }), /Notes that go with it:\nnotes here/);
  assert.match(buildPrompt("plain", q), /^STATE:\nplain\n/);
});

test("an image alone is enough to run, and bad images are rejected", async () => {
  process.env.MOCK = "1";
  const questions = { ok: { type: "noul", instructions: "Is it ok?" } };
  const good = await compare({ state: "", questions, image: tiny });
  assert.equal(good.status, 200);
  assert.match(good.body.jev.model, /1\.14/);
  const bad = await compare({ state: "", questions, image: { format: "webp", data_base64: "AAAA" } });
  assert.equal(bad.status, 400);
  const none = await compare({ state: "", questions });
  assert.equal(none.status, 400);
  delete process.env.MOCK;
});
