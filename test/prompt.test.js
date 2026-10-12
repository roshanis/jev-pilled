import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutputSchema, buildPrompt, toJevShape } from "../api/_lib/prompt.js";
import { validateQuestions } from "../api/_lib/questions.js";
import { PRESETS } from "../api/_lib/presets.js";

test("every preset is a valid question set", () => {
  for (const p of PRESETS) validateQuestions(p.questions);
});

test("schema lists every option and level", () => {
  const { questions } = PRESETS.find((x) => x.id === "support-ticket");
  const schema = buildOutputSchema(questions);
  const a = schema.properties.answers.properties;
  assert.deepEqual(a.department.properties.probabilities.required, ["billing", "technical", "account", "other"]);
  assert.deepEqual(a.urgency.properties.probabilities.required, ["0", "1", "2", "3"]);
  assert.deepEqual(a.refund_requested.required, ["probability_yes"]);
});

test("Claude output is converted to Jev's answer shape", () => {
  const { questions } = PRESETS.find((x) => x.id === "support-ticket");
  const out = toJevShape(questions, {
    department: { probabilities: { billing: 6, technical: 3, account: 1, other: 0 } },
    urgency: { probabilities: { 0: 0, 1: 0.2, 2: 0.6, 3: 0.2 } },
    refund_requested: { probability_yes: 0.97 },
  });
  assert.equal(out.department.choice, "billing");
  assert.equal(out.department.confidence, 0.6);
  assert.ok(Math.abs(out.urgency.score - 2) < 1e-9);
  assert.equal(out.urgency.legend["3"], "Critical: drop everything");
  assert.equal(out.refund_requested.noul, 0.97);
});

test("prompt includes JSON state and option descriptions", () => {
  const p = PRESETS.find((x) => x.id === "guardrail");
  const prompt = buildPrompt(p.state, p.questions);
  assert.match(prompt, /"user_question"/);
  assert.match(prompt, /- needs_caveat: Mostly fine/);
});

test("invalid questions are rejected", () => {
  assert.throws(() => validateQuestions({ q: { type: "choice", instructions: "x", criteria: { a: null } } }), /at least 2/);
  assert.throws(() => validateQuestions({ q: { type: "score", instructions: "x", criteria: ["a"] } }), /2 to 10/);
  assert.throws(() => validateQuestions({}), /at least one/);
});
