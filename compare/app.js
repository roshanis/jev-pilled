const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const pct = (p) => `${Math.round(p * 100)}%`;
const fmtUsd = (v) =>
  v == null ? "–" : v === 0 ? "$0" : v < 0.0001 ? `$${v.toExponential(2)}` : `$${v.toFixed(v < 0.01 ? 5 : 4)}`;

let config;
let lastRun = null;
let audio = null;

async function init() {
  config = await (await fetch("/api/config")).json();

  const banner = $("#banner");
  const missing = [];
  if (!config.keys.anthropic) missing.push("ANTHROPIC_API_KEY");
  if (!config.keys.typesafe) missing.push("TYPESAFE_API_KEY");
  if (config.mock) {
    banner.textContent = "Mock mode: answers below are random placeholders, not real model output.";
    banner.hidden = false;
  } else if (missing.length) {
    banner.textContent = `Missing ${missing.join(" and ")} in .env, so that side will show an error.`;
    banner.hidden = false;
  }

  $("#passcodeRow").hidden = !config.passcodeRequired;
  try {
    $("#passcode").value = sessionStorage.getItem("comparePasscode") || "";
  } catch {
    /* storage unavailable */
  }

  const preset = $("#preset");
  for (const p of config.presets) preset.append(new Option(p.label, p.id));
  preset.append(new Option("Custom", "custom"));
  preset.addEventListener("change", () => loadPreset(preset.value));

  for (const m of config.models) $("#model").append(new Option(m.label, m.id, false, m.id === config.defaultModel));
  for (const e of config.efforts) $("#effort").append(new Option(e, e, false, e === "low"));

  for (const b of document.querySelectorAll(".listen")) b.addEventListener("click", () => listen(b));

  loadPreset(config.presets[0].id);
  $("#run").addEventListener("click", run);
}

function loadPreset(id) {
  const p = config.presets.find((x) => x.id === id);
  if (!p) return;
  $("#state").value = typeof p.state === "string" ? p.state : JSON.stringify(p.state, null, 2);
  $("#questions").value = JSON.stringify(p.questions, null, 2);
}

function readState(raw) {
  const t = raw.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {
      /* not JSON, send as text */
    }
  }
  return raw;
}

