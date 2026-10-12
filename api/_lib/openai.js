import OpenAI from "openai";
import { OPENAI_MODELS, costUsd } from "./pricing.js";
import { SYSTEM, buildOutputSchema, buildPrompt, toJevShape } from "./prompt.js";

export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env (or run with MOCK=1).");
  }
  client ??= new OpenAI();
  return client;
}

// Same prompt and schema Claude gets, through the Responses API with strict
// structured output.
export async function runOpenAI({ state, questions, openaiModel = DEFAULT_OPENAI_MODEL, effort = "low" }) {
  const info = OPENAI_MODELS[openaiModel];
  if (!info) throw new Error(`Unknown OpenAI model: ${openaiModel}`);

  const started = performance.now();
  const response = await getClient().responses.create({
    model: openaiModel,
    instructions: SYSTEM,
    input: buildPrompt(state, questions),
    reasoning: { effort },
    max_output_tokens: 16000,
    text: {
      format: { type: "json_schema", name: "decisions", schema: buildOutputSchema(questions), strict: true },
    },
  });
  const latencyMs = Math.round(performance.now() - started);

  if (response.status === "incomplete") {
    throw new Error(`OpenAI stopped early (${response.incomplete_details?.reason || "incomplete"})`);
  }
  const refusal = response.output
    ?.flatMap((item) => item.content || [])
    .find((c) => c.type === "refusal");
  if (refusal) throw new Error(`OpenAI declined this request (${refusal.refusal})`);

  const parsed = JSON.parse(response.output_text);
  const usage = {
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
  };
  return {
    provider: "openai",
    model: response.model || openaiModel,
    answers: toJevShape(questions, parsed.answers),
    reasoning: parsed.reasoning,
    usage,
    costUsd: costUsd(usage, info),
    latencyMs,
  };
}
