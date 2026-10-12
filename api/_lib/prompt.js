// Turns TypeSafe-style typed questions into a prompt and JSON schema for a
// general LLM, and converts its answer back into Jev's response shape.
import { asText, normalize } from "./questions.js";

export const SYSTEM = `You are acting as a calibrated decision model. You receive a STATE (text or JSON) and one or more typed questions about it.
For every question, judge the STATE only against that question's instructions and criteria, then give a probability for every allowed answer.
- choice: a probability for each option.
- score: a probability for each level (levels are indexed from 0, lowest first).
- noul: the probability that the answer is yes.
Probabilities should reflect your real uncertainty, not just your top pick. Keep the reasoning to a few sentences.`;

function describeQuestion(name, q) {
  const lines = [`### ${name} (${q.type})`, `Instructions: ${asText(q.instructions)}`];
  if (q.type === "choice") {
    lines.push("Options:");
    for (const [opt, desc] of Object.entries(q.criteria)) {
      lines.push(desc == null ? `- ${opt}` : `- ${opt}: ${asText(desc)}`);
    }
  } else if (q.type === "score") {
    lines.push("Levels:");
    q.criteria.forEach((level, i) => lines.push(`- ${i}: ${asText(level)}`));
  } else if (q.type === "noul" && q.criteria) {
    if (q.criteria.true != null) lines.push(`Yes means: ${asText(q.criteria.true)}`);
    if (q.criteria.false != null) lines.push(`No means: ${asText(q.criteria.false)}`);
  }
  return lines.join("\n");
}

function probabilitySchema(keys) {
  return {
    type: "object",
    properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }])),
    required: keys,
    additionalProperties: false,
  };
}

export function buildOutputSchema(questions) {
  const answerProps = {};
  for (const [name, q] of Object.entries(questions)) {
    if (q.type === "noul") {
      answerProps[name] = {
        type: "object",
        properties: { probability_yes: { type: "number" } },
        required: ["probability_yes"],
        additionalProperties: false,
      };
    } else {
      const keys = q.type === "choice" ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
      answerProps[name] = {
        type: "object",
        properties: { probabilities: probabilitySchema(keys) },
        required: ["probabilities"],
        additionalProperties: false,
      };
    }
  }
  return {
    type: "object",
    properties: {
      reasoning: { type: "string" },
      answers: {
        type: "object",
        properties: answerProps,
        required: Object.keys(questions),
        additionalProperties: false,
      },
    },
    required: ["reasoning", "answers"],
    additionalProperties: false,
  };
}

export function buildPrompt(state, questions) {
  const parts = [
    "STATE:",
    asText(state),
    "",
    "QUESTIONS:",
    ...Object.entries(questions).map(([name, q]) => describeQuestion(name, q)),
  ];
  return parts.join("\n");
}

// Converts Claude's raw probabilities into the same answer shape Jev returns.
export function toJevShape(questions, raw) {
  const answers = {};
  for (const [name, q] of Object.entries(questions)) {
    const a = raw[name];
    if (q.type === "noul") {
      const p = Math.min(1, Math.max(0, Number(a.probability_yes) || 0));
      answers[name] = { type: "noul", noul: p };
    } else if (q.type === "choice") {
      const { probabilities, top, topP } = normalize(a.probabilities);
      answers[name] = { type: "choice", choice: top, probabilities, confidence: topP };
    } else {
      const { probabilities, topP } = normalize(a.probabilities);
      const score = Object.entries(probabilities).reduce((s, [i, p]) => s + Number(i) * p, 0);
      const legend = Object.fromEntries(q.criteria.map((level, i) => [String(i), asText(level)]));
      answers[name] = { type: "score", score, legend, probabilities, confidence: topP };
    }
  }
  return answers;
}
