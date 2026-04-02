/**
 * 宅建試験 教材生成スクリプト v3
 *
 * 変更点:
 *   - 1トピック 5,000〜10,000字で生成（v2は800〜1,200字だった）
 *   - トピックごとに関連条文を全て渡す（v2は最初の50条だけだった）
 *   - max_tokens: 8192（v2は2048）
 *   - 宅建業法がないため、宅建業法関連トピックはClaude知識+厳格な不確実性表記
 *
 * 使い方:
 *   bun run scripts/generate-takken-v3.ts
 *
 * 出力: scripts/materials-v3/takken.json
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const OUTPUT_DIR = "./scripts/materials-v3";
const LAWS_DIR = "./scripts/laws";
const OUTPUT_FILE = `${OUTPUT_DIR}/takken.json`;

// ========== 宅建トピック → 関連条文のマッピング ==========

interface TopicDef {
  subject: string;
  topic: string;
  // 法令名 → 条文番号キーワード（部分一致で検索）
  lawSections: Record<string, string[]>;
  // 法令データがない場合の補足指示
  extraContext?: string;
}

const TAKKEN_TOPICS: TopicDef[] = [
  // === 権利関係（民法等） ===
  {
    subject: "権利関係（民法等）",
    topic: "意思表示",
    lawSections: {
      "民法": ["第93条", "第94条", "第95条", "第96条", "第97条", "第98条", "第3条の2", "第3_2条"],
    },
  },
  {
    subject: "権利関係（民法等）",
    topic: "代理",
    lawSections: {
      "民法": ["第99条", "第100条", "第101条", "第102条", "第103条", "第104条", "第105条", "第106条", "第107条", "第108条", "第109条", "第110条", "第111条", "第112条", "第113条", "第114条", "第115条", "第116条", "第117条", "第118条"],
    },
  },
  {
    subject: "権利関係（民法等）",
    topic: "物権変動",
    lawSections: {
      "民法": ["第175条", "第176条", "第177条", "第178条", "第179条"],
    },
  },
  {
    subject: "権利関係（民法等）",
    topic: "抵当権",
    lawSections: {
      "民法": ["第369条", "第370条", "第371条", "第372条", "第373条", "第374条", "第375条", "第376条", "第377条", "第378条", "第379条", "第380条", "第381条", "第382条", "第383条", "第384条", "第385条", "第386条", "第387条", "第388条", "第389条", "第390条", "第391条", "第392条", "第393条", "第394条", "第395条", "第396条", "第397条", "第398条", "第398条の2", "第398_2条", "第398条の3", "第398_3条"],
    },
  },
  {
    subject: "権利関係（民法等）",
    topic: "賃貸借",
    lawSections: {
      "民法": ["第601条", "第602条", "第603条", "第604条", "第605条", "第605条の2", "第605_2条", "第605条の3", "第605_3条", "第605条の4", "第605_4条", "第606条", "第607条", "第607条の2", "第607_2条", "第608条", "第609条", "第610条", "第611条", "第612条", "第613条", "第614条", "第615条", "第616条", "第616条の2", "第616_2条", "第617条", "第618条", "第619条", "第620条", "第621条", "第622条"],
      "借地借家法": [],  // 全条文を使う
    },
  },
  {
    subject: "権利関係（民法等）",
    topic: "相続",
    lawSections: {
      "民法": ["第882条", "第883条", "第884条", "第885条", "第886条", "第887条", "第888条", "第889条", "第890条", "第891条", "第892条", "第893条", "第894条", "第895条", "第896条", "第897条", "第898条", "第899条", "第900条", "第901条", "第902条", "第903条", "第904条", "第905条", "第906条", "第907条", "第908条", "第909条", "第910条", "第915条", "第916条", "第917条", "第918条", "第919条", "第920条", "第921条", "第922条", "第923条", "第924条", "第925条", "第938条", "第939条", "第940条", "第960条", "第961条", "第964条", "第967条", "第968条", "第969条", "第970条", "第1028条", "第1029条", "第1030条", "第1042条", "第1043条", "第1044条", "第1046条"],
    },
  },
  // === 法令上の制限 ===
  {
    subject: "法令上の制限",
    topic: "都市計画法",
    lawSections: {
      "都市計画法": [],  // 全条文（主要部分）
    },
  },
  {
    subject: "法令上の制限",
    topic: "建築基準法",
    lawSections: {
      "建築基準法": [],  // 全条文（主要部分）
    },
  },
  {
    subject: "法令上の制限",
    topic: "国土利用計画法",
    lawSections: {},
    extraContext: "国土利用計画法の法令データなし。事後届出制（23条）、事前届出制（27条の4）、許可制（14条）を中心に、注視区域・監視区域・規制区域の違い、届出対象面積（市街化区域2,000㎡、市街化調整区域5,000㎡、都市計画区域外10,000㎡）を正確に記載すること。不確実な条文番号は「※要確認」と明記。",
  },
  {
    subject: "法令上の制限",
    topic: "農地法",
    lawSections: {},
    extraContext: "農地法の法令データなし。3条許可（権利移動）、4条許可（転用）、5条許可（転用目的の権利移動）の違いを中心に、許可権者（農業委員会/都道府県知事）、市街化区域の特例（届出制）、許可なしの効果（無効）を正確に記載すること。不確実な条文番号は「※要確認」と明記。",
  },
  // === 宅建業法 ===
  {
    subject: "宅建業法",
    topic: "免許",
    lawSections: {},
    extraContext: "宅建業法の法令データなし。免許の種類（国土交通大臣/都道府県知事）、免許の基準（欠格事由）、免許の有効期間（5年）、免許換え、宅建士の登録・試験について正確に記載すること。特に欠格事由（暴力団員、禁錮以上の刑、罰金刑（暴力系・宅建業法違反のみ）、5年間の制限）を詳細に。不確実な条文番号は「※要確認」と明記。",
  },
  {
    subject: "宅建業法",
    topic: "営業保証金",
    lawSections: {},
    extraContext: "宅建業法の法令データなし。営業保証金制度（本店1,000万円、支店500万円）と保証協会制度（弁済業務保証金分担金：本店60万円、支店30万円）の違いを中心に。供託所、還付、取戻しの手続きを正確に。不確実な条文番号は「※要確認」と明記。",
  },
  {
    subject: "宅建業法",
    topic: "重要事項説明",
    lawSections: {},
    extraContext: "宅建業法35条（重要事項説明）。説明の主体（宅建士）、説明の相手方（買主・借主）、説明の時期（契約前）、記載事項（登記、法令制限、インフラ、代金以外の金銭、契約解除、損害賠償、手付金保全、瑕疵担保責任の措置等）、IT重説の要件を詳細に。不確実な条文番号は「※要確認」と明記。",
  },
  {
    subject: "宅建業法",
    topic: "37条書面",
    lawSections: {},
    extraContext: "宅建業法37条（契約書面）。必要的記載事項と任意的記載事項の違い、35条書面との比較、交付の相手方（両当事者）、宅建士の記名要件を詳細に。不確実な条文番号は「※要確認」と明記。",
  },
  {
    subject: "宅建業法",
    topic: "8種制限",
    lawSections: {},
    extraContext: "宅建業法の自ら売主制限（8種制限）。適用場面（宅建業者が売主、非業者が買主の場合のみ）。8つの制限：①クーリングオフ、②損害賠償額の予定の制限（代金の20%）、③手付の性質・額の制限（代金の20%、解約手付とみなす）、④手付金等の保全措置、⑤自己所有に属しない物件の売買制限、⑥瑕疵担保責任の特約制限（引渡しから2年以上）、⑦割賦販売の契約解除の制限、⑧所有権留保の禁止。不確実な条文番号は「※要確認」と明記。",
  },
  // === 税・その他 ===
  {
    subject: "税・その他",
    topic: "不動産取得税",
    lawSections: {},
    extraContext: "不動産取得税。課税主体（都道府県）、課税客体（不動産の取得）、税率（標準税率4%、土地・住宅は3%の軽減税率）、課税標準（固定資産税評価額）、免税点（土地10万円、建物23万円等）、特例（新築住宅の1,200万円控除、宅地の課税標準1/2特例）を正確に。不確実な数値は「※要確認」と明記。",
  },
  {
    subject: "税・その他",
    topic: "固定資産税",
    lawSections: {},
    extraContext: "固定資産税。課税主体（市町村）、納税義務者（1月1日時点の所有者）、税率（標準税率1.4%）、課税標準（固定資産税評価額）、免税点（土地30万円、建物20万円）、住宅用地の特例（小規模住宅用地1/6、一般住宅用地1/3）、新築住宅の税額軽減（3年間1/2、マンション5年間1/2）を正確に。不確実な数値は「※要確認」と明記。",
  },
  {
    subject: "税・その他",
    topic: "譲渡所得税",
    lawSections: {
      "所得税法": ["第33条"],
    },
    extraContext: "譲渡所得税。長期（5年超）と短期（5年以下）の税率の違い（長期：所得税15%+住民税5%、短期：所得税30%+住民税9%）、3,000万円特別控除、居住用財産の軽減税率の特例（10年超所有）、買換え特例、特定の居住用財産の場合の損益通算・繰越控除を正確に。不確実な数値は「※要確認」と明記。",
  },
  {
    subject: "税・その他",
    topic: "統計",
    lawSections: {},
    extraContext: "宅建試験の統計問題。地価公示、住宅着工統計、不動産価格指数、土地白書、法人企業統計の最新動向。※この分野は毎年数値が変わるため、「最新の統計データを各自確認すること」と必ず明記。過去の出題パターンと読み方のコツを中心に。",
  },
  {
    subject: "税・その他",
    topic: "土地・建物",
    lawSections: {},
    extraContext: "宅建試験の土地・建物の知識問題。土地：地形（台地・丘陵・低地・埋立地等）の特徴と災害リスク、宅地としての適否。建物：木造・鉄骨造・RC造・SRC造の特徴、建築構造の基礎知識。過去問で頻出のパターンを中心に。",
  },
];

// ========== 法令データ読み込み ==========

interface LawArticle {
  article: string;
  content: string;
}

function loadLaw(lawName: string): LawArticle[] {
  const file = `${LAWS_DIR}/${lawName}.json`;
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return data.articles || [];
  } catch {
    return [];
  }
}

function extractRelevantArticles(articles: LawArticle[], articleNumbers: string[]): string {
  if (articleNumbers.length === 0) {
    // 空配列 = 主要部分を全て使う（上限あり）
    const text = articles
      .slice(0, 100)
      .map(a => `${a.article}\n${a.content}`)
      .join("\n\n");
    return text.slice(0, 30000);
  }

  const matched: LawArticle[] = [];
  for (const article of articles) {
    for (const num of articleNumbers) {
      if (article.article.includes(num) || article.content.includes(num)) {
        matched.push(article);
        break;
      }
    }
  }

  return matched.map(a => `${a.article}\n${a.content}`).join("\n\n");
}

// ========== 教材生成 ==========

async function generateTopicMaterial(def: TopicDef): Promise<string> {
  // 関連条文を収集
  let sourceTexts: string[] = [];
  let lawNames: string[] = [];

  for (const [lawName, articleNums] of Object.entries(def.lawSections)) {
    const articles = loadLaw(lawName);
    if (articles.length === 0) continue;
    const text = extractRelevantArticles(articles, articleNums);
    if (text.length > 0) {
      sourceTexts.push(`【${lawName}】\n${text}`);
      lawNames.push(lawName);
    }
  }

  const hasLawData = sourceTexts.length > 0;
  const sourceText = sourceTexts.join("\n\n---\n\n");

  const prompt = `あなたは宅建試験（宅地建物取引士試験）の教材を作成するプロの講師です。
20年以上の指導経験があり、合格者を多数輩出しています。

## 作成するトピック
科目: ${def.subject}
トピック: ${def.topic}

${hasLawData ? `## 根拠となる法令条文
以下の法令条文を根拠として教材を作成してください。

${sourceText.slice(0, 40000)}` : ""}

${def.extraContext ? `## 補足情報（法令データがない場合の参考）
${def.extraContext}` : ""}

## 絶対ルール
1. ${hasLawData ? "上記の法令条文に書かれている内容を根拠にすること" : "確信がある情報のみ記載すること"}
2. 条文番号を必ず明記すること（不確かな場合は「※条文番号要確認」）
3. 不確実な情報は「※要確認」と明記すること
4. 宅建試験の出題傾向を踏まえて、試験に出る部分を重点的に解説すること
5. 具体例・事例を多く入れること（抽象的な説明だけでは試験に対応できない）

## 教材の構成（5,000〜10,000字で作成）

### 1. 概要（300字程度）
- このトピックが宅建試験でどう出題されるか
- 配点の目安と重要度

### 2. 基本知識（1,500〜3,000字）
- 制度の趣旨・目的
- 基本的な仕組み・要件・効果
- 全ての重要概念を網羅的に解説
- 条文の根拠を必ず明記

### 3. 重要論点の深掘り（1,500〜3,000字）
- 試験で頻出の論点を個別に深掘り
- 各論点ごとに：
  - 原則と例外
  - 具体例・事例（「Aが土地をBに売却した場合...」等）
  - ひっかけパターン（過去問でこう聞かれる）
  - 正誤の判断基準

### 4. 比較・横断整理（500〜1,000字）
- 似た制度・概念との比較表
- 混同しやすいポイントの整理
- 数字の一覧表（期間・金額・面積等）

### 5. 過去問での出題パターン（500〜1,000字）
- よくある出題形式
- 典型的なひっかけ選択肢
- 正解を見抜くコツ

### 6. 暗記チェックリスト（300〜500字）
- このトピックで絶対に覚えるべき項目の一覧
- 語呂合わせ・覚え方のコツ

マークダウン形式で出力してください。`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ========== メイン ==========

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // 既存の結果を読み込む
  let results: { subject: string; topic: string; content: string; charCount: number; generatedAt: string }[] = [];
  const doneTopics = new Set<string>();

  if (existsSync(OUTPUT_FILE)) {
    results = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
    for (const r of results) {
      doneTopics.add(`${r.subject}::${r.topic}`);
    }
    console.log(`既存データ: ${results.length}トピック`);
  }

  console.log(`\n📚 宅建教材 v3 生成開始（5,000〜10,000字/トピック）`);
  console.log(`   対象: ${TAKKEN_TOPICS.length}トピック\n`);

  for (const def of TAKKEN_TOPICS) {
    const key = `${def.subject}::${def.topic}`;
    if (doneTopics.has(key)) {
      console.log(`  ⏭️  ${def.subject} > ${def.topic} [スキップ]`);
      continue;
    }

    console.log(`  📝 ${def.subject} > ${def.topic} ...`);
    const startTime = Date.now();

    try {
      const content = await generateTopicMaterial(def);
      const charCount = content.length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      results.push({
        subject: def.subject,
        topic: def.topic,
        content,
        charCount,
        generatedAt: new Date().toISOString(),
      });

      doneTopics.add(key);
      writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

      console.log(`  ✅ ${def.subject} > ${def.topic} — ${charCount.toLocaleString()}字 (${elapsed}s)`);

      // レートリミット対策
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ❌ ${def.subject} > ${def.topic}:`, err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // サマリー
  console.log(`\n========================================`);
  console.log(`📊 宅建教材 v3 生成完了`);
  console.log(`  トピック数: ${results.length}`);
  const totalChars = results.reduce((s, r) => s + r.charCount, 0);
  console.log(`  総文字数: ${totalChars.toLocaleString()}字`);
  console.log(`  平均文字数: ${Math.round(totalChars / results.length).toLocaleString()}字/トピック`);
  console.log(`  v2との比較: ${Math.round(totalChars / results.length).toLocaleString()}字 vs 1,150字（v2）`);
  console.log(`========================================\n`);
}

main().catch(console.error);
