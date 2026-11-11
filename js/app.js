// ときたね アプリ本体（M6：PWA仕上げ）
// M6の範囲：Service Worker登録、初回預け完了時のホーム画面追加の案内。
// 預ける・保存は M2、再会は M3、設定の保存は M4、バックアップ・削除は M5、
// ようこそ画面と操作アニメーションは M5.5。
import { poolForTendency, initialTendency } from "./questions.js";
import {
  addEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  getHoldingMeta,
  getDueEntries,
  getReunitedEntries,
  getAllEntries,
  clearAllData,
  countEntries,
  getSetting,
  setSetting,
  requestPersist,
} from "./store.js";
import {
  buildBackup,
  validateBackupText,
  pickNewEntries,
  isEncryptedBackupText,
  encryptBackupText,
  decryptBackupText,
} from "./backup.js";
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
  transitionSpeed: "slow", // "slow" | "normal"（設定「画面の切り替わり」）
  pendingImportText: null, // パスワード待ちの暗号化ファイルの中身
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
  if (id === "view-settings") renderSettings();
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
function selectTendency(key, { navigate = false, record = true } = {}) {
  state.tendency = key;
  tendButtons.forEach((b) => {
    const on = b.dataset.tendency === key;
    b.classList.toggle("sel", on);
    b.setAttribute("aria-checked", String(on));
  });
  // 起動時の初期選択では「前回の傾向」を上書きしない（record=false）
  if (record) setSetting("lastTendency", key).catch(() => {});
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
  }, state.transitionSpeed === "normal" ? 300 : 560);
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
  const isFirst = !started;
  if (isFirst) {
    await setSetting("started", true);
    requestPersist();
  }
  writeBody.value = "";
  resetPeriodSelection();
  show("view-done");
  if (isFirst) maybeShowHomeGuide();
});

// ---------- ホーム画面追加の案内（初回の預け完了時に一度だけ） ----------
const homeGuide = document.getElementById("home-guide");
async function maybeShowHomeGuide() {
  try {
    const standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
    if (standalone) {
      // すでに追加済みなら案内は出さない
      await setSetting("homeGuideShown", true);
      return;
    }
    const shown = await getSetting("homeGuideShown", false);
    if (shown) return;
    await setSetting("homeGuideShown", true);
    homeGuide.hidden = false;
  } catch (_) {
    /* 案内が出なくても預ける操作には影響しない */
  }
}
document.getElementById("home-guide-close").addEventListener("click", () => {
  homeGuide.hidden = true;
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
  document.querySelectorAll(".sheet").forEach((s) => s.classList.remove("show"));
  state.sheetEntryId = null;
}
function openSheetEl(el) {
  closeSheet();
  backdrop.classList.add("show");
  el.classList.add("show");
}
// ---------- ブラウザ判定と、ホーム画面追加・開き直しの案内（P1） ----------
const ua = navigator.userAgent || "";
const isIOS =
  /iPhone|iPad|iPod/i.test(ua) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const isLineBrowser = /\bLine\//i.test(ua);
const isInAppBrowser = isInAppBrowserUA(ua);
function isInAppBrowserUA(s) {
  return /\bLine\//i.test(s) || /FBAN|FBAV|Instagram/i.test(s);
}
function isStandalone() {
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true
  );
}

