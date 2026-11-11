// 日付ユーティリティ（技術設計書 v0.2 §3 の規約）
// ・日付はすべて端末ローカルの日付文字列 "YYYY-MM-DD" で保存・比較する
// ・ミリ秒単位の足し算はしない（ずれる事故のもと）。年月日から組み立て直す
// ・dueDate は預けた時点で固定し、保存した値を正とする

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toDateStr(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function todayStr() {
  return toDateStr(new Date());
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

// 時期の種別 → 返却日。呼び出すのは「預ける瞬間」と「時期を変える瞬間」だけ。
// 「忘れた頃」はここで1回だけ抽選し、決まった日を保存する（再抽選しない）。
export function dueDateFor(periodType, fromStr) {
  if (periodType === "soon") return addDays(fromStr, 3);
  if (periodType === "later") return addDays(fromStr, 14);
  // forgotten: 30〜180日
  const days = 30 + Math.floor(Math.random() * 151);
  return addDays(fromStr, days);
}

// "2026-09-12" → "2026年9月12日"（画面表示用）
export function formatJP(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return y + "年" + m + "月" + d + "日";
}
