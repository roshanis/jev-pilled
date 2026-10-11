// Request handling shared by the Vercel functions in api/ and the local
// Express server in server.js.
import { runClaude, DEFAULT_CLAUDE_MODEL } from "./claude.js";
import { runJev } from "./jev.js";
import { mockClaude, mockJev, mockOpenAI } from "./mock.js";
import { runOpenAI, DEFAULT_OPENAI_MODEL } from "./openai.js";
import { CLAUDE_MODELS, OPENAI_MODELS } from "./pricing.js";
import { PRESETS } from "./presets.js";
import { asText, validateQuestions } from "./questions.js";
import { speak } from "./speech.js";

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const MAX_STATE_CHARS = 20_000;
const isMock = () => process.env.MOCK === "1";

export function configPayload() {
  return {
    mock: isMock(),
    passcodeRequired: Boolean(process.env.COMPARE_PASSCODE),
    keys: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      typesafe: Boolean(process.env.TYPESAFE_API_KEY),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    },
    defaultModel: DEFAULT_CLAUDE_MODEL,
    models: Object.entries(CLAUDE_MODELS).map(([id, m]) => ({ id, label: m.label })),
    defaultOpenaiModel: DEFAULT_OPENAI_MODEL,
    openaiModels: Object.entries(OPENAI_MODELS).map(([id, m]) => ({ id, label: m.label })),
    efforts: EFFORTS,
    presets: PRESETS,
  };
}

// Runs one side and turns a failure into an error result, so one provider
// failing still shows the other side.
async function settle(fn) {
  try {
    return await fn();
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

function passcodeError(passcode) {
  const required = process.env.COMPARE_PASSCODE;
  if (required && passcode !== required) {
    return { status: 401, body: { error: "Wrong or missing passcode" } };
  }
  return null;
}

// Returns { status, body }.
export async function compare(reqBody, passcode) {
  const denied = passcodeError(passcode);
  if (denied) return denied;

  const {
    state,
    questions,
    model = DEFAULT_CLAUDE_MODEL,
    openaiModel = DEFAULT_OPENAI_MODEL,
    effort = "low",
  } = reqBody || {};
  try {
    if (state == null || state === "") throw new Error("state is required");
    if (asText(state).length > MAX_STATE_CHARS) throw new Error(`state is limited to ${MAX_STATE_CHARS} characters`);
    validateQuestions(questions);
    if (!CLAUDE_MODELS[model]) throw new Error(`unknown model ${model}`);
    if (!OPENAI_MODELS[openaiModel]) throw new Error(`unknown OpenAI model ${openaiModel}`);
    if (!EFFORTS.includes(effort)) throw new Error(`unknown effort ${effort}`);
  } catch (err) {
    return { status: 400, body: { error: err.message } };
  }

  const input = { state, questions, model, openaiModel, effort };
  const [openai, claude, jev] = await Promise.all([
    settle(() => (isMock() ? mockOpenAI(input) : runOpenAI(input))),
    settle(() => (isMock() ? mockClaude(input) : runClaude(input))),
    settle(() => (isMock() ? mockJev(input) : runJev(input))),
  ]);
  return { status: 200, body: { openai, claude, jev } };
}

// Returns { status, body } where body is an MP3 Buffer on success.
export async function speech(reqBody, passcode) {
  const denied = passcodeError(passcode);
  if (denied) return denied;
  try {
    return { status: 200, body: await speak(reqBody || {}), contentType: "audio/mpeg" };
  } catch (err) {
    return { status: err.status || 500, body: { error: err.message } };
  }
}