const guideSheet = document.getElementById("guide-sheet");
const guideTitle = document.getElementById("guide-title");
const guideLead = document.getElementById("guide-lead");
const guideSteps = document.getElementById("guide-steps");
const guideNote = document.getElementById("guide-note");
function setGuide(title, lead, steps, note) {
  guideTitle.textContent = title;
  guideLead.textContent = lead;
  guideSteps.replaceChildren();
  steps.forEach((text, i) => {
    const li = document.createElement("li");
    const num = document.createElement("span");
    num.className = "guide-step-num";
    num.textContent = String(i + 1);
    const body = document.createElement("span");
    body.textContent = text;
    li.appendChild(num);
    li.appendChild(body);
    guideSteps.appendChild(li);
  });
  guideNote.textContent = note || "";
  guideNote.style.display = note ? "" : "none";
}
function openGuide() {
  const appName = isLineBrowser ? "LINE" : "アプリ";
  if (isInAppBrowser) {
    if (isAndroid) {
      setGuide(
        "いつものブラウザで開き直してください",
        "今は" + appName + "の中のブラウザで開いています。このままではホーム画面に追加できず、言葉も通常のブラウザとは別の場所に保存されます。",
        [
          appName + "の画面の右下（または右上）にあるメニュー（︙）を開く",
          "「他のブラウザで開く」または「Chromeで開く」を選ぶ",
          "Chromeで ときたね が開いたら、右上のメニュー（︙）から「アプリをインストール」を選ぶ",
        ],
        "開き直した先のブラウザが、言葉を保存する場所になります。"
      );
    } else {
      setGuide(
        "いつものブラウザで開き直してください",
        "今は" + appName + "の中のブラウザで開いています。このままではホーム画面に追加できず、言葉も通常のブラウザとは別の場所に保存されます。",
        [
          appName + "の画面の右下（または右上）にあるメニューを開く",
          "「Safariで開く」を選ぶ",
          "Safariで開いたら、画面下の共有ボタンから「ホーム画面に追加」を選ぶ",
        ],
        "開き直した先のブラウザが、言葉を保存する場所になります。"
      );
    }
  } else if (isStandalone()) {
    setGuide(
      "ホーム画面に追加済みです",
      "いまは、ホーム画面から開ける状態で使っています。",
      ["ホーム画面の双葉のアイコンから開くと、この場所に戻ってこられます"],
      ""
    );
  } else if (isAndroid) {
    setGuide(
      "ホーム画面に追加する",
      "Chromeで開いているときに、ホーム画面へ追加できます。追加すると、アプリのように開けて、保存も安定します。",
      [
        "Chromeの右上にあるメニュー（︙）を開く",
        "「アプリをインストール」を選ぶ（表示されないときは「ホーム画面に追加」）",
        "「インストール」を押すと、ホーム画面に双葉のアイコンが追加されます",
      ],
      "LINEなどのアプリの中のブラウザでは追加できません。その場合は、この案内の「開き直しかた」の手順でChromeで開いてください。"
    );
  } else if (isIOS) {
    setGuide(
      "ホーム画面に追加する",
      "ホーム画面に追加すると、アプリのように開けて、保存も安定します。",
      [
        "画面の下にある共有ボタン（四角に上向きの矢印）を押す",
        "「ホーム画面に追加」を選ぶ",
        "右上の「追加」を押すと、ホーム画面に双葉のアイコンが追加されます",
      ],
      "LINEなどのアプリの中のブラウザでは追加できません。その場合は、いつものブラウザで開き直してください。"
    );
  } else {
    setGuide(
      "ホーム画面に追加する",
      "パソコンでは、ブラウザのメニューやアドレスバーの右端にあるインストールの印から追加できます。スマートフォンで使うときは、その端末のブラウザでこのページを開いてください。",
      [
        "ブラウザのメニューから「インストール」または「ホーム画面に追加」を選ぶ",
        "スマートフォンでは、Chrome（Android）やSafari（iPhone）で開くと追加できます",
      ],
      ""
    );
  }
  openSheetEl(guideSheet);
}
document.querySelectorAll("[data-open-guide]").forEach((b) => {
  b.addEventListener("click", openGuide);
});
document.getElementById("guide-close").addEventListener("click", closeSheet);

