// USD per million tokens. Update if list prices change.
export const CLAUDE_MODELS = {
  "claude-opus-5-5": { label: "Claude Opus 5.5", input: 4.0, output: 20.0, fallbacks: true },
  "claude-sonnet-5-5": { label: "Claude Sonnet 5.5", input: 2.0, output: 10.0, fallbacks: true },
  "claude-haiku-5-5": { label: "Claude Haiku 5.5", input: 0.1, output: 0.5, fallbacks: false },
};

// Jev bills input tokens only.
export const JEV_PRICE = { input: 0.042, output: 0 };

export function costUsd(usage, price) {
  if (!usage || !price) return null;
  return ((usage.input_tokens || 0) * price.input + (usage.output_tokens || 0) * price.output) / 1e6;
}
