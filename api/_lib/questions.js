// Questions use TypeSafe's System One schema, so the same object goes to Jev
// unchanged and is translated into a prompt + JSON schema for Claude.
//
//   noul:   { type: "noul",   instructions, criteria?: { true, false } }
//   choice: { type: "choice", instructions, criteria: { option: description|null, ... } }
//   score:  { type: "score",  instructions, criteria: [level0, level1, ...] }

export function validateQuestions(questions) {
  if (!questions || typeof questions !== "object" || Array.isArray(questions)) {
    throw new Error("questions must be an object keyed by question name");
  }
  const names = Object.keys(questions);
  if (names.length === 0) throw new Error("add at least one question");

  for (const [name, q] of Object.entries(questions)) {
    if (!q || typeof q !== "object") throw new Error(`${name}: question must be an object`);
    if (q.instructions == null || q.instructions === "") {
      throw new Error(`${name}: instructions are required`);
    }
    switch (q.type) {
      case "noul":
        break;
      case "choice": {
        const opts = q.criteria && typeof q.criteria === "object" && !Array.isArray(q.criteria)
          ? Object.keys(q.criteria)
          : [];
        if (opts.length < 2) throw new Error(`${name}: choice needs at least 2 options in criteria`);
        if (opts.length > 255) throw new Error(`${name}: choice allows at most 255 options`);
        break;
      }
      case "score":
        if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10) {
          throw new Error(`${name}: score needs 2 to 10 levels in criteria`);
        }
        break;
      default:
        throw new Error(`${name}: type must be noul, choice or score`);
    }
  }
}

export function asText(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

// Normalizes a probability map so it sums to 1 and returns [top key, its probability].
export function normalize(probs) {
  const entries = Object.entries(probs).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const out = {};
  for (const [k, v] of entries) out[k] = total > 0 ? v / total : 1 / entries.length;
  let top = entries[0][0];
  for (const k of Object.keys(out)) if (out[k] > out[top]) top = k;
  return { probabilities: out, top, topP: out[top] };
}
