/**
 * 一次資料ベース教材生成スクリプト v2
 *
 * 全48試験の教材を一次資料（条文/過去問/基準）を根拠にしてClaude APIで生成
 * 根拠なしのAI自由生成はゼロ。全て一次資料を渡した上で生成する。
 *
 * 使い方:
 *   1. まず bun run scripts/fetch-laws.ts で法令を取得
 *   2. bun run scripts/generate-materials-v2.ts で教材生成
 *
 * 出力: scripts/materials-v2/ にJSONファイル
 */

import Anthropic from "@anthropic-ai/sdk";
import { EXAM_CATEGORIES } from "../src/lib/exams";
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const OUTPUT_DIR = "./scripts/materials-v2";
const LAWS_DIR = "./scripts/laws";
const PROGRESS_FILE = `${OUTPUT_DIR}/_progress.json`;

// ========== 試験→一次資料のマッピング ==========

// 法令名→試験IDマッピング
const EXAM_LAW_MAP: Record<string, string[]> = {
  "yobi-shihou": ["日本国憲法", "民法", "刑法", "商法", "会社法", "民事訴訟法", "刑事訴訟法"],
  "shihou-shiken": ["日本国憲法", "民法", "刑法", "商法", "会社法", "民事訴訟法", "刑事訴訟法"],
  "shihou-shoshi": ["民法", "会社法", "刑法", "民事訴訟法", "不動産登記法"],
  "gyousei-shoshi": ["日本国憲法", "民法", "行政手続法", "行政不服審査法", "行政事件訴訟法", "国家賠償法", "地方自治法"],
  "sharoshi": ["労働基準法", "労働安全衛生法", "労働者災害補償保険法", "雇用保険法", "健康保険法", "国民年金法", "厚生年金保険法"],
  "benri-shi": ["特許法", "実用新案法", "意匠法", "商標法", "著作権法", "不正競争防止法"],
  "business-law": ["民法", "会社法", "消費者契約法", "独占禁止法", "個人情報保護法", "不正競争防止法", "労働基準法"],
  "chizai": ["特許法", "意匠法", "商標法", "著作権法", "不正競争防止法"],
  "kojin-joho": ["個人情報保護法"],
  "takken": ["民法", "宅地建物取引業法", "借地借家法", "都市計画法", "建築基準法"],
  "kenchiku-shi": ["建築基準法", "都市計画法", "消防法"],
  "mankan": ["区分所有法", "民法"],
  "chintai": ["借地借家法", "民法"],
  "kounin-kaikeishi": ["会社法", "金融商品取引法", "法人税法", "消費税法"],
  "zeirishi": ["法人税法", "所得税法", "相続税法", "消費税法"],
  "fp2": ["所得税法", "相続税法", "民法", "消費者契約法"],
  "gaimuin": ["金融商品取引法"],
  "kashikin": ["貸金業法"],
  "koumuin": ["日本国憲法", "民法", "行政手続法", "行政不服審査法", "行政事件訴訟法"],
  "kikenbutsu": ["消防法"],
  "touroku-hanbai": ["医薬品医療機器等法"],
  "hoiku-shi": ["児童福祉法", "社会福祉法"],
  "sg": ["個人情報保護法"],
};

// 法令データを読み込む
function loadLawText(lawName: string): string | null {
  const file = `${LAWS_DIR}/${lawName}.json`;
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    // 最初の50条分を抽出（プロンプトサイズ制限）
    const articles = (data.articles || []).slice(0, 50);
    return articles.map((a: { article: string; content: string }) => `${a.article}\n${a.content}`).join("\n\n");
  } catch {
    return null;
  }
}

