// ときたね バックアップ（書き出し・読み込み）
// 正データ形式：JSON。{ app:"tokitane", version:1, exportedDate, entries, settings }
// 読み込みは「全部を検証してから、全部を取り込む」。1件でも不正なら何も取り込まない。
// すでに端末にある言葉（同じID）は上書きせず、新しい言葉だけを追加する。

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = ["soon", "later", "forgotten"];
const TENDENCIES = ["light", "daily", "deep"];
const STATUSES = ["holding", "reunited"];

function isDateStr(v) {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function buildBackup(entries, carryoverTendency, exportedDate) {
  return {
    app: "tokitane",
    version: 1,
    exportedDate,
    entries,
    settings: { carryoverTendency: carryoverTendency === "on" ? "on" : "off" },
  };
}

// 1件を検証し、アプリで使う形（既知の項目だけ）に整える。不正なら null。
export function sanitizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;
  if (typeof raw.body !== "string") return null;
  if (!PERIODS.includes(raw.periodType)) return null;
  if (!isDateStr(raw.dueDate) || !isDateStr(raw.createdDate)) return null;
  if (!STATUSES.includes(raw.status)) return null;
  const tendency = TENDENCIES.includes(raw.tendency) ? raw.tendency : "daily";
  let reply = null;
  if (raw.reply !== null && raw.reply !== undefined) {
    if (
      typeof raw.reply !== "object" ||
      typeof raw.reply.body !== "string" ||
      !isDateStr(raw.reply.date)
    ) {
      return null;
    }
    reply = { body: raw.reply.body, date: raw.reply.date };
  }
  return {
    id: raw.id,
    questionId: typeof raw.questionId === "string" ? raw.questionId : null,
    questionText: typeof raw.questionText === "string" ? raw.questionText : null,
    body: raw.body,
    tendency,
    periodType: raw.periodType,
    dueDate: raw.dueDate,
    createdDate: raw.createdDate,
    status: raw.status,
    deferUntil: isDateStr(raw.deferUntil) ? raw.deferUntil : null,
    reply,
  };
}

// ファイルのテキストを検証する。成功なら { entries }、失敗なら { error: 理由コード }。
export function validateBackupText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return { error: "not-json" };
  }
  if (!data || typeof data !== "object") return { error: "not-backup" };
  if (data.app !== "tokitane" || data.version !== 1) return { error: "not-backup" };
  if (!Array.isArray(data.entries)) return { error: "not-backup" };
  const entries = [];
  for (const raw of data.entries) {
    const clean = sanitizeEntry(raw);
    if (!clean) return { error: "invalid-entry" };
    entries.push(clean);
  }
  // 同じファイル内でのID重複は不正として扱う
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.id)) return { error: "invalid-entry" };
    seen.add(e.id);
  }
  return { entries };
}

// 既存のIDと重ならない、新しい言葉だけを返す
export function pickNewEntries(entries, existingIds) {
  return entries.filter((e) => !existingIds.has(e.id));
}
