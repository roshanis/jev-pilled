// MOCK=1 returns made-up answers so the UI can be tried without API keys.
// Every mocked result is flagged so the page labels it clearly.
import { CLAUDE_MODELS, JEV_PRICE, OPENAI_MODELS, costUsd } from "./pricing.js";
import { buildPrompt, toJevShape } from "./prompt.js";

function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function randomRaw(questions, rand) {
  const raw = {};
  for (const [name, q] of Object.entries(questions)) {
    if (q.type === "noul") raw[name] = { probability_yes: rand() };
    else {
      const keys = q.type === "choice" ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
      const peak = Math.floor(rand() * keys.length);
      raw[name] = {
        probabilities: Object.fromEntries(keys.map((k, i) => [k, i === peak ? 2 + rand() * 6 : rand()])),
      };
    }
  }
  return raw;
}

const tokens = (text) => Math.ceil(text.length / 4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function mockJev({ state, questions }) {
  const rand = seeded("jev" + JSON.stringify([state, questions]));
  const latencyMs = Math.round(60 + rand() * 120);
  await sleep(latencyMs);
  const usage = { input_tokens: tokens(buildPrompt(state, questions)), output_tokens: 0 };
  return {
    provider: "jev", mock: true, model: "jev-1.13.0 (mock)",
    answers: toJevShape(questions, randomRaw(questions, rand)),
    usage, costUsd: costUsd(usage, JEV_PRICE), latencyMs,
  };
}

export async function mockClaude({ state, questions, model }) {
  const rand = seeded("claude" + JSON.stringify([state, questions, model]));
  const latencyMs = Math.round(900 + rand() * 1800);
  await sleep(latencyMs);
  const input = tokens(buildPrompt(state, questions)) + 180;
  const usage = { input_tokens: input, output_tokens: 120 + Math.round(rand() * 200) };
  return {
    provider: "claude", mock: true, model: `${model} (mock)`,
    answers: toJevShape(questions, randomRaw(questions, rand)),
    reasoning: "Mock mode: no model was called. Set ANTHROPIC_API_KEY and run without MOCK=1 for real output.",
    usage, costUsd: costUsd(usage, CLAUDE_MODELS[model]), latencyMs,
  };
}

export async function mockOpenAI({ state, questions, openaiModel }) {
  const rand = seeded("openai" + JSON.stringify([state, questions, openaiModel]));
  const latencyMs = Math.round(700 + rand() * 1800);
  await sleep(latencyMs);
  const usage = { input_tokens: tokens(buildPrompt(state, questions)) + 170, output_tokens: 110 + Math.round(rand() * 200) };
  return {
    provider: "openai", mock: true, model: `${openaiModel} (mock)`,
    answers: toJevShape(questions, randomRaw(questions, rand)),
    reasoning: "Mock mode: no model was called. Set OPENAI_API_KEY and run without MOCK=1 for real output.",
    usage, costUsd: costUsd(usage, OPENAI_MODELS[openaiModel]), latencyMs,
  };
}
