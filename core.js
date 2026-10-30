export function readProgress(raw, questions) {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid saved progress.");
  const result = {};
  for (const q of questions) {
    const item = parsed[q.id];
    if (item === undefined) continue;
    if (!item || typeof item !== "object" || !Number.isInteger(item.choice) ||
        item.choice < 0 || item.choice >= q.options.length || typeof item.bookmarked !== "boolean") {
      throw new Error("Invalid saved answer.");
    }
    result[q.id] = { choice: item.choice, bookmarked: item.bookmarked };
  }
  return result;
}

export function filterQuestions(questions, progress, { exam, domain, status, search }) {
  const text = search.trim().toLowerCase();
  return questions.filter(q =>
    (exam === "all" || q.exam === exam) &&
    (domain === "all" || q.domain === domain) &&
    (!text || `${q.title} ${q.prompt} ${q.module} ${q.exam}`.toLowerCase().includes(text)) &&
    (status === "all" ||
      status === "new" && !progress[q.id] ||
      status === "missed" && progress[q.id] && progress[q.id].choice !== q.answer ||
      status === "saved" && progress[q.id]?.bookmarked));
}

export function statistics(questions, progress) {
  const answered = questions.filter(q => progress[q.id]);
  const correct = answered.filter(q => progress[q.id].choice === q.answer).length;
  return { total: questions.length, answered: answered.length, correct,
    accuracy: answered.length ? Math.round(correct / answered.length * 100) : null };
}
