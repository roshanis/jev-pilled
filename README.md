# Jev-pilled

One brief, three AI models. Claude Fable, Codex Astra and Grok were each asked for 100 places
[Jev](https://docs.typesafe.ai/introduction) (TypeSafe AI's decision model) could be used, with an
example for each. This static site explains Jev with diagrams and compares the three guides.

## Pages

| Path | What it is |
|---|---|
| `/` | Live comparison: send the same task to OpenAI, Claude and Jev and see the three answers side by side, then links to the 100-example guides |
| `/more/` | Plain-language explainer, diagrams, scorecard, same-case comparison |
| `/claude-fable/` | Claude Fable's guide (100 cases, 17 industries) |
| `/codex-astra/` | Codex Astra's guide (100 cases, 20 industries) |
| `/grok/` | Grok's guide (100 cases, 20 industries) |
| `/side-by-side/` | All three in scrollable columns |
| `/compare/` | Old address of the live comparison; redirects to `/` |

The three guides are kept as each model produced them; only a small navigation bar was added at the top.

## OpenAI vs Claude vs Jev live comparison (`/`)

Jev doesn't write text: you give it a **state** (text or JSON) and typed questions (`choice`, `score`, `noul`), and it returns calibrated probabilities. The compare page sends the same state and questions to Jev unchanged, and to OpenAI and Claude as the same structured-output request asking for a probability per option. Their answers are converted into Jev's response shape, so the page shows a TL;DR (where they agreed, which was fastest and cheapest) and one table with each model's answer and confidence per question, with disagreements highlighted. Four example tasks are built in (ticket triage, review sentiment, an LLM guardrail, smart-home intent routing); the models, effort and questions JSON are under **Advanced**.

**Images.** Jev 1.14 added image input (experimental, opt-in), so a task can carry one picture. Three image examples are built in (an expense receipt, a phishing screenshot, a parking sign), and **Add image** takes your own PNG or JPEG (paste and drag-and-drop work too). The page fits it within Jev's 256 to 1,568 px limits and sends the same JPEG to all three: Jev gets it through the `assets` map with the `TypeSafe-Danger-Zone-Images: true` header on `jev-preview`, OpenAI as an `input_image`, and Claude as an `image` block. Any text in the box goes along as notes.

The page calls three serverless routes, `api/config.js`, `api/compare.js` and `api/speak.js`; shared logic lives in `api/_lib/`.

| Env var | Needed for |
|---|---|
| `OPENAI_API_KEY` | the OpenAI side |
| `ANTHROPIC_API_KEY` | the Claude side |
| `TYPESAFE_API_KEY` | the Jev side (keys come from the TypeSafe console) |
| `ELEVENLABS_API_KEY` | optional; adds a **Listen** button to each side that reads that model's answers aloud through ElevenLabs, in a different voice per side (`ELEVENLABS_VOICE_OPENAI`, `ELEVENLABS_VOICE_CLAUDE`, `ELEVENLABS_VOICE_JEV` to change them) |
| `OPENAI_MODEL` | optional default OpenAI model (`gpt-6-luna`; GPT-6.1 Sol is selectable on the page) |
| `CLAUDE_MODEL` | optional default Claude model (`claude-haiku-5-5`; Opus 5.5 and Sonnet 5.5 are selectable on the page) |
| `TYPESAFE_IMAGE_MODEL` | optional Jev model for image tasks (`jev-preview`, where Jev 1.14 ships) |
| `MOCK=1` | optional; random placeholder answers, no API calls |

Run it locally:

```bash
npm install
cp .env.example .env    # add your keys
npm start               # http://localhost:3000/
```

`npm run mock` runs the page without keys, and `npm test` runs the unit tests.

## Deploy on Vercel

No build step. In Vercel: **Add New → Project → Import** `roshanis/jev-pilled`, set
Framework Preset to **Other**, leave Build Command and Output Directory empty, and deploy.
For the compare page, add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, and optionally `ELEVENLABS_API_KEY` under
**Settings → Environment Variables**. Every push to `main` redeploys automatically.

## Preview locally

```bash
npx serve .      # static pages only
npm start        # static pages plus the compare API (see above)
```
