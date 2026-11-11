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

// ---------- パスワード付き書き出し（暗号化） ----------
// 方式：Web Crypto API。PBKDF2（SHA-256／60万回）でパスワードから鍵を作り、
// AES-GCM（256bit）で正データのJSON文字列を暗号化する。
// パスワード自体は保存も送信もしない。忘れると復号できない。
const ENCRYPT_ITERATIONS = 600000;

function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("bad-base64");
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 暗号化された書き出しファイルかどうかを判定する（中身は復号しない）
export function parseEncryptedBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  if (data.app !== "tokitane" || data.version !== 1 || data.encrypted !== true) return null;
  if (!data.kdf || data.kdf.name !== "PBKDF2" || data.kdf.hash !== "SHA-256") return null;
  if (!data.cipher || data.cipher.name !== "AES-GCM") return null;
  if (typeof data.kdf.salt !== "string" || typeof data.cipher.iv !== "string") return null;
  if (typeof data.data !== "string") return null;
  return data;
}

export function isEncryptedBackupText(text) {
  return parseEncryptedBackup(text) !== null;
}

async function deriveKey(password, salt, iterations, cryptoObj) {
  const material = await cryptoObj.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return cryptoObj.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// 正データのJSON文字列をパスワードで暗号化し、ファイル用のJSON文字列を返す
export async function encryptBackupText(plainText, password, cryptoObj = globalThis.crypto) {
  if (!cryptoObj || !cryptoObj.subtle) throw new Error("crypto-unavailable");
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ENCRYPT_ITERATIONS, cryptoObj);
  const cipher = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );
  return JSON.stringify(
    {
      app: "tokitane",
      version: 1,
      encrypted: true,
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: ENCRYPT_ITERATIONS,
        salt: bytesToBase64(salt),
      },
      cipher: { name: "AES-GCM", iv: bytesToBase64(iv) },
      data: bytesToBase64(new Uint8Array(cipher)),
    },
    null,
    2
  );
}

// 暗号化されたファイルの文字列を、パスワードで正データのJSON文字列に戻す。
// パスワード違い・改ざん・形式不正では例外になる（呼び出し側でまとめて扱う）。
export async function decryptBackupText(text, password, cryptoObj = globalThis.crypto) {
  if (!cryptoObj || !cryptoObj.subtle) throw new Error("crypto-unavailable");
  const wrapper = parseEncryptedBackup(text);
  if (!wrapper) throw new Error("not-encrypted");
  const iterations = wrapper.kdf.iterations;
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) {
    throw new Error("bad-kdf");
  }
  const salt = base64ToBytes(wrapper.kdf.salt);
  const iv = base64ToBytes(wrapper.cipher.iv);
  if (salt.length < 16 || iv.length !== 12) throw new Error("bad-kdf");
  const key = await deriveKey(password, salt, iterations, cryptoObj);
  const plain = await cryptoObj.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(wrapper.data)
  );
  return new TextDecoder().decode(plain);
}
