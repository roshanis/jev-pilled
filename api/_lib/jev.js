import { jevImageRequest } from "./image.js";
import { JEV_PRICE, costUsd } from "./pricing.js";

const JEV_URL = process.env.TYPESAFE_API_URL || "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = process.env.TYPESAFE_MODEL || "jev-latest";
// Image input arrived in Jev 1.14 under the jev-preview alias, behind an opt-in header.
export const JEV_IMAGE_MODEL = process.env.TYPESAFE_IMAGE_MODEL || "jev-preview";

// Calls TypeSafe's System One endpoint. The questions object is passed through
// as-is, since the app's question format is TypeSafe's own schema.
export async function runJev({ state, questions, image }) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set. Add it to .env (or run with MOCK=1).");

  const model = image ? JEV_IMAGE_MODEL : JEV_MODEL;
  const payload = image ? { ...jevImageRequest(state, image), model, questions } : { state, model, questions };
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (image) headers["TypeSafe-Danger-Zone-Images"] = "true";

  const started = performance.now();
  const res = await fetch(JEV_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
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
    model: body.model || model,
    answers: body.answers,
    usage: body.usage || null,
    costUsd: costUsd(body.usage, JEV_PRICE),
    latencyMs,
  };
}