// アプリ内ブラウザで開かれていたら、書く前に知らせる
function initBrowserNotice() {
  if (!isInAppBrowser || isStandalone()) return;
  document.querySelectorAll(".browser-notice").forEach((n) => {
    n.hidden = false;
    const title = n.querySelector(".browser-notice-title");
    if (title && isLineBrowser) {
      title.textContent = "今はLINEの中のブラウザで開いています";
    }
  });
  const hgText = document.getElementById("home-guide-text");
  if (hgText) {
    hgText.textContent =
      "ホーム画面に追加すると、アプリのように開けて、保存も安定します。ただし、今開いているアプリの中のブラウザでは追加できません。いつものブラウザで開き直してください。";
  }
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

// ---------- 設定：開いたときの傾向（M4で保存まで実装） ----------
const carryoverRows = document.querySelectorAll("[data-carryover]");
function markCarryover(value) {
  carryoverRows.forEach((r) =>
    r.setAttribute("aria-checked", String(r.dataset.carryover === value))
  );
}
async function renderSettings() {
  const value = await getSetting("carryoverTendency", "off");
  markCarryover(value === "on" ? "on" : "off");
  const motion = await getSetting("transitionSpeed", "slow");
  markMotion(motion === "normal" ? "normal" : "slow");
}
carryoverRows.forEach((row) => {
  row.addEventListener("click", async () => {
    markCarryover(row.dataset.carryover);
    await setSetting("carryoverTendency", row.dataset.carryover);
  });
});

// ---------- 設定：画面の切り替わり（P2） ----------
const motionRows = document.querySelectorAll("[data-motion]");
function markMotion(value) {
  state.transitionSpeed = value === "normal" ? "normal" : "slow";
  document.documentElement.dataset.motion = state.transitionSpeed;
  motionRows.forEach((r) =>
    r.setAttribute("aria-checked", String(r.dataset.motion === state.transitionSpeed))
  );
}
motionRows.forEach((row) => {
  row.addEventListener("click", async () => {
    markMotion(row.dataset.motion);
    await setSetting("transitionSpeed", row.dataset.motion);
  });
});
// ---------- 書き出し・読み込み（M5／P1で暗号化を追加） ----------
const exportSheet = document.getElementById("export-sheet");
const passwordSheet = document.getElementById("password-sheet");
const unlockSheet = document.getElementById("unlock-sheet");
const exportPass1 = document.getElementById("export-pass-1");
const exportPass2 = document.getElementById("export-pass-2");
const exportPassError = document.getElementById("export-pass-error");
const importPass = document.getElementById("import-pass");
const importPassError = document.getElementById("import-pass-error");

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function buildBackupText() {
  const entries = await getAllEntries();
  const carryover = await getSetting("carryoverTendency", "off");
  return JSON.stringify(buildBackup(entries, carryover, todayStr()), null, 2);
}

document.getElementById("btn-export").addEventListener("click", () => {
  openSheetEl(exportSheet);
});
document.getElementById("export-cancel").addEventListener("click", closeSheet);
document.getElementById("export-plain").addEventListener("click", async () => {
  closeSheet();
  downloadTextFile(await buildBackupText(), "tokitane-backup-" + todayStr() + ".json");
  showToast("書き出しました");
});
document.getElementById("export-encrypted").addEventListener("click", () => {
  exportPass1.value = "";
  exportPass2.value = "";
  exportPassError.textContent = "";
  openSheetEl(passwordSheet);
  exportPass1.focus();
});
document.getElementById("export-encrypted-cancel").addEventListener("click", () => {
  exportPass1.value = "";
  exportPass2.value = "";
  closeSheet();
});
const exportEncryptedDo = document.getElementById("export-encrypted-do");
exportEncryptedDo.addEventListener("click", async () => {
  const pass = exportPass1.value;
  if (pass.length < 8) {
    exportPassError.textContent = "パスワードは8文字以上にしてください";
    return;
  }
  if (pass !== exportPass2.value) {
    exportPassError.textContent = "パスワードが一致しません";
    return;
  }
  exportPassError.textContent = "";
  exportEncryptedDo.disabled = true;
  const originalLabel = exportEncryptedDo.textContent;
  exportEncryptedDo.textContent = "暗号化しています…";
  try {
    const text = await encryptBackupText(await buildBackupText(), pass);
    downloadTextFile(text, "tokitane-backup-encrypted-" + todayStr() + ".json");
    exportPass1.value = "";
    exportPass2.value = "";
    closeSheet();
    showToast("パスワード付きで書き出しました");
  } catch (_) {
    exportPassError.textContent = "このブラウザでは暗号化できませんでした";
  } finally {
    exportEncryptedDo.disabled = false;
    exportEncryptedDo.textContent = originalLabel;
  }
});

// 検証済みの平文テキストを取り込む（検証で落ちたら端末のデータには一切触らない）
async function importFromPlainText(text) {
  let result;
  try {
    result = validateBackupText(text);
  } catch (_) {
    result = { error: "read-failed" };
  }
  if (result.error) {
    showToast("読み込めませんでした。ときたね の書き出しファイルか、確かめてください");
    return;
  }
  const existing = new Set((await getAllEntries()).map((e) => e.id));
  const fresh = pickNewEntries(result.entries, existing);
  for (const e of fresh) {
    await addEntry(e);
  }
  if (fresh.length > 0) {
    await setSetting("started", true);
    requestPersist();
    showToast(fresh.length + "件の言葉を読み込みました");
  } else {
    showToast("新しい言葉はありませんでした");
  }
}

const importFile = document.getElementById("import-file");
document.getElementById("btn-import").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files && importFile.files[0];
  importFile.value = "";
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch (_) {
    showToast("読み込めませんでした。ときたね の書き出しファイルか、確かめてください");
    return;
  }
  if (isEncryptedBackupText(text)) {
    // パスワード付きのファイルは、先にパスワードを聞いてから復号する
    state.pendingImportText = text;
    importPass.value = "";
    importPassError.textContent = "";
    openSheetEl(unlockSheet);
    importPass.focus();
    return;
  }
  importFromPlainText(text);
});
document.getElementById("import-unlock-cancel").addEventListener("click", () => {
  state.pendingImportText = null;
  importPass.value = "";
  closeSheet();
});
const importUnlockDo = document.getElementById("import-unlock-do");
importUnlockDo.addEventListener("click", async () => {
  const text = state.pendingImportText;
  if (!text) {
    closeSheet();
    return;
  }
  importUnlockDo.disabled = true;
  try {
    const plain = await decryptBackupText(text, importPass.value);
    state.pendingImportText = null;
    importPass.value = "";
    closeSheet();
    importFromPlainText(plain);
  } catch (_) {
    importPassError.textContent = "パスワードが違うか、ファイルが壊れています";
  } finally {
    importUnlockDo.disabled = false;
  }
});

