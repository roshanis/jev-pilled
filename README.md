# Jev-pilled

One brief, three AI models. Claude Fable, Codex Astra and Grok were each asked for 100 places
[Jev](https://docs.typesafe.ai/introduction) (TypeSafe AI's decision model) could be used, with an
example for each. This static site explains Jev with diagrams and compares the three guides.

## Pages

| Path | What it is |
|---|---|
| `/` | Plain-language explainer, diagrams, scorecard, same-case comparison |
| `/claude-fable/` | Claude Fable's guide (100 cases, 17 industries) |
| `/codex-astra/` | Codex Astra's guide (100 cases, 20 industries) |
| `/grok/` | Grok's guide (100 cases, 20 industries) |
| `/side-by-side/` | All three in scrollable columns |

The three guides are kept as each model produced them; only a small navigation bar was added at the top.

## Deploy on Vercel

No build step. In Vercel: **Add New → Project → Import** `roshanis/jev-pilled`, set
Framework Preset to **Other**, leave Build Command and Output Directory empty, and deploy.
Every push to `main` redeploys automatically.

## Preview locally

```bash
npx serve .
```
