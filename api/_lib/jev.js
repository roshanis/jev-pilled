import { JEV_PRICE, costUsd } from "./pricing.js";

const JEV_URL = process.env.TYPESAFE_API_URL || "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = process.env.TYPESAFE_MODEL || "jev-latest";

// Calls TypeSafe's System One endpoint. The questions object is passed through
// as-is, since the app's question format is TypeSafe's own schema.
export async function runJev({ state, questions }) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set. Add it to .env (or run with MOCK=1).");

  const started = performance.now();
  const res = await fetch(JEV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state, model: JEV_MODEL, questions }),
    signal: AbortSignal.timeout(60_000),
  });
  const latencyMs = Math.round(performance.now() - started);

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail = body?.error?.message || body?.detail || body?.message || text.slice(0, 300);
    throw new Error(`Jev API ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }

  return {
    provider: "jev",
    model: body.model || JEV_MODEL,
    answers: body.answers,
    usage: body.usage || null,
    costUsd: costUsd(body.usage, JEV_PRICE),
    latencyMs,
  };
}
