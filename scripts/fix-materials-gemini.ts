/**
 * 教材修正パイプライン（Gemini版）
 *
 * Geminiが検出したissueをGemini自身に修正させる。
 * Claude生成 → Gemini検証 → Gemini修正 → Claude再検証（別途）
 *
 * 使い方:
 *   source .env.local && bun run scripts/fix-materials-gemini.ts
 *   source .env.local && bun run scripts/fix-materials-gemini.ts --critical-only
 *   source .env.local && bun run scripts/fix-materials-gemini.ts --topic "用途地域"
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  generationConfig: { maxOutputTokens: 16384 },
});

const MATERIALS_FILE = "./scripts/materials-v3/takken-full.json";
const REVIEW_FILE = "./scripts/review/reports/review-gemini-results.json";
const OUTPUT_FILE = "./scripts/materials-v3/takken-full-fixed.json";
const PROGRESS_FILE = "./scripts/materials-v3/_fix_progress.json";
const LAWS_DIR = "./scripts/laws";

// ============================================================
// Types
// ============================================================

interface GeneratedTopic {
  subject: string;
  topic: string;
  content: string;
  charCount: string | number;
  hasLawSource: string | boolean;
  generatedAt: string;
  fixedAt?: string;
  fixedBy?: string;
  fixCount?: number;
}

interface Issue {
  severity: "critical" | "warning" | "info";
  type: string;
  description: string;
  textbookSays: string;
  materialSays: string;
  fix: string;
}

interface ReviewResult {
  imageFile: string;
  textbookContent: string;
  matchedTopics: string[];
  issues: Issue[];
  timestamp: string;
}

interface FixProgress {
  fixedTopics: string[];
  startedAt: string;
  lastUpdated: string;
  stats: {
    totalTopics: number;
    fixedCount: number;
    criticalFixed: number;
    warningFixed: number;
  };
}

// ============================================================
// Issue Aggregation — トピック別にissueを集約
// ============================================================

function aggregateIssuesByTopic(reviews: ReviewResult[]): Map<string, {
  issues: Issue[];
  textbookExcerpts: string[];
}> {
  const topicMap = new Map<string, { issues: Issue[]; textbookExcerpts: string[] }>();

  for (const page of reviews) {
    if (page.issues.length === 0 || page.matchedTopics.length === 0) continue;

    for (const topicName of page.matchedTopics) {
      if (!topicMap.has(topicName)) {
        topicMap.set(topicName, { issues: [], textbookExcerpts: [] });
      }
      const entry = topicMap.get(topicName)!;

      // issueを追加（重複排除はdescriptionベース）
      const existingDescs = new Set(entry.issues.map(i => i.description));
      for (const issue of page.issues) {
        if (!existingDescs.has(issue.description)) {
          entry.issues.push(issue);
          existingDescs.add(issue.description);
        }
      }

      // テキストブック抜粋を保存
      if (page.textbookContent && page.textbookContent.length > 50) {
        entry.textbookExcerpts.push(page.textbookContent);
      }
    }
  }

  return topicMap;
}

// ============================================================
// Law Source Loading — 法令JSONを読み込み
// ============================================================

function loadLawSource(topicName: string): string {
  // トピック名から関連法令を推測
  const lawMapping: Record<string, string[]> = {
    "都市計画": ["都市計画法.json"],
    "用途地域": ["都市計画法.json", "建築基準法.json"],
    "用途制限": ["建築基準法.json"],
    "地域地区": ["都市計画法.json"],
    "区域区分": ["都市計画法.json"],
    "開発許可": ["都市計画法.json"],
    "建蔽率": ["建築基準法.json"],
    "容積率": ["建築基準法.json"],
    "高さ制限": ["建築基準法.json"],
    "斜線制限": ["建築基準法.json"],
    "日影規制": ["建築基準法.json"],
    "防火地域": ["建築基準法.json"],
    "道路制限": ["建築基準法.json"],
    "単体規定": ["建築基準法.json"],
    "宅建業": ["宅建業法.json"],
    "免許": ["宅建業法.json"],
    "宅建士": ["宅建業法.json"],
    "営業保証金": ["宅建業法.json"],
    "保証協会": ["宅建業法.json"],
    "媒介契約": ["宅建業法.json"],
    "重要事項説明": ["宅建業法.json"],
    "35条": ["宅建業法.json"],
    "37条": ["宅建業法.json"],
    "8種制限": ["宅建業法.json"],
    "クーリングオフ": ["宅建業法.json"],
    "手付": ["宅建業法.json", "民法.json"],
    "報酬": ["宅建業法.json"],
    "広告": ["宅建業法.json"],
    "監督処分": ["宅建業法.json"],
    "罰則": ["宅建業法.json"],
    "IT重説": ["宅建業法.json"],
    "住宅瑕疵": ["宅建業法.json"],
    "民法": ["民法.json"],
    "制限行為能力": ["民法.json"],
    "意思表示": ["民法.json"],
    "代理": ["民法.json"],
    "時効": ["民法.json"],
    "物権": ["民法.json"],
    "抵当権": ["民法.json"],
    "債務不履行": ["民法.json"],
    "売買": ["民法.json"],
    "賃貸借": ["民法.json", "借地借家法.json"],
    "請負": ["民法.json"],
    "不法行為": ["民法.json"],
    "相続": ["民法.json"],
    "共有": ["民法.json"],
    "連帯": ["民法.json"],
    "保証": ["民法.json"],
    "相殺": ["民法.json"],
    "先取特権": ["民法.json"],
    "借地": ["借地借家法.json"],
    "借家": ["借地借家法.json"],
    "定期借地": ["借地借家法.json"],
    "造作買取": ["借地借家法.json"],
    "区分所有": ["区分所有法.json"],
    "不動産登記": ["不動産登記法.json"],
    "農地": ["農地法.json"],
    "国土利用計画": ["国土利用計画法.json"],
    "宅地造成": ["宅地造成等規制法.json"],
    "土地区画整理": ["土地区画整理法.json"],
    "所得税": ["所得税法.json"],
    "不動産取得税": ["地方税法.json"],
    "固定資産税": ["地方税法.json"],
    "登録免許税": ["登録免許税法.json"],
    "印紙税": ["印紙税法.json"],
    "景品表示": ["不正競争防止法.json"],
  };

  const parts: string[] = [];
  const loaded = new Set<string>();

  for (const [keyword, files] of Object.entries(lawMapping)) {
    if (topicName.includes(keyword)) {
      for (const file of files) {
        if (loaded.has(file)) continue;
        const lawPath = `${LAWS_DIR}/${file}`;
        if (existsSync(lawPath)) {
          try {
            const lawData = readFileSync(lawPath, "utf-8");
            // 大きすぎる場合は先頭30,000文字に制限
            const trimmed = lawData.length > 30000 ? lawData.slice(0, 30000) + "\n...(以下省略)" : lawData;
            parts.push(`\n### 法令データ: ${file}\n${trimmed}`);
            loaded.add(file);
          } catch {}
        }
      }
    }
  }

  return parts.join("\n");
}

// ============================================================
// Fix Prompt — Gemini に修正を指示
// ============================================================

function buildFixPrompt(
  topic: GeneratedTopic,
  issues: Issue[],
  textbookExcerpts: string[],
  lawSource: string,
): string {
  const criticals = issues.filter(i => i.severity === "critical");
  const warnings = issues.filter(i => i.severity === "warning");

  // テキストブック抜粋を結合（最大20,000文字）
  let textbookContext = textbookExcerpts.join("\n\n---\n\n");
  if (textbookContext.length > 20000) {
    textbookContext = textbookContext.slice(0, 20000) + "\n...(以下省略)";
  }

  return `あなたは宅建試験の教材作成の専門家です。
以下のAI生成教材には、市販テキスト（みんなが欲しかった！宅建士の教科書）との照合で問題が見つかりました。
これらの問題を**全て修正**した改訂版を作成してください。

## ルール（厳守）

1. **修正指示にある内容は全て反映すること** — 1つも漏らさない
2. **既存の正しい内容は維持すること** — 修正対象外の記述を削除しない
3. **条文番号・数字は正確に** — テキストブックまたは法令データに基づく
4. **具体例を豊富に** — 抽象的な定義だけでなく、イメージしやすい例を追加
5. **判例・事例問題は必ず含める** — 試験頻出の具体的ケースを記載
6. **出力はMarkdown形式** — 元の構造（##見出し等）を維持
7. **文字数**: 元の教材より増えてOK。必要な情報は全て含めること
8. **法令の正確性を最優先** — 推測で書かない。法令データがあればそれに基づく

## トピック: ${topic.topic}（${topic.subject}）

## 現在のAI教材（これを修正する）
${topic.content}

## 🔴 Critical Issues（${criticals.length}件）— 必ず全て修正
${criticals.map((issue, i) => `
### Critical #${i + 1}: ${issue.type}
- 問題: ${issue.description}
- テキスト記載: ${issue.textbookSays}
- AI教材の記載: ${issue.materialSays}
- 修正方法: ${issue.fix}
`).join("\n")}

## 🟡 Warning Issues（${warnings.length}件）— 可能な限り修正
${warnings.slice(0, 40).map((issue, i) => `
### Warning #${i + 1}: ${issue.type}
- 問題: ${issue.description}
- テキスト記載: ${issue.textbookSays}
- 修正方法: ${issue.fix}
`).join("\n")}
${warnings.length > 40 ? `\n(他 ${warnings.length - 40} 件のwarningは省略)\n` : ""}

## 市販テキストの該当ページ内容（正解の参考）
${textbookContext}
${lawSource ? `\n## 関連法令データ\n${lawSource}` : ""}

## 出力

修正済みのMarkdown教材を**そのまま**出力してください。
\`\`\`markdown で囲まず、教材本文のみを出力。
元の構造を維持しつつ、全てのissueを反映した完全版を出力すること。`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const criticalOnly = args.includes("--critical-only");
  const topicFilter = args.includes("--topic")
    ? args[args.indexOf("--topic") + 1]
    : null;

  // データ読み込み — 修正済みファイルがあればそれをベースにする
  const baseFile = existsSync(OUTPUT_FILE) ? OUTPUT_FILE : MATERIALS_FILE;
  const materials: GeneratedTopic[] = JSON.parse(readFileSync(baseFile, "utf-8"));
  console.log(`   ベース: ${baseFile}`);
  const reviews: ReviewResult[] = JSON.parse(readFileSync(REVIEW_FILE, "utf-8"));

  // Issue集約
  const topicIssues = aggregateIssuesByTopic(reviews);

  // 進捗読み込み
  let progress: FixProgress = {
    fixedTopics: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    stats: { totalTopics: 0, fixedCount: 0, criticalFixed: 0, warningFixed: 0 },
  };
  if (existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    } catch {}
  }

  // 既に修正済みの出力ファイルがあれば読み込み
  let outputMaterials: GeneratedTopic[] = [];
  if (existsSync(OUTPUT_FILE)) {
    try {
      outputMaterials = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
    } catch {}
  }
  // 出力がなければ元データをコピー
  if (outputMaterials.length === 0) {
    outputMaterials = JSON.parse(JSON.stringify(materials));
  }

  // 修正対象トピックを特定
  const targets: Array<{
    topic: GeneratedTopic;
    issues: Issue[];
    textbookExcerpts: string[];
    index: number;
  }> = [];

  for (let i = 0; i < materials.length; i++) {
    const mat = materials[i];
    const issueData = topicIssues.get(mat.topic);
    if (!issueData || issueData.issues.length === 0) continue;

    // フィルタ
    if (topicFilter && !mat.topic.includes(topicFilter)) continue;
    if (criticalOnly && !issueData.issues.some(is => is.severity === "critical")) continue;

    // 既に修正済みならスキップ
    if (progress.fixedTopics.includes(mat.topic)) continue;

    targets.push({
      topic: mat,
      issues: issueData.issues,
      textbookExcerpts: issueData.textbookExcerpts,
      index: i,
    });
  }

  // issue数でソート（多い順 = 問題が深刻な順）
  targets.sort((a, b) => {
    const aCrit = a.issues.filter(i => i.severity === "critical").length;
    const bCrit = b.issues.filter(i => i.severity === "critical").length;
    return bCrit - aCrit;
  });

  console.log(`\n🔧 教材修正パイプライン（Gemini 2.5 Pro）`);
  console.log(`   修正対象: ${targets.length} トピック`);
  console.log(`   Critical合計: ${targets.reduce((s, t) => s + t.issues.filter(i => i.severity === "critical").length, 0)}`);
  console.log(`   Warning合計: ${targets.reduce((s, t) => s + t.issues.filter(i => i.severity === "warning").length, 0)}`);
  console.log(`   ${criticalOnly ? "⚡ Critical-only モード" : "📋 全issue修正モード"}`);
  if (topicFilter) console.log(`   🔍 フィルタ: "${topicFilter}"`);
  console.log(`   済: ${progress.fixedTopics.length} トピック\n`);

  let fixedInSession = 0;

  for (let t = 0; t < targets.length; t++) {
    const { topic, issues, textbookExcerpts, index } = targets[t];
    const critCount = issues.filter(i => i.severity === "critical").length;
    const warnCount = issues.filter(i => i.severity === "warning").length;

    console.log(`  [${t + 1}/${targets.length}] ${topic.topic}`);
    console.log(`    🔴 ${critCount} critical, 🟡 ${warnCount} warning`);

    try {
      // 法令データ読み込み
      const lawSource = loadLawSource(topic.topic);

      // Geminiに修正依頼
      const prompt = buildFixPrompt(topic, issues, textbookExcerpts, lawSource);

      const result = await model.generateContent([{ text: prompt }]);
      const fixedContent = result.response.text();

      if (!fixedContent || fixedContent.length < topic.content.length * 0.5) {
        console.log(`    ⚠️  出力が短すぎるためスキップ (${fixedContent?.length ?? 0} chars)`);
        continue;
      }

      // 出力を更新
      outputMaterials[index] = {
        ...outputMaterials[index],
        content: fixedContent,
        charCount: String(fixedContent.length),
        fixedAt: new Date().toISOString(),
        fixedBy: "gemini-2.5-pro",
        fixCount: critCount + warnCount,
      };

      // 進捗更新
      progress.fixedTopics.push(topic.topic);
      progress.lastUpdated = new Date().toISOString();
      progress.stats.fixedCount++;
      progress.stats.criticalFixed += critCount;
      progress.stats.warningFixed += warnCount;
      progress.stats.totalTopics = targets.length + progress.fixedTopics.length;

      // 毎回保存
      writeFileSync(OUTPUT_FILE, JSON.stringify(outputMaterials, null, 2));
      writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

      fixedInSession++;
      console.log(`    ✅ 修正完了 (${topic.content.length} → ${fixedContent.length} chars)`);

      // レートリミット対策 — Gemini 2.5 Pro は 2 RPM の場合あり
      const waitSec = 5;
      console.log(`    ⏳ ${waitSec}秒待機...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ ${msg.slice(0, 200)}`);

      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate") || msg.includes("Resource has been exhausted") || msg.includes("high demand") || msg.includes("503") || msg.includes("Service Unavailable")) {
        const retryKey = `retry_${topic.topic}`;
        const retryCount = ((globalThis as any)[retryKey] || 0) as number;
        if (retryCount < 5) {
          (globalThis as any)[retryKey] = retryCount + 1;
          const waitSec = 60 * (retryCount + 1);
          console.log(`    ⏸️  レートリミット（${retryCount + 1}/5回目）。${waitSec}秒待機...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          t--; // リトライ
        } else {
          console.log(`    ⏭️  5回リトライ失敗。スキップ`);
        }
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // 最終レポート
  console.log(`\n========================================`);
  console.log(`📊 修正完了`);
  console.log(`  今回修正: ${fixedInSession} トピック`);
  console.log(`  累計修正: ${progress.fixedTopics.length} トピック`);
  console.log(`  🔴 Critical修正: ${progress.stats.criticalFixed}`);
  console.log(`  🟡 Warning修正: ${progress.stats.warningFixed}`);
  console.log(`  出力: ${OUTPUT_FILE}`);
  console.log(`========================================\n`);

  if (fixedInSession > 0) {
    console.log(`次のステップ:`);
    console.log(`  1. 修正内容を確認: diff <(cat ${MATERIALS_FILE} | python3 -m json.tool) <(cat ${OUTPUT_FILE} | python3 -m json.tool)`);
    console.log(`  2. Claude再検証: bun run scripts/verify-fixes-claude.ts`);
    console.log(`  3. 問題なければ本番反映: cp ${OUTPUT_FILE} ${MATERIALS_FILE}`);
    console.log(`  4. RAG再投入: bun run scripts/ingest-takken-v3.ts`);
  }
}

main().catch(console.error);
