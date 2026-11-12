// ときたね 問いデータ（静的データ）
// depth: "shallow"（浅）/ "mid"（中）/ "deep"（深い帯・ゆっくり向き合う専用）
// season: "spring"|"summer"|"autumn"|"winter"（その季節だけ出る問い。なければ通年）
// 浅〜中9問：問い-初期セット9問案.md／深い帯6問：問い-深い帯最終案.md（2026-11-11確定）
// 季節の問い8問・深い帯の追加4問：2026-11-12、P2で追加（絶対ラインで審査済み）
// 問い倍増（27問→54問）：2026-11-12、ゆきの希望で全帯を倍に。浅+5・中+4・深+10・季節+8（絶対ラインで審査し、ゆきが承認）
export const QUESTIONS = [
  // 浅い帯
  { id: "q01", text: "今朝、目が覚めて最初に目に入ったものは？", depth: "shallow", category: "目覚め" },
  { id: "q02", text: "今日、ふと手に取ったものは？", depth: "shallow", category: "物" },
  { id: "q03", text: "いま見えているもので、一番丸いものは？", depth: "shallow", category: "形" },
  { id: "q04", text: "今日の空で、覚えている色は？", depth: "shallow", category: "空" },
  { id: "q05", text: "今いる場所から聞こえる音を、ひとつ書くなら？", depth: "shallow", category: "音" },
  // 浅い帯の追加（2026-11-12、問い倍増）
  { id: "q28", text: "今日、自分の手が触れたもので、感触を覚えているものは？", depth: "shallow", category: "感触" },
  { id: "q29", text: "今日、目に入った文字のなかで、覚えている言葉は？", depth: "shallow", category: "文字" },
  { id: "q30", text: "今日飲んだもので、色を覚えているものは？", depth: "shallow", category: "飲み物" },
  { id: "q31", text: "今日、足元で目に入ったものは？", depth: "shallow", category: "足元" },
  { id: "q32", text: "今日、光が当たって明るく見えたものは？", depth: "shallow", category: "光" },
  // 中間の帯
  { id: "q06", text: "今日すれ違った景色で、少しだけ覚えているものは？", depth: "mid", category: "景色" },
  { id: "q07", text: "最近食べたもので、もう一度思い出せる味は？", depth: "mid", category: "味" },
  { id: "q08", text: "明日の朝、最初に口にしたいものは？", depth: "mid", category: "朝" },
  { id: "q09", text: "次の季節に、また見たい景色は？", depth: "mid", category: "季節" },
  // 中間の帯の追加（2026-11-12、問い倍増）
  { id: "q33", text: "最近、出かけた先で目に留まったものは？", depth: "mid", category: "おでかけ" },
  { id: "q34", text: "最近、ふと口ずさんだ歌や、頭に流れていた曲は？", depth: "mid", category: "音楽" },
  { id: "q35", text: "今週、自分のために使った時間や場所は？", depth: "mid", category: "自分の時間" },
  { id: "q36", text: "明日の自分に、ひとつだけ置いておきたいものは？", depth: "mid", category: "明日への置き物" },
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
  // 深い帯の追加（2026-11-12、問い倍増）。重いテーマは状態・景色の描写の形に置き、詰問・診断・評価・義務づけはしない
  { id: "q37", text: "今日、本当は少し休みたかった場面は？", depth: "deep", category: "休みたかった場面" },
  { id: "q38", text: "最近、言いそびれたままになっている言葉は？", depth: "deep", category: "言いそびれた言葉" },
  { id: "q39", text: "今の自分を、ひとつの景色にたとえるなら？", depth: "deep", category: "景色のたとえ" },
  { id: "q40", text: "この頃、そっと手放したいと思っているものは？", depth: "deep", category: "手放す" },
  { id: "q41", text: "少し先の自分に、そっと託したい願いは？", depth: "deep", category: "願い" },
  { id: "q42", text: "最近、心がほっとした瞬間の景色は？", depth: "deep", category: "安心の景色" },
  { id: "q43", text: "今、言葉にならないまま胸にあるものは？", depth: "deep", category: "言葉にならないもの" },
  { id: "q44", text: "今日、誰かの優しさに触れた場面は？", depth: "deep", category: "優しさ" },
  { id: "q45", text: "この頃、自分の中で静かに変わりつつあるものは？", depth: "deep", category: "静かな変化" },
  { id: "q46", text: "いま、そっと置いておきたい気持ちは？", depth: "deep", category: "置いておきたい気持ち" },
  // 季節の問い（その季節のあいだだけ候補に入る）
  { id: "q16", text: "この春、初めて見た花や芽は？", depth: "shallow", category: "春の芽", season: "spring" },
  { id: "q17", text: "春になって、身の回りで新しくなったものは？", depth: "mid", category: "春の変化", season: "spring" },
  { id: "q18", text: "今日聞いた、夏らしい音は？", depth: "shallow", category: "夏の音", season: "summer" },
  { id: "q19", text: "この夏、もう一度行きたい場所は？", depth: "mid", category: "夏の場所", season: "summer" },
  { id: "q20", text: "今日、秋らしい香りや味を感じたものは？", depth: "shallow", category: "秋の香り", season: "autumn" },
  { id: "q21", text: "この秋、初めて手に取ったものは？", depth: "mid", category: "秋の物", season: "autumn" },
  { id: "q22", text: "今日、あたたかいと感じたものは？", depth: "shallow", category: "冬の温かさ", season: "winter" },
  { id: "q23", text: "この冬、静かだと感じた場面は？", depth: "mid", category: "冬の静けさ", season: "winter" },
  // 季節の問いの追加（2026-11-12、問い倍増）。各季節に浅1問・中1問を追加
  { id: "q47", text: "今日、春の匂いを感じたものは？", depth: "shallow", category: "春の匂い", season: "spring" },
  { id: "q48", text: "この春、始めてみたいと思っていることは？", depth: "mid", category: "春の始まり", season: "spring" },
  { id: "q49", text: "今日、涼しいと感じた場所やものは？", depth: "shallow", category: "夏の涼しさ", season: "summer" },
  { id: "q50", text: "この夏、覚えておきたい夕方の景色は？", depth: "mid", category: "夏の夕方", season: "summer" },
  { id: "q51", text: "今日、秋色だと感じたものは？", depth: "shallow", category: "秋の色", season: "autumn" },
  { id: "q52", text: "この秋、ゆっくり読みたい・見たいものは？", depth: "mid", category: "秋の楽しみ", season: "autumn" },
  { id: "q53", text: "今日、冬の光で明るく見えたものは？", depth: "shallow", category: "冬の光", season: "winter" },
  { id: "q54", text: "この冬、あたたかい飲み物と一緒に過ごしたい場所は？", depth: "mid", category: "冬の場所", season: "winter" },
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