// ---------- 全削除の長押し（M5で本実装） ----------
const lpBtn = document.getElementById("btn-longpress");
const lpFill = document.getElementById("longpress-fill");
const lpNote = document.getElementById("longpress-note");
let lpTimer = null;
function lpStart(e) {
  e.preventDefault();
  lpFill.style.transition = "transform 1.2s linear";
  lpFill.style.transform = "scaleX(1)";
  lpTimer = setTimeout(async () => {
    await clearAllData();
    lpCancel();
    lpNote.textContent = "";
    selectTendency("daily", { record: false });
    showToast("すべての言葉を消しました");
    goEntry();
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

// ---------- ようこそ画面（初回だけ） ----------
document.getElementById("btn-start").addEventListener("click", async () => {
  try {
    await setSetting("welcomed", true);
  } catch (_) {
    /* 保存できない環境では、その場の表示だけ切り替える */
  }
  goEntry();
});

// ---------- 初期表示 ----------
(async () => {
  let initial = "daily";
  let welcomed = true;
  try {
    // 保存が消えた形跡（開始フラグがあるのに言葉が0件）を見たら、静かに初回状態へ戻す
    const started = await getSetting("started", false);
    if (started && (await countEntries()) === 0) {
      await setSetting("started", false);
    }
    // 設定「開いたときの傾向」に従って初期傾向を決める（深い傾向は引き継がない）
    const carryover = await getSetting("carryoverTendency", "off");
    const last = await getSetting("lastTendency", null);
    initial = initialTendency(carryover, last);
    welcomed = await getSetting("welcomed", false);
    // 設定「画面の切り替わり」を最初の表示から反映する
    const motion = await getSetting("transitionSpeed", "slow");
    markMotion(motion === "normal" ? "normal" : "slow");
  } catch (_) {
    /* 保存が使えない環境では通常の入口・通常の傾向で続行する */
  }
  initBrowserNotice();
  selectTendency(initial, { record: false });
  drawQuestion();
  if (!welcomed) show("view-welcome");
  else goEntry();
})();

// ---------- Service Worker（M6：更新の混ざりを防ぐ） ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
