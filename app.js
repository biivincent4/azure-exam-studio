import { exams, questions } from "./questions.js";
import { filterQuestions, readProgress, statistics } from "./core.js";

const $ = id => document.getElementById(id);
const storageKey = "azure-exam-studio-v1";
let progress = {};
let exam = "AI-103";
let activeId = questions[0].id;
let draftChoice = null;
let storageIssue = "";
try {
  progress = readProgress(localStorage.getItem(storageKey), questions);
} catch {
  storageIssue = "Saved progress could not be read. This session starts fresh; use Reset progress to explicitly clear old data. Browser storage may be unavailable.";
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    storageIssue = "";
  } catch {
    storageIssue = "Progress is available for this session only: browser storage could not be updated.";
  }
}

function filtered() {
  return filterQuestions(questions, progress, {
    exam, domain: $("domain").value, status: $("status").value, search: $("search").value,
  });
}

function showStorageNotice() {
  $("storage-notice").hidden = !storageIssue;
  $("storage-notice").textContent = storageIssue;
}

function renderCards() {
  $("exam-cards").replaceChildren();
  for (const [code, detail] of Object.entries(exams)) {
    const stats = statistics(questions.filter(q => q.exam === code), progress);
    const card = node("button", "exam-card");
    card.type = "button";
    card.setAttribute("aria-pressed", String(exam === code));
    card.setAttribute("aria-label", `${code}: ${detail.name}`);
    const meta = node("div", "exam-meta");
    meta.append(node("span", "exam-code", code), node("span", "level", detail.level));
    const footer = node("div", "exam-stats");
    footer.append(node("span", "", `${stats.answered} / ${stats.total} explored`),
      node("span", "", stats.accuracy === null ? "Ready when you are →" : `${stats.accuracy}% latest-answer accuracy`));
    card.append(meta, node("h3", "", detail.name),
      node("p", "exam-desc", code === "AI-103" ? "Build intelligent apps and capable agents." :
        code === "AI-200" ? "Connect AI to a reliable cloud foundation." : "Design agents that work better together."), footer);
    card.addEventListener("click", () => {
      exam = code;
      $("search").value = "";
      $("status").value = "all";
      renderDomains();
      activeId = questions.find(q => q.exam === exam).id;
      draftChoice = null;
      render();
    });
    $("exam-cards").append(card);
  }
  const stats = statistics(questions, progress);
  $("overall-count").replaceChildren(document.createTextNode(String(stats.answered)), node("span", "", ` / ${stats.total}`));
  $("overall-bar").style.width = `${stats.answered / stats.total * 100}%`;
}

function renderDomains() {
  $("domain").replaceChildren(new Option("All domains", "all"));
  for (const domain of new Set(questions.filter(q => q.exam === exam).map(q => q.domain))) {
    $("domain").append(new Option(domain, domain));
  }
}

function renderList(items) {
  $("result-count").textContent = `${items.length} scenarios`;
  $("question-list").replaceChildren();
  items.forEach((q, index) => {
    const saved = progress[q.id];
    const state = saved ? saved.choice === q.answer ? "correct" : "incorrect" : "";
    const button = node("button", `question-item ${state}`);
    button.type = "button";
    button.setAttribute("aria-current", String(activeId === q.id));
    const label = node("span");
    label.append(node("strong", "", q.title), node("small", "", `${q.module} · ${q.domain}${saved?.bookmarked ? " · Saved" : ""}`));
    button.append(node("span", "question-number", saved ? state === "correct" ? "✓" : "↻" : String(index + 1).padStart(2, "0")), label);
    button.addEventListener("click", () => {
      activeId = q.id; draftChoice = null; render();
    });
    $("question-list").append(button);
  });
  if (!items.length) $("question-list").append(node("p", "empty", "No matches. Try another domain, status or search."));
}

