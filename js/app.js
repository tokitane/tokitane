// ときたね アプリ本体（M2：預ける・保存）
// M2の範囲：問い→書く→時期→保存（IndexedDB）を通し、閉じて開き直しても残ること。
// 預かり中の一覧・時期変更・1件削除も実データで動く。
// 再会の判定と入口の出し分けは M3、設定の保存は M4、書き出し等は M5。
import { poolForTendency } from "./questions.js";
import {
  addEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  getHoldingMeta,
  countEntries,
  getSetting,
  setSetting,
  requestPersist,
} from "./store.js";
import { todayStr, dueDateFor } from "./dates.js";

const TENDENCY_NAMES = {
  light: "さらっと書く",
  daily: "今日を残す",
  deep: "ゆっくり向き合う",
};
const PERIOD_NAMES = {
  soon: "近いうち",
  later: "少し先",
  forgotten: "忘れた頃",
};

const state = {
  tendency: "daily",
  question: null,
  lastCategory: null,
  period: null,
  periodMode: "deposit", // "deposit" | "change"
  changeEntryId: null,
  sheetEntryId: null,
};

// ---------- 画面遷移 ----------
const views = document.querySelectorAll(".view");
function show(id) {
  views.forEach((v) => v.classList.toggle("active", v.id === id));
  const view = document.getElementById(id);
  view.querySelectorAll(".anim-root, .seal, .bud-motif").forEach((el) => {
    el.classList.remove("play");
    void el.offsetWidth;
    el.classList.add("play");
  });
  window.scrollTo(0, 0);
  if (id === "view-holding") renderHolding();
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
  setSetting("lastTendency", key).catch(() => {});
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
const writeBody = document.getElementById("write-body");

function drawQuestion() {
  const pool = poolForTendency(state.tendency);
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
document.getElementById("btn-to-period").addEventListener("click", () => {
  if (writeBody.value.trim() === "") {
    showToast("まだ言葉が書かれていません");
    writeBody.focus();
    return;
  }
  state.periodMode = "deposit";
  state.changeEntryId = null;
  depositBtn.textContent = "預ける";
  show("view-period");
});

// ---------- 再会（M3で実データ化。ここは骨格の遷移のみ） ----------
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
      selectTendency(state.tendency);
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

// ---------- 時期選択と保存 ----------
const periodButtons = document.querySelectorAll(".period");
const depositBtn = document.getElementById("btn-deposit");
function resetPeriodSelection() {
  state.period = null;
  periodButtons.forEach((x) => {
    x.classList.remove("sel", "grow");
    x.setAttribute("aria-checked", "false");
  });
  depositBtn.disabled = true;
}
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
document.getElementById("btn-period-back").addEventListener("click", () => {
  show(state.periodMode === "change" ? "view-holding" : "view-write");
});

depositBtn.addEventListener("click", async () => {
  if (!state.period) return;
  const today = todayStr();
  if (state.periodMode === "change" && state.changeEntryId) {
    const entry = await getEntry(state.changeEntryId);
    if (entry && entry.status === "holding") {
      entry.periodType = state.period;
      entry.dueDate = dueDateFor(state.period, today);
      await updateEntry(entry);
    }
    state.periodMode = "deposit";
    state.changeEntryId = null;
    depositBtn.textContent = "預ける";
    resetPeriodSelection();
    show("view-holding");
    showToast("時期を変えました");
    return;
  }
  const entry = {
    id: crypto.randomUUID(),
    questionId: state.question ? state.question.id : null,
    questionText: state.question ? state.question.text : null,
    body: writeBody.value,
    tendency: state.tendency,
    periodType: state.period,
    dueDate: dueDateFor(state.period, today),
    createdDate: today,
    status: "holding",
    deferUntil: null,
    reply: null,
  };
  await addEntry(entry);
  const started = await getSetting("started", false);
  if (!started) {
    await setSetting("started", true);
    requestPersist();
  }
  writeBody.value = "";
  resetPeriodSelection();
  show("view-done");
});

// ---------- 預かり中（実データ。本文は読まない） ----------
const holdingGrid = document.getElementById("holding-grid");
const holdingEmpty = document.getElementById("holding-empty");
const CIRCLE_SIZES = [72, 80, 68];

async function renderHolding() {
  const meta = await getHoldingMeta();
  holdingGrid.replaceChildren();
  holdingEmpty.hidden = meta.length > 0;
  meta.forEach((m, i) => {
    const size = CIRCLE_SIZES[i % CIRCLE_SIZES.length];
    const btn = document.createElement("button");
    btn.className = "holding-item";
    btn.setAttribute("aria-label", "預かり中の言葉（" + PERIOD_NAMES[m.periodType] + "）");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 80 80");
    svg.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "40");
    circle.setAttribute("cy", "40");
    circle.setAttribute("r", "36");
    circle.setAttribute("style", "fill:var(--pastel);stroke:var(--rose)");
    circle.setAttribute("stroke-width", "2");
    svg.appendChild(circle);
    btn.appendChild(svg);
    btn.addEventListener("click", () => openSheet(m));
    holdingGrid.appendChild(btn);
  });
}

// ---------- 預かり中のシート ----------
const backdrop = document.getElementById("sheet-backdrop");
const sheet = document.getElementById("holding-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetMain = document.getElementById("sheet-main");
const sheetConfirm = document.getElementById("sheet-confirm");
function openSheet(meta) {
  state.sheetEntryId = meta.id;
  sheetTitle.textContent = PERIOD_NAMES[meta.periodType] + "に預けた言葉";
  sheetMain.hidden = false;
  sheetConfirm.hidden = true;
  backdrop.classList.add("show");
  sheet.classList.add("show");
}
function closeSheet() {
  backdrop.classList.remove("show");
  sheet.classList.remove("show");
  state.sheetEntryId = null;
}
backdrop.addEventListener("click", closeSheet);
document.getElementById("sheet-close").addEventListener("click", closeSheet);
document.getElementById("sheet-change").addEventListener("click", () => {
  const id = state.sheetEntryId;
  closeSheet();
  if (!id) return;
  state.periodMode = "change";
  state.changeEntryId = id;
  depositBtn.textContent = "時期を変える";
  resetPeriodSelection();
  show("view-period");
});
document.getElementById("sheet-delete").addEventListener("click", () => {
  sheetMain.hidden = true;
  sheetConfirm.hidden = false;
});
document.getElementById("sheet-delete-cancel").addEventListener("click", () => {
  sheetMain.hidden = false;
  sheetConfirm.hidden = true;
});
document.getElementById("sheet-delete-confirm").addEventListener("click", async () => {
  const id = state.sheetEntryId;
  closeSheet();
  if (id) {
    await deleteEntry(id);
    renderHolding();
    showToast("消しました");
  }
});

// ---------- 設定（保存は M4。ここは骨格の操作のみ） ----------
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

// ---------- 全削除の長押し（実装は M5。ここは骨格確認用） ----------
const lpBtn = document.getElementById("btn-longpress");
const lpFill = document.getElementById("longpress-fill");
const lpNote = document.getElementById("longpress-note");
let lpTimer = null;
function lpStart(e) {
  e.preventDefault();
  lpFill.style.transition = "transform 1.2s linear";
  lpFill.style.transform = "scaleX(1)";
  lpTimer = setTimeout(() => {
    lpNote.textContent = "全削除は M5 で使えるようになります";
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
// 保存が消えた形跡（開始フラグがあるのに言葉が0件）を見たら、静かに初回状態へ戻す
(async () => {
  try {
    const started = await getSetting("started", false);
    if (started && (await countEntries()) === 0) {
      await setSetting("started", false);
    }
  } catch (_) {
    /* 保存が使えない環境では骨格表示のみで続行する */
  }
})();
selectTendency("daily");
drawQuestion();
show("view-entry");
