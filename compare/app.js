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

  $("#passcode").hidden = !config.passcodeRequired;
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

  for (const id of ["#openaiModel", "#model"]) $(id).addEventListener("change", showModels);
  showModels();

  for (const b of document.querySelectorAll(".listen")) b.addEventListener("click", () => listen(b));


  loadPreset(config.presets[0].id);
  $("#run").addEventListener("click", run);
}

const selectedLabel = (id) => $(id).selectedOptions[0]?.textContent ?? $(id).value;

// Names the models that will answer, under the Run button and in the table header.
function showModels() {
  const names = { openai: selectedLabel("#openaiModel"), claude: selectedLabel("#model"), jev: "Jev (jev-latest)" };
  $("#modelLine").textContent = `Compares ${names.openai}, ${names.claude} and ${names.jev}. Change models under Advanced.`;
  for (const [side] of SIDES) $(`.side-head[data-side="${side}"] .model-name`).textContent = names[side].replace(/^(Claude|Jev) /, "");
}

// The display name for a model id a provider reported, e.g. "claude-haiku-5-5" -> "Haiku 5.5".
function modelLabel(id) {
  const known = [...config.openaiModels, ...config.models].find((m) => id.startsWith(m.id));
  return known ? known.label.replace(/^Claude /, "") + (id.endsWith("(mock)") ? " (mock)" : "") : id;
}

function loadPreset(id) {
  const p = config.presets.find((x) => x.id === id);
  if (!p) return;
  for (const b of $("#presetTabs").children) b.setAttribute("aria-selected", String(b.dataset.id === id));
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
    $(".run-label", btn).textContent = "Run";
    results.classList.remove("loading");
  }
}

function renderStats(side, r) {
  const head = $(`.side-head[data-side="${side}"]`);
  if (r.model) $(".model-name", head).textContent = modelLabel(r.model);
  const line = $(".stat-line", head);
  line.textContent = r.error ? "" : `${fmtMs(r.latencyMs)} · ${fmtUsd(r.costUsd)}`;
  line.title = r.error
    ? ""
    : `${r.model}: ${r.usage?.input_tokens ?? "?"} input and ${r.usage?.output_tokens ?? "?"} output tokens`;
  $(".side-error", head).textContent = r.error ? "Failed" : "";
}

// The headline answer and how sure the model was, e.g. ["account", 0.76].
function answerText(q, a) {
  if (a.type === "noul") return [a.noul >= 0.5 ? "Yes" : "No", Math.max(a.noul, 1 - a.noul)];
  if (a.type === "choice") return [a.choice.replace(/_/g, " "), a.confidence ?? a.probabilities?.[a.choice]];
  const legend = a.legend || Object.fromEntries(q.criteria.map((c, i) => [String(i), String(c)]));
  const nearest = String(Math.round(a.score));
  return [legend[nearest] ?? nearest, a.confidence];
}

// The headline answer used to decide whether sides agree.
function verdictKey(q, a) {
  if (q.type === "noul") return a.noul >= 0.5 ? "yes" : "no";
  if (q.type === "choice") return a.choice;
  return String(Math.round(a.score));
}

// Returns { cls, text, odd } describing agreement, or null with fewer than two answers.
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

  const body = $("#answers");
  body.replaceChildren();
  let allAgree = 0;
  let compared = 0;
  const splits = [];

  for (const [name, q] of Object.entries(questions)) {
    const label = name.replace(/_/g, " ");
    const bySide = Object.fromEntries(SIDES.map(([side]) => [side, results[side].answers?.[name]]));
    const ag = agreement(q, bySide);
    if (ag) {
      compared++;
      if (ag.cls === "agree") allAgree++;
      else splits.push(`${label} (${ag.odd ? ag.text : ag.text.toLowerCase()})`);
    }

    const row = el("tr", ag && ag.cls !== "agree" ? "split" : null);
    const th = el("th", null, label);
    th.scope = "row";
    if (typeof q.instructions === "string") th.title = q.instructions;
    row.append(th);
    for (const [side, sideLabel] of SIDES) {
      const td = el("td", ag?.odd === side ? "odd" : null);
      td.dataset.side = side;
      td.dataset.label = sideLabel;
      const a = bySide[side];
      if (!a) {
        td.append(el("span", "na", "–"));
      } else {
        const [text, conf] = answerText(q, a);
        td.append(el("span", "verdict", text));
        if (conf != null) td.append(el("span", "conf", pct(conf)));
      }
      row.append(td);
    }
    body.append(row);
  }

  const ok = SIDES.filter(([side]) => !results[side].error);
  renderTldr(ok, results, { allAgree, compared, splits });

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

// A plain-words recap built from the results: agreement, speed, cost, failures.
function renderTldr(ok, results, { allAgree, compared, splits }) {
  const lines = [];
  if (compared) {
    const who = ok.length === 3 ? "All three models" : "The models that answered";
    if (allAgree === compared) {
      lines.push(`${who} gave the same answer to ${compared === 1 ? "the question" : `all ${compared} questions`}.`);
    } else {
      lines.push(`${who} agreed on ${allAgree} of ${compared} questions and split on ${listText(splits)}.`);
    }
  }
  if (ok.length >= 2) {
    const ranked = (key, fmt) => {
      const sorted = [...ok].sort((a, b) => (results[a[0]][key] ?? Infinity) - (results[b[0]][key] ?? Infinity));
      const [[lead, leadLabel], ...rest] = sorted;
      return `${leadLabel} at ${fmt(results[lead][key])} (${rest.map(([s, l]) => `${l} ${fmt(results[s][key])}`).join(", ")})`;
    };
    lines.push(`Fastest: ${ranked("latencyMs", fmtMs)}.`);
    lines.push(`Cheapest: ${ranked("costUsd", fmtUsd)}.`);
  }
  for (const [side, label] of SIDES) {
    if (results[side].error) lines.push(`${label} failed: ${results[side].error}`);
  }
  const box = $("#tldr");
  box.querySelector("ul").replaceChildren(...lines.map((t) => el("li", null, t)));
  box.hidden = lines.length === 0;
}

// "a", "a and b", "a, b and c".
function listText(items) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
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
  for (const id of ["#openaiModel", "#model"]) $(id).addEventListener("change", showModels);
  showModels();

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

  const errBox = $(`.side-head[data-side="${side}"] .side-error`);
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

// Fade and slide sections in as they scroll into view. Without JS, or with
// reduced motion, everything just shows.
function revealOnScroll() {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const groups = [".sys", ".facts li", ".sys-note", ".live > *", ".composer", ".pilled > h2", ".pilled > .lede", ".example-card", ".more-links"];
  const items = [];
  for (const sel of groups) {
    document.querySelectorAll(sel).forEach((node, i) => {
      node.classList.add("reveal");
      node.style.transitionDelay = `${Math.min(i, 4) * 80}ms`;
      items.push(node);
    });
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  items.forEach((n) => io.observe(n));
}

revealOnScroll();
init();
