// ときたね 問いデータ（静的データ）
// depth: "shallow"（浅）/ "mid"（中）/ "deep"（深い帯・ゆっくり向き合う専用）
// season: "spring"|"summer"|"autumn"|"winter"（その季節だけ出る問い。なければ通年）
// 浅〜中9問：問い-初期セット9問案.md／深い帯6問：問い-深い帯最終案.md（2026-11-11確定）
// 季節の問い8問・深い帯の追加4問：2026-11-12、P2で追加（絶対ラインで審査済み）
export const QUESTIONS = [
  // 浅い帯
  { id: "q01", text: "今朝、目が覚めて最初に目に入ったものは？", depth: "shallow", category: "目覚め" },
  { id: "q02", text: "今日、ふと手に取ったものは？", depth: "shallow", category: "物" },
  { id: "q03", text: "いま見えているもので、一番丸いものは？", depth: "shallow", category: "形" },
  { id: "q04", text: "今日の空で、覚えている色は？", depth: "shallow", category: "空" },
  { id: "q05", text: "今いる場所から聞こえる音を、ひとつ書くなら？", depth: "shallow", category: "音" },
  // 中間の帯
  { id: "q06", text: "今日すれ違った景色で、少しだけ覚えているものは？", depth: "mid", category: "景色" },
  { id: "q07", text: "最近食べたもので、もう一度思い出せる味は？", depth: "mid", category: "味" },
  { id: "q08", text: "明日の朝、最初に口にしたいものは？", depth: "mid", category: "朝" },
  { id: "q09", text: "次の季節に、また見たい景色は？", depth: "mid", category: "季節" },
  // 深い帯（「ゆっくり向き合う」を選んだときだけ）
  { id: "q10", text: "今日、時間をかけたことは？", depth: "deep", category: "時間" },
  { id: "q11", text: "少し前の自分へ、今なら返したい言葉は？", depth: "deep", category: "過去" },
  { id: "q12", text: "今日、まだ途中になっていることは？", depth: "deep", category: "未完了" },
  { id: "q13", text: "今日、思い出すと少し嬉しくなる出来事は？", depth: "deep", category: "出来事" },
  { id: "q14", text: "今、頭の片隅にずっと残っていることは？", depth: "deep", category: "気がかり" },
  { id: "q15", text: "しばらく先の自分へ、今日のことをひとこと残すなら？", depth: "deep", category: "未来" },
  // 深い帯の追加（2026-11-12）。重いテーマは状態の描写の形に置き、詰問・診断・評価はしない
  { id: "q24", text: "この頃、静かに続いていることは？", depth: "deep", category: "継続" },
  { id: "q25", text: "今日、自分でも意外だった反応は？", depth: "deep", category: "反応" },
  { id: "q26", text: "最近、時間がゆっくり流れたと感じた場面は？", depth: "deep", category: "流れ" },
  { id: "q27", text: "今、そっと大切にしたいと思っているものは？", depth: "deep", category: "大切なもの" },
  // 季節の問い（その季節のあいだだけ候補に入る）
  { id: "q16", text: "この春、初めて見た花や芽は？", depth: "shallow", category: "春の芽", season: "spring" },
  { id: "q17", text: "春になって、身の回りで新しくなったものは？", depth: "mid", category: "春の変化", season: "spring" },
  { id: "q18", text: "今日聞いた、夏らしい音は？", depth: "shallow", category: "夏の音", season: "summer" },
  { id: "q19", text: "この夏、もう一度行きたい場所は？", depth: "mid", category: "夏の場所", season: "summer" },
  { id: "q20", text: "今日、秋らしい香りや味を感じたものは？", depth: "shallow", category: "秋の香り", season: "autumn" },
  { id: "q21", text: "この秋、初めて手に取ったものは？", depth: "mid", category: "秋の物", season: "autumn" },
  { id: "q22", text: "今日、あたたかいと感じたものは？", depth: "shallow", category: "冬の温かさ", season: "winter" },
  { id: "q23", text: "この冬、静かだと感じた場面は？", depth: "mid", category: "冬の静けさ", season: "winter" },
];

// 日付から季節を決める（日本の四季：春3〜5月／夏6〜8月／秋9〜11月／冬12〜2月）
export function seasonOf(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

// 傾向ごとの出し分け（深さタグで選ぶ。プールは分けず、この関数で絞る）
// 季節の問いは、今の季節のものだけが候補に入る
export function poolForTendency(tendency, season = seasonOf()) {
  const inSeason = QUESTIONS.filter((q) => !q.season || q.season === season);
  if (tendency === "deep") return inSeason.filter((q) => q.depth === "deep");
  if (tendency === "light") return inSeason.filter((q) => q.depth === "shallow");
  return inSeason.filter((q) => q.depth !== "deep");
}

// アプリを開いたときの初期傾向を決める（設定「開いたときの傾向」）
// - 引き継ぎOFF（いつも「今日を残す」から始める）: 常に "daily"
// - 引き継ぎON（前回の傾向のまま始める）: 前回の傾向。ただし「ゆっくり向き合う」(deep) は
//   その日の同意を大切にするため、決して引き継がない（2026-11-11 ゆき決定）
export function initialTendency(carryover, lastTendency) {
  if (carryover !== "on") return "daily";
  if (lastTendency === "light" || lastTendency === "daily") return lastTendency;
  return "daily";
}