// 進捗管理
function loadProgress(): Set<string> {
  if (existsSync(PROGRESS_FILE)) {
    return new Set(JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")));
  }
  return new Set();
}
function saveProgress(done: Set<string>) {
  writeFileSync(PROGRESS_FILE, JSON.stringify([...done], null, 2));
}

// ========== 教材生成 ==========

async function generateWithSource(
  examName: string,
  subject: string,
  topic: string,
  sourceType: "law" | "exam_range" | "official_doc",
  sourceText: string
): Promise<string> {
  const sourceLabel = sourceType === "law" ? "法令条文" : sourceType === "exam_range" ? "出題範囲" : "公式資料";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `あなたは${examName}の試験対策教材を作成する専門家です。

## 指示
以下の**${sourceLabel}を根拠として**、「${subject} > ${topic}」の試験対策解説を作成してください。

## 絶対ルール
1. 以下の${sourceLabel}に**書かれている内容のみ**を根拠にすること
2. ${sourceLabel}にない情報を推測で追加しないこと
3. 条文番号・根拠条項を必ず明記すること
4. 不確実な情報は「※要確認」と明記すること

## ${sourceLabel}
${sourceText.slice(0, 8000)}

## 作成する教材の形式
1. **概要**（200字以内）
2. **重要ポイント**（箇条書き、各ポイントに根拠条文を明記）
3. **試験で問われるポイント**（頻出度 A/B/C 付き）
4. **間違えやすいポイント**（「注意」として明示）
5. **覚え方のコツ**（語呂合わせや比較表）
6. **関連トピック**（他に学ぶべき項目）

マークダウン形式で800〜1200文字程度。`,
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function generateWithoutSource(
  examName: string,
  subject: string,
  topic: string,
  examContext: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `あなたは${examName}の試験対策教材を作成する専門家です。

## 指示
「${subject} > ${topic}」の試験対策解説を作成してください。

## 試験情報
${examContext}

## 絶対ルール
1. 確信がある情報のみ記載すること
2. 不確実な情報は**必ず**「※要確認：最新の出題範囲を確認してください」と明記すること
3. 法令が関係する場合は条文番号を明記（不確かな場合は「条文番号要確認」と書く）
4. 「一般的に」「おそらく」などの曖昧な表現を使わないこと

## 作成する教材の形式
1. **概要**（200字以内）
2. **重要ポイント**（箇条書き）
3. **試験で問われるポイント**（頻出度 A/B/C 付き）
4. **間違えやすいポイント**
5. **覚え方のコツ**
6. **関連トピック**

マークダウン形式で800〜1200文字程度。`,
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const done = loadProgress();
  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let totalTopics = 0;

  for (const exam of EXAM_CATEGORIES) {
    for (const subject of exam.subjects) {
      totalTopics += subject.topics.length;
    }
  }

  console.log(`\n📚 一次資料ベース教材生成 v2 開始`);
  console.log(`   ${EXAM_CATEGORIES.length}試験, ${totalTopics}トピック\n`);

  // 利用可能な法令データを確認
  const availableLaws = new Set(
    existsSync(LAWS_DIR)
      ? readdirSync(LAWS_DIR).filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""))
      : []
  );
  console.log(`   利用可能な法令データ: ${availableLaws.size}法令\n`);

  for (const exam of EXAM_CATEGORIES) {
    const examFile = `${OUTPUT_DIR}/${exam.id}.json`;
    let materials: { examId: string; subject: string; topic: string; content: string; sourceType: string; generatedAt: string }[] = [];

    if (existsSync(examFile)) {
      materials = JSON.parse(readFileSync(examFile, "utf-8"));
    }

    const examLaws = EXAM_LAW_MAP[exam.id] || [];

    for (const subject of exam.subjects) {
      for (const topic of subject.topics) {
        const key = `${exam.id}::${subject.name}::${topic}`;
        if (done.has(key)) { skipped++; continue; }

        try {
          // 法令テキストを探す
          let sourceText = "";
          let sourceType: "law" | "exam_range" | "official_doc" = "exam_range";

          for (const lawName of examLaws) {
            const text = loadLawText(lawName);
            if (text) {
              // トピックに関連する条文を検索
              const relevantParts = text.split("\n\n").filter(p =>
                p.includes(topic) || p.includes(subject.name)
              ).join("\n\n");

              if (relevantParts.length > 100) {
                sourceText = relevantParts;
                sourceType = "law";
                break;
              } else if (!sourceText && text.length > 100) {
                // 関連条文がなくても法令全体の冒頭を使う
                sourceText = text.slice(0, 4000);
                sourceType = "law";
              }
            }
          }

          let content: string;
          if (sourceText) {
            console.log(`  📜 ${exam.name} > ${subject.name} > ${topic} [${sourceType}]`);
            content = await generateWithSource(exam.name, subject.name, topic, sourceType, sourceText);
          } else {
            console.log(`  📝 ${exam.name} > ${subject.name} > ${topic} [出題範囲ベース]`);
            content = await generateWithoutSource(exam.name, subject.name, topic,
              `試験名: ${exam.name}\n科目: ${subject.name}\n全トピック: ${subject.topics.join(", ")}\n論述式: ${exam.hasEssay ? "あり" : "なし"}`
            );
          }

          materials.push({
            examId: exam.id,
            subject: subject.name,
            topic,
            content,
            sourceType: sourceText ? sourceType : "ai_with_context",
            generatedAt: new Date().toISOString(),
          });

          done.add(key);
          generated++;
          writeFileSync(examFile, JSON.stringify(materials, null, 2));
          saveProgress(done);

          await new Promise(r => setTimeout(r, 1200));
        } catch (err) {
          console.error(`  ❌ ${exam.name} > ${subject.name} > ${topic}:`, err);
          errors++;
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 教材生成v2完了`);
  console.log(`  生成: ${generated}`);
  console.log(`  スキップ: ${skipped}`);
  console.log(`  エラー: ${errors}`);
  console.log(`  合計: ${totalTopics}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
