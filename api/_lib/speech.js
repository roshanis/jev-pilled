// Text-to-speech through ElevenLabs. Each side gets its own voice so the two
// answers are easy to tell apart when played back.
const API_URL = process.env.ELEVENLABS_API_URL || "https://api.elevenlabs.io";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const MAX_CHARS = 1000;

export const VOICES = {
  claude: process.env.ELEVENLABS_VOICE_CLAUDE || "JBFqnCBsd6RMkjVDRZzb",
  jev: process.env.ELEVENLABS_VOICE_JEV || "21m00Tcm4TlvDq8ikWAM",
  openai: process.env.ELEVENLABS_VOICE_OPENAI || "pNInz6obpgDQGcFmaJgB",
};

export async function speak({ text, side }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw Object.assign(new Error("ELEVENLABS_API_KEY is not set"), { status: 503 });
  if (!VOICES[side]) throw Object.assign(new Error("side must be openai, claude or jev"), { status: 400 });
  if (typeof text !== "string" || !text.trim()) throw Object.assign(new Error("text is required"), { status: 400 });
  if (text.length > MAX_CHARS) throw Object.assign(new Error(`text is limited to ${MAX_CHARS} characters`), { status: 400 });

  const res = await fetch(
    `${API_URL}/v1/text-to-speech/${encodeURIComponent(VOICES[side])}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) {
    // Keep the raw ElevenLabs error in the server log; visitors get a plain line.
    const detail = (await res.text()).slice(0, 300);
    console.error(`ElevenLabs ${res.status}: ${detail}`);
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error("Voice playback isn't available right now."), { status: 503 });
    }
    throw Object.assign(new Error("Couldn't load the voice. Try again in a moment."), { status: 502 });
  }
  return Buffer.from(await res.arrayBuffer());
}
