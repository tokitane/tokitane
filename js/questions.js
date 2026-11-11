// ときたね 問いデータ（静的データ）
// depth: "shallow"（浅）/ "mid"（中）/ "deep"（深い帯・ゆっくり向き合う専用）
// 浅〜中9問：問い-初期セット9問案.md／深い帯6問：問い-深い帯最終案.md（2026-11-11確定）
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
];

// 傾向ごとの出し分け（深さタグで選ぶ。プールは分けず、この関数で絞る）
export function poolForTendency(tendency) {
  if (tendency === "deep") return QUESTIONS.filter((q) => q.depth === "deep");
  if (tendency === "light") return QUESTIONS.filter((q) => q.depth === "shallow");
  return QUESTIONS.filter((q) => q.depth !== "deep");
}