async function run() {
  const btn = $("#run");
  const formError = $("#formError");
  formError.textContent = "";

  let questions;
  try {
    questions = JSON.parse($("#questions").value);
  } catch (e) {
    formError.textContent = `Questions are not valid JSON: ${e.message}`;
    return;
  }

  const passcode = $("#passcode").value;
  try {
    sessionStorage.setItem("comparePasscode", passcode);
  } catch {
    /* storage unavailable */
  }

  btn.disabled = true;
  btn.textContent = "Running…";
  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Compare-Passcode": passcode },
      body: JSON.stringify({
        state: readState($("#state").value),
        questions,
        model: $("#model").value,
        effort: $("#effort").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    render(questions, data);
  } catch (e) {
    formError.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Run both";
  }
}

function renderStats(side, r) {
  const col = $(`.stat-col[data-side="${side}"]`);
  $(".model-name", col).textContent = r.model ? `· ${r.model}` : "";
  $(".latency", col).textContent = r.latencyMs != null ? `${r.latencyMs.toLocaleString()} ms` : "–";
  $(".tokens", col).textContent = r.usage ? `${r.usage.input_tokens} / ${r.usage.output_tokens}` : "–";
  $(".cost", col).textContent = fmtUsd(r.costUsd);
  $(".side-error", col).textContent = r.error || "";
}

function bars(probabilities, labels, top) {
  const wrap = el("div");
  for (const [key, p] of Object.entries(probabilities)) {
    const row = el("div", "bar" + (key === top ? " top" : ""));
    const lbl = el("span", "lbl", labels?.[key] ?? key);
    lbl.title = labels?.[key] ?? key;
    const track = el("span", "track");
    const fill = el("span", "fill");
    fill.style.width = pct(p);
    track.append(fill);
    row.append(lbl, track, el("span", "pct", pct(p)));
    wrap.append(row);
  }
  return wrap;
}

function renderAnswer(q, a) {
  const box = el("div");
  if (!a) {
    box.append(el("p", "na", "No answer"));
    return box;
  }
  if (a.type === "noul") {
    const v = el("div", "verdict", a.noul >= 0.5 ? "Yes " : "No ");
    v.append(el("small", null, `p(yes) = ${a.noul.toFixed(3)}`));
    box.append(v, bars({ yes: a.noul, no: 1 - a.noul }, null, a.noul >= 0.5 ? "yes" : "no"));
  } else if (a.type === "choice") {
    const v = el("div", "verdict", `${a.choice} `);
    if (a.confidence != null) v.append(el("small", null, `confidence ${pct(a.confidence)}`));
    box.append(v, bars(a.probabilities || { [a.choice]: 1 }, null, a.choice));
  } else if (a.type === "score") {
    const legend = a.legend || Object.fromEntries(q.criteria.map((c, i) => [String(i), String(c)]));
    const nearest = String(Math.round(a.score));
    const v = el("div", "verdict", `${a.score.toFixed(2)} `);
    v.append(el("small", null, `≈ ${legend[nearest] ?? nearest}${a.confidence != null ? ` · confidence ${pct(a.confidence)}` : ""}`));
    const labels = Object.fromEntries(Object.entries(legend).map(([k, d]) => [k, `${k} · ${d}`]));
    box.append(v, bars(a.probabilities || {}, labels, nearest));
  }
  return box;
}

// Returns true/false for agreement, or null when either side has no answer.
function agrees(q, c, j) {
  if (!c || !j) return null;
  if (q.type === "noul") return c.noul >= 0.5 === j.noul >= 0.5;
  if (q.type === "choice") return c.choice === j.choice;
  return Math.round(c.score) === Math.round(j.score);
}

function render(questions, { claude, jev }) {
  lastRun = { questions, claude, jev };
  stopAudio();
  $("#results").hidden = false;
  for (const [side, r] of [["claude", claude], ["jev", jev]]) {
    $(`.listen[data-side="${side}"]`).hidden = !config.keys.elevenlabs || Boolean(r.error);
  }
  renderStats("claude", claude);
  renderStats("jev", jev);

  const list = $("#answers");
  list.replaceChildren();
  let agreeCount = 0;
  let compared = 0;

  for (const [name, q] of Object.entries(questions)) {
    const c = claude.answers?.[name];
    const j = jev.answers?.[name];
    const card = el("article", "q-card");
    const head = el("div", "q-head");
    const h = el("h3", null, name);
    h.append(el("span", "type", q.type));
    head.append(h);
    const ok = agrees(q, c, j);
    if (ok != null) {
      compared++;
      if (ok) agreeCount++;
      head.append(el("span", `pill ${ok ? "agree" : "disagree"}`, ok ? "Agree" : "Disagree"));
    }
    card.append(head);
    card.append(el("p", "q-instr", typeof q.instructions === "string" ? q.instructions : JSON.stringify(q.instructions)));

    const sides = el("div", "q-sides");
    for (const [side, label, a, r] of [["claude", "Claude", c, claude], ["jev", "Jev", j, jev]]) {
      const s = el("div", "side");
      s.dataset.side = side;
      s.append(el("h4", null, label));
      s.append(r.error ? el("p", "na", "Request failed, see error above") : renderAnswer(q, a));
      sides.append(s);
    }
    card.append(sides);
    list.append(card);
  }

  const parts = [];
  if (compared) parts.push(`They agree on ${agreeCount} of ${compared} question${compared === 1 ? "" : "s"}.`);
  if (claude.latencyMs && jev.latencyMs) {
    const ratio = claude.latencyMs / jev.latencyMs;
    parts.push(ratio >= 1 ? `Jev was ${ratio.toFixed(1)}× faster.` : `Claude was ${(1 / ratio).toFixed(1)}× faster.`);
  }
  if (claude.costUsd && jev.costUsd) {
    parts.push(`Claude cost ${Math.round(claude.costUsd / jev.costUsd).toLocaleString()}× as much for this run.`);
  }
  $("#summary").textContent = parts.join(" ");

  $("#reasoningBox").hidden = !claude.reasoning;
  $("#reasoning").textContent = claude.reasoning || "";
}

// A short spoken summary of one side's answers.
function speechText(side) {
  const { questions } = lastRun;
  const r = lastRun[side];
  const lines = [`${side === "claude" ? "Claude" : "Jev"} says.`];
  for (const [name, q] of Object.entries(questions)) {
    const a = r.answers?.[name];
    if (!a) continue;
    const label = name.replace(/[_-]+/g, " ");
    if (a.type === "choice") {
      lines.push(`${label}: ${a.choice.replace(/[_-]+/g, " ")}, ${pct(a.confidence ?? a.probabilities?.[a.choice] ?? 1)} confident.`);
    } else if (a.type === "score") {
      const legend = a.legend || Object.fromEntries(q.criteria.map((c, i) => [String(i), String(c)]));
      lines.push(`${label}: ${legend[String(Math.round(a.score))] ?? ""}, score ${a.score.toFixed(1)}.`);
    } else if (a.type === "noul") {
      lines.push(`${label}: ${a.noul >= 0.5 ? "yes" : "no"}, ${pct(a.noul)} chance of yes.`);
    }
  }
  let text = lines.join(" ");
  if (r.reasoning) text += ` Reasoning: ${r.reasoning}`;
  return text.length > 1000 ? text.slice(0, 997) + "..." : text;
}

function stopAudio() {
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = null;
  }
  for (const b of document.querySelectorAll(".listen")) {
    b.classList.remove("playing");
    b.innerHTML = "&#9654; Listen";
  }
}

async function listen(btn) {
  const side = btn.dataset.side;
  const wasPlaying = btn.classList.contains("playing");
  stopAudio();
  if (wasPlaying || !lastRun) return;

  const errBox = $(`.stat-col[data-side="${side}"] .side-error`);
  errBox.textContent = "";
  btn.disabled = true;
  btn.textContent = "Loading…";
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Compare-Passcode": $("#passcode").value },
      body: JSON.stringify({ side, text: speechText(side) }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    audio = new Audio(URL.createObjectURL(await res.blob()));
    audio.addEventListener("ended", stopAudio);
    await audio.play();
    btn.classList.add("playing");
    btn.innerHTML = "&#9632; Stop";
  } catch (e) {
    errBox.textContent = `Voice: ${e.message}`;
    btn.innerHTML = "&#9654; Listen";
  } finally {
    btn.disabled = false;
  }
}

init();
