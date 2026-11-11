// ときたね アプリ本体（M3：再会）
// M3の範囲：期日が来た言葉が入口に封で現れ、開いて読める。再会した言葉の読み返し。
// 預ける・保存は M2、設定の保存は M4、書き出し・全削除は M5、PWA仕上げは M6。
import { poolForTendency } from "./questions.js";
import {
  addEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  getHoldingMeta,
  getDueEntries,
  getReunitedEntries,
  countEntries,
  getSetting,
  setSetting,
  requestPersist,
} from "./store.js";
import { todayStr, addDays, dueDateFor, formatJP } from "./dates.js";

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
  dueEntry: null, // 封に出ている言葉
  reunionEntry: null, // 開いて読んでいる言葉
  writeMode: "deposit", // "deposit" | "reply"
  replyEntryId: null,
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
  if (id === "view-reunited") renderReunited();
}

// 入口へ戻るたびに、期日の来た言葉があるかを確認して入口の形を選ぶ
async function goEntry() {
  try {
    const due = await getDueEntries(todayStr());
    if (due.length > 0) {
      fillSeal(due[0]);
      show("view-entry-reunion");
      return;
    }
  } catch (_) {
    /* 保存が読めない場合は通常の入口を出す */
  }
  state.dueEntry = null;
  show("view-entry");
}
document.querySelectorAll("[data-go]").forEach((el) => {
  el.addEventListener("click", () => {
    if (el.dataset.go === "view-entry") goEntry();
    else show(el.dataset.go);
  });
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
const toPeriodBtn = document.getElementById("btn-to-period");

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
function enterWriteMode(mode) {
  state.writeMode = mode;
  toPeriodBtn.textContent = mode === "reply" ? "返す" : "次へ";
}
document.getElementById("btn-shuffle").addEventListener("click", drawQuestion);
document.getElementById("btn-to-write").addEventListener("click", () => {
  enterWriteMode("deposit");
  writeQ.textContent = state.question ? state.question.text : "";
  writeQ.style.display = state.question ? "" : "none";
  show("view-write");
});
document.getElementById("btn-no-question").addEventListener("click", () => {
  enterWriteMode("deposit");
  state.question = null;
  writeQ.style.display = "none";
  show("view-write");
});
toPeriodBtn.addEventListener("click", async () => {
  if (writeBody.value.trim() === "") {
    showToast("まだ言葉が書かれていません");
    writeBody.focus();
    return;
  }
  if (state.writeMode === "reply" && state.replyEntryId) {
    const entry = await getEntry(state.replyEntryId);
    if (entry) {
      entry.reply = { body: writeBody.value, date: todayStr() };
      await updateEntry(entry);
      if (state.reunionEntry && state.reunionEntry.id === entry.id) {
        state.reunionEntry = entry;
      }
    }
    writeBody.value = "";
    state.replyEntryId = null;
    enterWriteMode("deposit");
    goEntry();
    showToast("一言を返しました");
    return;
  }
  state.periodMode = "deposit";
  state.changeEntryId = null;
  depositBtn.textContent = "預ける";
  show("view-period");
});

// ---------- 再会：封・開封・読後 ----------
const sealSvg = document.getElementById("seal-svg");
const sealContext = document.getElementById("seal-context");
const reunionDate = document.getElementById("reunion-date");
const reunionQuestion = document.getElementById("reunion-question");
const reunionBody = document.getElementById("reunion-body");
const afterBtns = document.getElementById("after-btns");
const replyCard = document.getElementById("reunion-reply");
const replyBodyEl = document.getElementById("reunion-reply-body");
const replyDateEl = document.getElementById("reunion-reply-date");
let reunionBackMode = "entry"; // "entry" | "list"

function fillSeal(entry) {
  state.dueEntry = entry;
  // 深い傾向で書いた言葉だけ、日付と傾向の事実を小さく添える
  if (entry.tendency === "deep") {
    sealContext.textContent = formatJP(entry.createdDate) + "／ゆっくり向き合って書いた言葉";
    sealContext.style.display = "";
  } else {
    sealContext.textContent = "";
    sealContext.style.display = "none";
  }
}

function fillReunion(entry, mode) {
  state.reunionEntry = entry;
  reunionBackMode = mode === "reread" ? "list" : "entry";
  reunionDate.textContent = formatJP(entry.createdDate) + "に書いた言葉";
  reunionQuestion.textContent = entry.questionText || "";
  reunionQuestion.style.display = entry.questionText ? "" : "none";
  reunionBody.textContent = entry.body;
  afterBtns.style.display = mode === "reread" ? "none" : "";
  if (entry.reply) {
    replyCard.hidden = false;
    replyBodyEl.textContent = entry.reply.body;
    replyDateEl.textContent = formatJP(entry.reply.date);
  } else {
    replyCard.hidden = true;
  }
}

document.getElementById("btn-open-seal").addEventListener("click", async () => {
  const entry = state.dueEntry;
  if (!entry) return;
  sealSvg.classList.add("opening");
  setTimeout(async () => {
    sealSvg.classList.remove("opening");
    const fresh = await getEntry(entry.id);
    if (fresh && fresh.status === "holding") {
      fresh.status = "reunited";
      await updateEntry(fresh);
      fillReunion(fresh, "fresh");
    } else if (fresh) {
      fillReunion(fresh, "fresh");
    }
    show("view-reunion");
    reunionBody.focus({ preventScroll: true });
  }, 560);
});

document.getElementById("btn-defer-today").addEventListener("click", async () => {
  const entry = state.dueEntry;
  if (entry) {
    const fresh = await getEntry(entry.id);
    if (fresh && fresh.status === "holding") {
      fresh.deferUntil = addDays(todayStr(), 1); // 明日まで出さない。回数は記録しない
      await updateEntry(fresh);
    }
  }
  state.dueEntry = null;
  goEntry();
});

document.getElementById("btn-defer-later").addEventListener("click", async () => {
  const entry = state.dueEntry;
  if (entry) {
    const fresh = await getEntry(entry.id);
    if (fresh && fresh.status === "holding") {
      // 時期の種別はそのままに、今日から再計算する（第4回会議の決定）
      fresh.dueDate = dueDateFor(fresh.periodType, todayStr());
      fresh.deferUntil = null;
      await updateEntry(fresh);
    }
  }
  state.dueEntry = null;
  goEntry();
  showToast("先へ回しました");
});

document.getElementById("btn-reunion-back").addEventListener("click", () => {
  if (reunionBackMode === "list") show("view-reunited");
  else goEntry();
});

document.querySelectorAll("[data-after]").forEach((b) => {
  b.addEventListener("click", () => {
    const entry = state.reunionEntry;
    if (b.dataset.after === "deposit") {
      drawQuestion();
      show("view-question");
    } else if (b.dataset.after === "reply") {
      if (!entry) return;
      enterWriteMode("reply");
      state.replyEntryId = entry.id;
      state.question = null;
      writeQ.style.display = "none";
      show("view-write");
    } else {
      goEntry();
    }
  });
});

// ---------- 再会した言葉（読み返し） ----------
const reunitedList = document.getElementById("reunited-list");
const reunitedEmpty = document.getElementById("reunited-empty");
async function renderReunited() {
  const entries = await getReunitedEntries();
  reunitedList.replaceChildren();
  reunitedEmpty.hidden = entries.length > 0;
  entries.forEach((e) => {
    const btn = document.createElement("button");
    btn.className = "reunited-item";
    const d = document.createElement("span");
    d.className = "idate";
    d.textContent = formatJP(e.createdDate);
    btn.appendChild(d);
    if (e.questionText) {
      const q = document.createElement("span");
      q.className = "iq";
      q.style.display = "block";
      q.textContent = e.questionText;
      btn.appendChild(q);
    }
    const body = document.createElement("span");
    body.className = "ibody";
    body.textContent = e.body;
    btn.appendChild(body);
    btn.addEventListener("click", () => {
      fillReunion(e, "reread");
      show("view-reunion");
    });
    reunitedList.appendChild(btn);
  });
}

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
goEntry();
