const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const pct = (p) => `${Math.round(p * 100)}%`;
const fmtUsd = (v) =>
  v == null ? "–" : v === 0 ? "$0" : `$${v.toLocaleString("en-US", { maximumSignificantDigits: 2, maximumFractionDigits: 10 })}`;

const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s` : `${ms} ms`);

const SIDES = [
  ["openai", "OpenAI"],
  ["claude", "Claude"],
  ["jev", "Jev"],
];
const LABEL = Object.fromEntries(SIDES);

let config;
let lastRun = null;
let audio = null;

async function init() {
  config = await (await fetch("/api/config")).json();

  const banner = $("#banner");
  const missing = [];
  if (!config.keys.openai) missing.push("OPENAI_API_KEY");
  if (!config.keys.anthropic) missing.push("ANTHROPIC_API_KEY");
  if (!config.keys.typesafe) missing.push("TYPESAFE_API_KEY");
  if (config.mock) {
    banner.textContent = "Mock mode: answers below are random placeholders, not real model output.";
    banner.hidden = false;
  } else if (missing.length) {
    banner.textContent = `Missing ${missing.join(", ")} in .env, so ${missing.length === 1 ? "that side" : "those sides"} will show an error.`;
    banner.hidden = false;
  }

  $("#passcodeRow").hidden = !config.passcodeRequired;
  try {
    $("#passcode").value = sessionStorage.getItem("comparePasscode") || "";
  } catch {
    /* storage unavailable */
  }

  const tabs = $("#presetTabs");
  for (const p of config.presets) {
    const b = el("button", null, p.label);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.id = p.id;
    b.addEventListener("click", () => loadPreset(p.id));
    tabs.append(b);
  }

  for (const m of config.openaiModels) {
    $("#openaiModel").append(new Option(m.label, m.id, false, m.id === config.defaultOpenaiModel));
  }
  for (const m of config.models) $("#model").append(new Option(m.label, m.id, false, m.id === config.defaultModel));
  for (const e of config.efforts) $("#effort").append(new Option(e, e, false, e === "low"));

  for (const b of document.querySelectorAll(".listen")) b.addEventListener("click", () => listen(b));

  $("#questions").addEventListener("input", summarizeQuestions);
  $("#showProbs").addEventListener("change", (e) => $("#results").classList.toggle("show-probs", e.target.checked));

  loadPreset(config.presets[0].id);
  $("#run").addEventListener("click", run);
}

function loadPreset(id) {
  const p = config.presets.find((x) => x.id === id);
  if (!p) return;
  for (const b of $("#presetTabs").children) b.setAttribute("aria-selected", String(b.dataset.id === id));
  $("#state").value = typeof p.state === "string" ? p.state : JSON.stringify(p.state, null, 2);
  $("#questions").value = JSON.stringify(p.questions, null, 2);
  summarizeQuestions();
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

  const results = $("#results");
  const firstRun = results.hidden;
  btn.disabled = true;
  btn.classList.add("loading");
  $(".run-label", btn).textContent = "Running…";
  results.hidden = false;
  results.classList.add("loading");
  if (firstRun) results.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Compare-Passcode": passcode },
      body: JSON.stringify({
        state: readState($("#state").value),
        questions,
        model: $("#model").value,
        openaiModel: $("#openaiModel").value,
        effort: $("#effort").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    render(questions, data);
  } catch (e) {
    formError.textContent = e.message;
    if (firstRun) results.hidden = true;
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    $(".run-label", btn).textContent = "Run all three";
    results.classList.remove("loading");
  }
}

function renderStats(side, r) {
  const col = $(`.side-card[data-side="${side}"]`);
  const line = $(".stat-line", col);
  line.textContent = r.error ? "" : `${fmtMs(r.latencyMs)} · ${fmtUsd(r.costUsd)}`;
  line.title = r.error
    ? ""
    : `${r.model}: ${r.usage?.input_tokens ?? "?"} input and ${r.usage?.output_tokens ?? "?"} output tokens`;
  $(".badges", col).replaceChildren();
  $(".side-error", col).textContent = r.error || "";
}

// One line under the input listing what the questions ask, e.g. "department · urgency (1–4) · refund requested?".
function summarizeQuestions() {
  const out = $("#questionSummary");
  try {
    const qs = JSON.parse($("#questions").value);
    out.textContent = Object.entries(qs)
      .map(([name, q]) => {
        const label = name.replace(/_/g, " ");
        if (q.type === "noul") return `${label}?`;
        if (q.type === "score") return `${label} (scale of ${q.criteria?.length ?? "?"})`;
        return `${label} (${Object.keys(q.criteria || {}).length} options)`;
      })
      .join(" · ");
    out.classList.remove("bad");
  } catch {
    out.textContent = "questions are not valid JSON";
    out.classList.add("bad");
  }
}

function bars(probabilities, labels, top) {
  const wrap = el("div", "bars");
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
    box.append(el("div", "verdict", a.noul >= 0.5 ? "Yes" : "No"));
    box.append(el("div", "verdict-sub", `${pct(a.noul)} chance of yes`));
    box.append(bars({ yes: a.noul, no: 1 - a.noul }, null, a.noul >= 0.5 ? "yes" : "no"));
  } else if (a.type === "choice") {
    box.append(el("div", "verdict", a.choice.replace(/_/g, " ")));
    box.append(el("div", "verdict-sub", a.confidence != null ? `${pct(a.confidence)} confident` : "\u00a0"));
    box.append(bars(a.probabilities || { [a.choice]: 1 }, null, a.choice));
  } else if (a.type === "score") {
    const legend = a.legend || Object.fromEntries(q.criteria.map((c, i) => [String(i), String(c)]));
    const nearest = String(Math.round(a.score));
    box.append(el("div", "verdict", legend[nearest] ?? nearest));
    box.append(el("div", "verdict-sub", `score ${a.score.toFixed(2)} of ${q.criteria.length - 1}${a.confidence != null ? ` · ${pct(a.confidence)} confident` : ""}`));
    const labels = Object.fromEntries(Object.entries(legend).map(([k, d]) => [k, `${k} · ${d}`]));
    box.append(bars(a.probabilities || {}, labels, nearest));
  }
  return box;
}

// The headline answer used to decide whether sides agree.
function verdictKey(q, a) {
  if (q.type === "noul") return a.noul >= 0.5 ? "yes" : "no";
  if (q.type === "choice") return a.choice;
  return String(Math.round(a.score));
}

// Returns { cls, text } for the agreement pill, or null with fewer than two answers.
function agreement(q, answersBySide) {
  const present = Object.entries(answersBySide).filter(([, a]) => a);
  if (present.length < 2) return null;
  const groups = {};
  for (const [side, a] of present) (groups[verdictKey(q, a)] ??= []).push(side);
  const sizes = Object.values(groups);
  if (sizes.length === 1) return { cls: "agree", text: present.length === 3 ? "All agree" : "Agree" };
  if (present.length === 3 && sizes.length === 2) {
    const odd = sizes.find((g) => g.length === 1)[0];
    return { cls: "partial", text: `${LABEL[odd]} differs`, odd };
  }
  return { cls: "disagree", text: present.length === 3 ? "All differ" : "Disagree" };
}

function render(questions, results) {
  lastRun = { questions, ...results };
  stopAudio();
  $("#results").hidden = false;
  for (const [side] of SIDES) {
    const r = results[side] || { error: "No result" };
    results[side] = r;
    renderStats(side, r);
    $(`.listen[data-side="${side}"]`).hidden = !config.keys.elevenlabs || Boolean(r.error);
  }

  const list = $("#answers");
  list.replaceChildren();
  let allAgree = 0;
  let compared = 0;

  for (const [name, q] of Object.entries(questions)) {
    const bySide = Object.fromEntries(SIDES.map(([side]) => [side, results[side].answers?.[name]]));
    const card = el("article", "q-card");
    const head = el("div", "q-head");
    const title = el("div", "q-title");
    title.append(el("h3", null, name.replace(/_/g, " ")), el("span", "type", q.type === "noul" ? "yes / no" : q.type));
    head.append(title);
    const ag = agreement(q, bySide);
    if (ag) {
      compared++;
      if (ag.cls === "agree") allAgree++;
      head.append(el("span", `pill ${ag.cls}`, ag.text));
    }
    card.append(head);
    card.append(el("p", "q-instr", typeof q.instructions === "string" ? q.instructions : JSON.stringify(q.instructions)));

    const sides = el("div", "q-sides");
    for (const [side, label] of SIDES) {
      const s = el("div", "side" + (ag?.odd === side ? " odd" : ""));
      s.dataset.side = side;
      s.append(el("h4", null, label));
      s.append(results[side].error ? el("p", "na", "No answer: the request failed (see above).") : renderAnswer(q, bySide[side]));
      sides.append(s);
    }
    card.append(sides);
    list.append(card);
  }

  const ok = SIDES.filter(([side]) => !results[side].error);
  markLeaders(ok, results);
  const summary = $("#summary");
  summary.replaceChildren();
  if (compared) {
    summary.append(
      el("b", null, `${ok.length === 3 ? "All three" : "They"} agree on ${allAgree} of ${compared} question${compared === 1 ? "" : "s"}.`),
    );
  }
  const jev = results.jev;
  const others = ok.filter(([side]) => side !== "jev");
  if (!jev.error && others.length) {
    const speed = others.map(([side, label]) => ratioText(results[side].latencyMs / jev.latencyMs, label, "faster", "slower"));
    const cost = others.map(([side, label]) => ratioText(results[side].costUsd / jev.costUsd, label, "cheaper", "more expensive"));
    summary.append(` Jev was ${speed.join(" and ")}, and ${cost.join(" and ")}.`);
  }
  summary.hidden = summary.childNodes.length === 0;

  const box = $("#reasoning");
  box.replaceChildren();
  for (const [side, label] of SIDES) {
    if (!results[side].reasoning) continue;
    const card = el("article", "reason");
    card.dataset.side = side;
    card.append(el("h3", null, label), el("p", null, results[side].reasoning));
    box.append(card);
  }
  $("#reasoningBox").hidden = box.childElementCount === 0;
}

// "3.2× faster than Claude" when ratio > 1, "2.0× slower than Claude" otherwise.
function ratioText(ratio, label, better, worse) {
  if (!Number.isFinite(ratio) || ratio <= 0) return `not comparable with ${label}`;
  if (ratio >= 1) return `${ratio >= 10 ? Math.round(ratio).toLocaleString() : ratio.toFixed(1)}× ${better} than ${label}`;
  const inv = 1 / ratio;
  return `${inv >= 10 ? Math.round(inv).toLocaleString() : inv.toFixed(1)}× ${worse} than ${label}`;
}

// Adds "Fastest" and "Cheapest" badges to the leading side cards.
function markLeaders(ok, results) {
  if (ok.length < 2) return;
  const best = (key) => ok.reduce((a, b) => ((results[b[0]][key] ?? Infinity) < (results[a[0]][key] ?? Infinity) ? b : a))[0];
  for (const [key, text] of [["latencyMs", "Fastest"], ["costUsd", "Cheapest"]]) {
    $(`.side-card[data-side="${best(key)}"] .badges`).append(el("span", "badge", text));
  }
}

// A short spoken summary of one side's answers.
function speechText(side) {
  const { questions } = lastRun;
  const r = lastRun[side];
  const lines = [`${LABEL[side]} says.`];
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

  const errBox = $(`.side-card[data-side="${side}"] .side-error`);
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
