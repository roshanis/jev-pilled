import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODELS, costUsd } from "./pricing.js";
import { SYSTEM, buildOutputSchema, buildPrompt, toJevShape } from "./prompt.js";

export const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env (or run with MOCK=1).");
  }
  client ??= new Anthropic();
  return client;
}

export async function runClaude({ state, questions, model = DEFAULT_CLAUDE_MODEL, effort = "low" }) {
  const info = CLAUDE_MODELS[model];
  if (!info) throw new Error(`Unknown Claude model: ${model}`);

  const params = {
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      effort,
      format: { type: "json_schema", schema: buildOutputSchema(questions) },
    },
    messages: [{ role: "user", content: buildPrompt(state, questions) }],
  };

  const started = performance.now();
  const response = info.fallbacks
    ? await getClient().beta.messages.create({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      })
    : await getClient().messages.create(params);
  const latencyMs = Math.round(performance.now() - started);

  if (response.stop_reason === "refusal") {
    const why = response.stop_details?.explanation || response.stop_details?.category || "no details";
    throw new Error(`Claude declined this request (${why})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude hit max_tokens before finishing the answer");
  }

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = JSON.parse(text);

  return {
    provider: "claude",
    model: response.model || model,
    answers: toJevShape(questions, parsed.answers),
    reasoning: parsed.reasoning,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    costUsd: costUsd(response.usage, info),
    latencyMs,
  };
}
