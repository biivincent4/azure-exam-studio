import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { questions, exams } from "./questions.js";
import { filterQuestions, readProgress, statistics } from "./core.js";

const publicAssets = [
  "index.html", "styles.css", "app.js", "core.js", "questions.js",
  "bank-ai103.js", "bank-ai200.js", "bank-ai500.js",
];
const moduleDomains = {
  "AI-103": [
    ["Planning & management", ["A1", "A2", "A3", "A4"]],
    ["Generative AI & agents", ["A5", "A6", "A7"]],
    ["Computer vision", ["A8", "A9", "A10"]],
    ["Text analysis", ["A11", "A12"]],
    ["Information extraction", ["A13", "A14"]],
  ],
  "AI-200": [
    ["Containers", ["B1", "B2"]],
    ["Data services", ["B3", "B4", "B5"]],
    ["Services & events", ["B6", "B7"]],
    ["Security & observability", ["B8", "B9"]],
  ],
  "AI-500": [
    ["Architecture", ["C1", "C2"]],
    ["Development", ["C3", "C4", "C5", "C6"]],
    ["Evaluation & operations", ["C7", "C8", "C9"]],
    ["Security & deployment", ["C10", "C11", "C12"]],
  ],
};

test("450 original scenarios, exactly 150 per certification, cover all 35 study modules", () => {
  assert.equal(questions.length, 450);
  assert.equal(new Set(questions.map(q => q.id)).size, 450);
  assert.equal(new Set(questions.map(q => q.module)).size, 35);
  for (const exam of Object.keys(exams)) assert.equal(questions.filter(q => q.exam === exam).length, 150);
  for (const q of questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    for (const option of q.options) assert.ok(typeof option === "string" && option.trim().length > 5, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
    assert.ok(q.title.trim().length > 3 && q.prompt.length > 40 && q.explanation.length > 50, q.id);
    const source = new URL(q.source);
    assert.equal(source.hostname, "learn.microsoft.com", q.id);
    assert.equal(source.protocol, "https:", q.id);
  }
});
test("every module has multiple scenarios and stays in its intended exam domain", () => {
  for (const [exam, domains] of Object.entries(moduleDomains)) {
    for (const [domain, modules] of domains) {
      for (const module of modules) {
        const items = questions.filter(q => q.exam === exam && q.module === module);
        assert.ok(items.length >= 5, `${exam} ${module} needs at least five scenarios`);
        assert.ok(items.every(q => q.domain === domain), `${exam} ${module} domain mismatch`);
      }
    }
    const knownModules = domains.flatMap(([, modules]) => modules);
    assert.ok(questions.filter(q => q.exam === exam).every(q => knownModules.includes(q.module)));
  }
});
test("question prompts are distinct and titles are distinct within each certification", () => {
  const normalize = text => text.trim().toLowerCase().replace(/\s+/g, " ");
  assert.equal(new Set(questions.map(q => normalize(q.prompt))).size, 450);
  for (const exam of Object.keys(exams)) {
    assert.equal(new Set(questions.filter(q => q.exam === exam).map(q => normalize(q.title))).size, 150, exam);
  }
});
test("original question IDs, choices and answer mappings remain backward compatible", () => {
  const original = questions.filter(q => !q.id.includes("-extra-"));
  assert.equal(original.length, 45);
  assert.equal(createHash("sha256").update(JSON.stringify(original)).digest("hex"),
    "312f0d8782ab297643d4809ec6d5fb528a28b18fd164fb6d29ff6b2e22c906b9");
});
test("options distribute correct answers rather than always using the first", () => {
  assert.deepEqual([...new Set(questions.map(q => q.answer))].sort(), [0, 1, 2, 3]);
});
test("filter composition: exam, domain, search, new, missed, saved", () => {
  const q = questions[0];
  const progress = { [q.id]: { choice: (q.answer + 1) % 4, bookmarked: true } };
  const base = { exam: q.exam, domain: q.domain, status: "all", search: q.title };
  assert.deepEqual(filterQuestions(questions, progress, base), [q]);
  assert.equal(filterQuestions(questions, progress, { ...base, status: "new" }).length, 0);
  assert.deepEqual(filterQuestions(questions, progress, { ...base, status: "missed" }), [q]);
  assert.deepEqual(filterQuestions(questions, progress, { ...base, status: "saved" }), [q]);
  assert.equal(filterQuestions(questions, progress, { ...base, exam: "AI-500" }).length, 0);
});
test("stats count only answered questions and do not imply a readiness score", () => {
  assert.equal(statistics(questions, {}).accuracy, null);
  const progress = { [questions[0].id]: { choice: questions[0].answer, bookmarked: false } };
  assert.deepEqual(statistics(questions, progress), { total: 450, answered: 1, correct: 1, accuracy: 100 });
});
test("the complete larger bank filters, restores progress, bookmarks and counts accurately", () => {
  const progress = Object.fromEntries(questions.map((q, index) => [
    q.id, { choice: index % 2 ? q.answer : (q.answer + 1) % 4, bookmarked: index % 3 === 0 },
  ]));
  assert.deepEqual(readProgress(JSON.stringify(progress), questions), progress);
  assert.deepEqual(statistics(questions, progress), { total: 450, answered: 450, correct: 225, accuracy: 50 });
  const base = { exam: "all", domain: "all", search: "", status: "new" };
  assert.equal(filterQuestions(questions, progress, base).length, 0);
  assert.equal(filterQuestions(questions, progress, { ...base, status: "missed" }).length, 225);
  assert.equal(filterQuestions(questions, progress, { ...base, status: "saved" }).length, 150);
  for (const exam of Object.keys(exams)) {
    assert.equal(filterQuestions(questions, progress, { ...base, exam, status: "all" }).length, 150);
  }
});
test("saved progress roundtrips and rejects corrupt structures", () => {
  const q = questions[0];
  const saved = { [q.id]: { choice: q.answer, bookmarked: true } };
  assert.deepEqual(readProgress(JSON.stringify(saved), questions), saved);
  assert.deepEqual(readProgress(null, questions), {});
  assert.deepEqual(readProgress('{"unknown-id":{}}', questions), {});
  for (const raw of ["null", "[]", "{broken", JSON.stringify({ [q.id]: { choice: 9, bookmarked: false } })]) {
    assert.throws(() => readProgress(raw, questions));
  }
});
test("all website assets exist; no external runtime dependencies or secret config", async () => {
  for (const file of publicAssets) {
    const content = await readFile(new URL(file, import.meta.url), "utf8");
    assert.ok(content.length);
    assert.doesNotMatch(content, /AccountKey=|SharedAccessSignature=|sk-[A-Za-z0-9]{20}/);
  }
  const html = await readFile(new URL("index.html", import.meta.url), "utf8");
  assert.match(html, /name="viewport"/);
  assert.match(html, /type="module" src="app.js"/);
});
test("Azure hosting config keeps the local server's security headers", async () => {
  const config = JSON.parse(await readFile(new URL("staticwebapp.config.json", import.meta.url), "utf8"));
  assert.equal(config.globalHeaders["X-Content-Type-Options"], "nosniff");
  assert.equal(config.globalHeaders["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(config.globalHeaders["Content-Security-Policy"], /script-src 'self'/);
});
test("HTTP server exposes only public assets and rejects unsupported methods", async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("server.mjs", import.meta.url))], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
      child.stdout.on("data", data => {
        const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    for (const path of ["/", ...publicAssets.map(file => "/" + file)]) {
      const response = await fetch(url + path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    }
    for (const path of ["/README.md", "/tests.mjs", "/server.mjs", "/.git/HEAD", "/.github/workflows/ci.yml", "/.env", "/constructor", "/%2e%2e/package.json"]) {
      assert.equal((await fetch(url + path)).status, 404);
    }
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal(await (await fetch(url, { method: "HEAD" })).text(), "");
  } finally {
    child.kill();
  }
});
