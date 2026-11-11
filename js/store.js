// データ層（技術設計書 v0.2 §2・§4）
// ・保存は IndexedDB に一元化する。localStorage は使わない
// ・画面側はこのファイルの関数だけを呼ぶ。IndexedDB の生 API はここに閉じ込める
// ・預かり中の一覧は本文（body）を絶対に読まない：getHoldingMeta は本文を含まない形で返す
//
// entries: { id, questionId, questionText, body, tendency, periodType,
//            dueDate, createdDate, status: "holding"|"reunited",
//            deferUntil, reply: { body, date } | null }
// settings: { key, value }（carryoverTendency / lastTendency / flags など）

const DB_NAME = "tokitane";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        let result;
        const req = run(store);
        if (req) {
          req.onsuccess = () => {
            result = req.result;
          };
          req.onerror = () => reject(req.error);
        }
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const getAll = (storeName) => tx(storeName, "readonly", (s) => s.getAll());
const getOne = (storeName, key) => tx(storeName, "readonly", (s) => s.get(key));
const putOne = (storeName, value) => tx(storeName, "readwrite", (s) => s.put(value));
const deleteOne = (storeName, key) => tx(storeName, "readwrite", (s) => s.delete(key));

// ---------- entries ----------
export function addEntry(entry) {
  return putOne("entries", entry);
}

export function getEntry(id) {
  return getOne("entries", id);
}

export function updateEntry(entry) {
  return putOne("entries", entry);
}

export function deleteEntry(id) {
  return deleteOne("entries", id);
}

export function getAllEntries() {
  return getAll("entries");
}

// 預かり中の一覧用。本文は構造的に含めない（画面に渡る時点で存在しない）。
export async function getHoldingMeta() {
  const all = await getAll("entries");
  return all
    .filter((e) => e.status === "holding")
    .sort((a, b) => (a.createdDate < b.createdDate ? -1 : 1))
    .map((e) => ({
      id: e.id,
      periodType: e.periodType,
      dueDate: e.dueDate,
      createdDate: e.createdDate,
      tendency: e.tendency,
    }));
}

export async function countEntries() {
  const all = await getAll("entries");
  return all.length;
}

// ---------- settings ----------
export async function getSetting(key, fallback = null) {
  const row = await getOne("settings", key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return putOne("settings", { key, value });
}

// ---------- 保存の安定化 ----------
// 初回の保存後に、ブラウザへ永続化を静かに要求する（表示はしない。技術設計書 §4）
export function requestPersist() {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist().catch(() => false);
  }
  return Promise.resolve(false);
}