function renderQuestion(items) {
  const panel = $("question-card");
  panel.replaceChildren();
  const q = items.find(item => item.id === activeId);
  if (!q) {
    panel.append(node("h3", "", "A fresh starting point"),
      node("p", "empty", "No questions match these filters. Clear the search or choose All questions to continue."));
    return;
  }
  const saved = progress[q.id];
  const top = node("div", "question-top");
  top.append(node("span", "question-label", `${q.exam} / ${q.module} · ${q.domain}`),
    node("span", "question-counter", `${items.indexOf(q) + 1} of ${items.length}`));
  const heading = node("h3", "", q.title);
  heading.id = "question-title";
  const fieldset = node("fieldset");
  fieldset.setAttribute("aria-labelledby", "question-title");
  q.options.forEach((text, index) => {
    const label = node("label", `option${saved && index === q.answer ? " right" : ""}${saved && saved.choice === index && index !== q.answer ? " wrong" : ""}`);
    const radio = node("input");
    radio.type = "radio";
    radio.name = "answer";
    radio.value = String(index);
    radio.checked = (saved ? saved.choice : draftChoice) === index;
    radio.disabled = !!saved;
    radio.addEventListener("change", () => {
      draftChoice = index;
      $("check-answer").disabled = false;
    });
    label.append(radio, node("span", "option-letter", String.fromCharCode(65 + index)), node("span", "", text));
    fieldset.append(label);
  });
  panel.append(top, heading, node("p", "prompt", q.prompt), fieldset);
  const actions = node("div", "question-actions");
  if (!saved) {
    const check = node("button", "primary", "Check my answer →");
    check.id = "check-answer";
    check.disabled = draftChoice === null;
    check.addEventListener("click", () => {
      if (draftChoice === null) return;
      progress[q.id] = { choice: draftChoice, bookmarked: false };
      persist();
      // Keep this answered question visible until the next navigation/filter event.
      renderCards(); renderList(items); renderQuestion(items); showStorageNotice();
      $("feedback").focus();
    });
    actions.append(check);
  } else {
    const bookmark = node("button", "secondary", saved.bookmarked ? "★ Bookmarked" : "☆ Bookmark answer");
    bookmark.setAttribute("aria-pressed", String(saved.bookmarked));
    bookmark.addEventListener("click", () => {
      saved.bookmarked = !saved.bookmarked; persist();
      renderList(items); renderQuestion(items); showStorageNotice();
    });
    const retry = node("button", "secondary", "Try again");
    retry.addEventListener("click", () => {
      delete progress[q.id]; draftChoice = null; persist();
      renderCards(); renderList(items); renderQuestion(items); showStorageNotice();
    });
    actions.append(bookmark, retry);
  }
  panel.append(actions);
  if (saved) {
    const feedback = node("div", "feedback");
    feedback.id = "feedback";
    feedback.tabIndex = -1;
    feedback.setAttribute("role", "status");
    const source = node("a", "", "Read the supporting Microsoft Learn documentation ↗");
    source.href = q.source;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    feedback.append(node("strong", "", saved.choice === q.answer ? "Correct — here's the reasoning." : "Not quite — let's unpack it."),
      node("p", "", `Best answer: ${q.options[q.answer]}`), node("p", "", q.explanation), source);
    panel.append(feedback);
  }
  const nav = node("div", "navigation");
  for (const [offset, text] of [[-1, "← Previous"], [1, "Next scenario →"]]) {
    const nextIndex = items.indexOf(q) + offset;
    const button = node("button", "quiet", text);
    button.disabled = nextIndex < 0 || nextIndex >= items.length;
    button.addEventListener("click", () => {
      activeId = items[nextIndex].id; draftChoice = null; render();
    });
    nav.append(button);
  }
  panel.append(nav);
}

function render() {
  const items = filtered();
  if (!items.some(q => q.id === activeId)) { activeId = items[0]?.id; draftChoice = null; }
  renderCards(); renderList(items); renderQuestion(items); showStorageNotice();
}

for (const id of ["search", "domain", "status"]) {
  $(id).addEventListener(id === "search" ? "input" : "change", () => { draftChoice = null; render(); });
}
$("reset").addEventListener("click", () => $("reset-dialog").showModal());
$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("confirm-reset").addEventListener("click", () => {
  progress = {}; draftChoice = null;
  try { localStorage.removeItem(storageKey); storageIssue = ""; }
  catch { storageIssue = "Session progress cleared, but saved browser data could not be removed."; }
  $("reset-dialog").close(); render();
});
for (const [code, detail] of Object.entries(exams)) {
  const link = node("a", "", `${code} study guide ↗`);
  link.href = detail.guide; link.target = "_blank"; link.rel = "noopener noreferrer";
  $("resource-links").append(link);
}
$("bank-size").textContent = `${questions.length} original scenarios`;
renderDomains();
render();
