// ときたね アプリ本体（M1：静的骨格）
// M1の範囲：画面の見た目と遷移、傾向・問いの出し分け、時期選択の操作まで。
// 保存（IndexedDB）は M2、再会の判定は M3 で store.js / dates.js に実装する。
import { QUESTIONS, poolForTendency } from "./questions.js";

const TENDENCY_NAMES = {
  light: "さらっと書く",
  daily: "今日を残す",
  deep: "ゆっくり向き合う",
};

const state = {
  tendency: "daily",
  question: null, // 現在の問い（オブジェクト）または null（問いなし）
  lastCategory: null,
  period: null,
};

// ---------- 画面遷移 ----------
const views = document.querySelectorAll(".view");
function show(id) {
  views.forEach((v) => v.classList.toggle("active", v.id === id));
  const view = document.getElementById(id);
  // 芽のアニメーションは画面を開いたときに一度だけ再生する
  view.querySelectorAll(".anim-root, .seal, .bud-motif").forEach((el) => {
    el.classList.remove("play");
    void el.offsetWidth; // リフローでアニメーションをリセット
    el.classList.add("play");
  });
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-go]").forEach((el) => {
  el.addEventListener("click", () => show(el.dataset.go));
});

// ---------- トースト ----------
const toast = document.getElementById("toast");
let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ---------- 傾向の選択（入口） ----------
const tendButtons = document.querySelectorAll(".tend");
function selectTendency(key, { navigate = false } = {}) {
  state.tendency = key;
  tendButtons.forEach((b) => {
    const on = b.dataset.tendency === key;
    b.classList.toggle("sel", on);
    b.setAttribute("aria-checked", String(on));
  });
  if (navigate) {
    drawQuestion();
    show("view-question");
  }
}
tendButtons.forEach((b) => {
  b.addEventListener("click", () => selectTendency(b.dataset.tendency, { navigate: true }));
});

// ---------- 問い ----------
const qText = document.getElementById("q-text");
const qNote = document.getElementById("q-tendency-note");
const writeQ = document.getElementById("write-q");

function drawQuestion() {
  const pool = poolForTendency(state.tendency);
  // 直前とカテゴリが重ならない候補を優先する（シャッフルの出し分け）
  let candidates = pool.filter((q) => q.category !== state.lastCategory);
  if (candidates.length === 0) candidates = pool;
  if (state.question) {
    const rest = candidates.filter((q) => q.id !== state.question.id);
    if (rest.length > 0) candidates = rest;
  }
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  state.question = next;
  state.lastCategory = next.category;
  qText.textContent = next.text;
  qText.classList.remove("fade");
  void qText.offsetWidth;
  qText.classList.add("fade");
  qNote.textContent = "「" + TENDENCY_NAMES[state.tendency] + "」で書いています";
}
document.getElementById("btn-shuffle").addEventListener("click", drawQuestion);
document.getElementById("btn-to-write").addEventListener("click", () => {
  writeQ.textContent = state.question ? state.question.text : "";
  writeQ.style.display = state.question ? "" : "none";
  show("view-write");
});
document.getElementById("btn-no-question").addEventListener("click", () => {
  state.question = null;
  writeQ.style.display = "none";
  show("view-write");
});

// ---------- 再会（M1では見本の言葉で骨格のみ） ----------
const sealSvg = document.getElementById("seal-svg");
document.getElementById("btn-open-seal").addEventListener("click", () => {
  sealSvg.classList.add("opening");
  setTimeout(() => {
    sealSvg.classList.remove("opening");
    show("view-reunion");
    document.getElementById("reunion-body").focus({ preventScroll: true });
  }, 560);
});
document.getElementById("btn-defer-today").addEventListener("click", () => show("view-entry"));
document.getElementById("btn-defer-later").addEventListener("click", () => {
  show("view-entry");
  showToast("先へ回しました");
});
document.querySelectorAll("[data-after]").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.after === "deposit") {
      state.tendency = "daily";
      drawQuestion();
      show("view-question");
    } else if (b.dataset.after === "reply") {
      writeQ.style.display = "none";
      show("view-write");
    } else {
      show("view-entry");
    }
  });
});

// ---------- 時期選択 ----------
const periodButtons = document.querySelectorAll(".period");
const depositBtn = document.getElementById("btn-deposit");
periodButtons.forEach((b) => {
  b.addEventListener("click", () => {
    state.period = b.dataset.period;
    periodButtons.forEach((x) => {
      const on = x === b;
      x.classList.toggle("sel", on);
      x.setAttribute("aria-checked", String(on));
      x.classList.remove("grow");
    });
    void b.offsetWidth;
    b.classList.add("grow");
    depositBtn.disabled = false;
  });
});
depositBtn.addEventListener("click", () => show("view-done"));

// ---------- 預かり中のシート ----------
const backdrop = document.getElementById("sheet-backdrop");
const sheet = document.getElementById("holding-sheet");
const sheetTitle = document.getElementById("sheet-title");
function openSheet(label) {
  sheetTitle.textContent = label + "に預けた言葉";
  backdrop.classList.add("show");
  sheet.classList.add("show");
}
function closeSheet() {
  backdrop.classList.remove("show");
  sheet.classList.remove("show");
}
document.querySelectorAll(".holding-item").forEach((b) => {
  b.addEventListener("click", () => openSheet(b.dataset.periodLabel));
});
backdrop.addEventListener("click", closeSheet);
document.getElementById("sheet-close").addEventListener("click", closeSheet);
document.getElementById("sheet-change").addEventListener("click", () => {
  closeSheet();
  show("view-period");
});
document.getElementById("sheet-delete").addEventListener("click", () => {
  closeSheet();
  showToast("M1では見本のため、実際には消えません");
});

// ---------- 設定：開いたときの傾向 ----------
document.querySelectorAll("[data-carryover]").forEach((row) => {
  row.addEventListener("click", () => {
    document.querySelectorAll("[data-carryover]").forEach((r) =>
      r.setAttribute("aria-checked", String(r === row))
    );
  });
});
document.querySelectorAll("[data-m1-note]").forEach((b) => {
  b.addEventListener("click", () => showToast("書き出し・読み込みは M5 で使えるようになります"));
});

// ---------- 全削除の長押し（骨格確認用） ----------
const lpBtn = document.getElementById("btn-longpress");
const lpFill = document.getElementById("longpress-fill");
const lpNote = document.getElementById("longpress-note");
let lpTimer = null;
function lpStart(e) {
  e.preventDefault();
  lpFill.style.transition = "transform 1.2s linear";
  lpFill.style.transform = "scaleX(1)";
  lpTimer = setTimeout(() => {
    lpNote.textContent = "M1では見本のため、実際には消えません";
  }, 1250);
}
function lpCancel() {
  clearTimeout(lpTimer);
  lpFill.style.transition = "transform 0.2s ease-out";
  lpFill.style.transform = "scaleX(0)";
}
lpBtn.addEventListener("pointerdown", lpStart);
lpBtn.addEventListener("pointerup", lpCancel);
lpBtn.addEventListener("pointerleave", lpCancel);

// ---------- 初期表示 ----------
selectTendency("daily");
drawQuestion();
show("view-entry");
