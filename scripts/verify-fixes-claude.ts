/**
 * 修正検証パイプライン（Claude版）
 *
 * Geminiが修正した教材をClaudeでクロスチェックする。
 * 修正前 vs 修正後を比較し、以下を確認:
 *   1. Criticalが全て修正されているか
 *   2. 新たな誤りが混入していないか
 *   3. 既存の正しい情報が削除されていないか
 *
 * 使い方:
 *   source .env.local && bun run scripts/verify-fixes-claude.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

const ORIGINAL_FILE = "./scripts/materials-v3/takken-full.json";
const FIXED_FILE = "./scripts/materials-v3/takken-full-fixed.json";
const REVIEW_FILE = "./scripts/review/reports/review-gemini-results.json";
const REPORT_FILE = "./scripts/review/reports/verify-fixes-report.json";

interface GeneratedTopic {
  subject: string;
  topic: string;
  content: string;
  charCount: string | number;
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
}

interface VerifyResult {
  topic: string;
  verdict: "pass" | "partial" | "fail" | "regression";
  criticalsBefore: number;
  criticalsFixed: number;
  criticalsRemaining: number;
  newIssues: string[];
  deletedContent: string[];
  notes: string;
}

// Issue集約
function getTopicIssues(reviews: ReviewResult[]): Map<string, Issue[]> {
  const map = new Map<string, Issue[]>();
  for (const page of reviews) {
    for (const topic of page.matchedTopics) {
      if (!map.has(topic)) map.set(topic, []);
      const existing = new Set(map.get(topic)!.map(i => i.description));
      for (const issue of page.issues) {
        if (!existing.has(issue.description)) {
          map.get(topic)!.push(issue);
          existing.add(issue.description);
        }
      }
    }
  }
  return map;
}

async function verifyTopic(
  original: GeneratedTopic,
  fixed: GeneratedTopic,
  criticals: Issue[],
): Promise<VerifyResult> {
  const prompt = `あなたは宅建教材の品質管理担当です。
Gemini 2.5 Pro が修正した教材を検証してください。

## 検証項目

1. **Critical修正の確認**: 以下のCritical issueが全て修正されているか
2. **情報の欠落チェック**: 修正前にあった正しい情報が削除されていないか
3. **新規エラーチェック**: 修正で新たな誤りが混入していないか
4. **法令の正確性**: 条文番号・数字・要件が正確か

## トピック: ${original.topic}

## Critical Issues（修正されるべき問題）
${criticals.map((c, i) => `${i + 1}. [${c.type}] ${c.description}\n   修正方法: ${c.fix}`).join("\n")}

## 修正前の教材
${original.content.slice(0, 8000)}

## 修正後の教材
${fixed.content.slice(0, 12000)}

## 出力（JSON）
{
  "verdict": "pass（全Critical修正済み＋問題なし）/ partial（一部修正済み）/ fail（未修正多い）/ regression（新たな問題あり）",
  "criticalsFixed": 修正されたCritical数,
  "criticalsRemaining": 未修正のCritical数,
  "newIssues": ["新たに見つかった問題（あれば）"],
  "deletedContent": ["削除された重要情報（あれば）"],
  "notes": "総合コメント"
}

JSONのみ出力。`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        topic: original.topic,
        criticalsBefore: criticals.length,
        ...parsed,
      };
    }
  } catch {}

  return {
    topic: original.topic,
    verdict: "fail",
    criticalsBefore: criticals.length,
    criticalsFixed: 0,
    criticalsRemaining: criticals.length,
    newIssues: ["検証パース失敗"],
    deletedContent: [],
    notes: text.slice(0, 500),
  };
}

async function main() {
  if (!existsSync(FIXED_FILE)) {
    console.error(`❌ 修正ファイルが見つかりません: ${FIXED_FILE}`);
    console.error(`   先に修正を実行: bun run scripts/fix-materials-gemini.ts`);
    process.exit(1);
  }

  const originals: GeneratedTopic[] = JSON.parse(readFileSync(ORIGINAL_FILE, "utf-8"));
  const fixeds: GeneratedTopic[] = JSON.parse(readFileSync(FIXED_FILE, "utf-8"));
  const reviews: ReviewResult[] = JSON.parse(readFileSync(REVIEW_FILE, "utf-8"));
  const topicIssues = getTopicIssues(reviews);

  // 修正されたトピックのみ検証
  const targets: Array<{ original: GeneratedTopic; fixed: GeneratedTopic; criticals: Issue[] }> = [];

  for (let i = 0; i < fixeds.length; i++) {
    const fixed = fixeds[i];
    if (!fixed.fixedAt) continue; // 未修正はスキップ

    const original = originals[i];
    const issues = topicIssues.get(fixed.topic) ?? [];
    const criticals = issues.filter(is => is.severity === "critical");
    if (criticals.length === 0) continue;

    targets.push({ original, fixed, criticals });
  }

  console.log(`\n🔍 修正検証パイプライン（Claude Sonnet）`);
  console.log(`   検証対象: ${targets.length} トピック\n`);

  const results: VerifyResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const { original, fixed, criticals } = targets[i];
    console.log(`  [${i + 1}/${targets.length}] ${original.topic} (🔴${criticals.length})`);

    try {
      const result = await verifyTopic(original, fixed, criticals);
      results.push(result);

      const icon = result.verdict === "pass" ? "✅" :
                   result.verdict === "partial" ? "🟡" :
                   result.verdict === "regression" ? "🔴" : "❌";
      console.log(`    ${icon} ${result.verdict} — ${result.criticalsFixed}/${result.criticalsBefore} fixed`);
      if (result.newIssues.length > 0) {
        console.log(`    ⚠️  新規問題: ${result.newIssues[0].slice(0, 80)}`);
      }

      // レートリミット
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ ${msg.slice(0, 150)}`);

      if (msg.includes("429") || msg.includes("rate")) {
        console.log(`    ⏸️  60秒待機...`);
        await new Promise(r => setTimeout(r, 60000));
        i--;
      } else {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // レポート保存
  writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));

  // サマリー
  const pass = results.filter(r => r.verdict === "pass").length;
  const partial = results.filter(r => r.verdict === "partial").length;
  const fail = results.filter(r => r.verdict === "fail").length;
  const regression = results.filter(r => r.verdict === "regression").length;

  console.log(`\n========================================`);
  console.log(`📊 検証完了`);
  console.log(`  ✅ Pass: ${pass}`);
  console.log(`  🟡 Partial: ${partial}`);
  console.log(`  ❌ Fail: ${fail}`);
  console.log(`  🔴 Regression: ${regression}`);
  console.log(`  レポート: ${REPORT_FILE}`);
  console.log(`========================================\n`);

  if (regression > 0) {
    console.log(`⚠️  ${regression}件のregressionあり。手動確認が必要です。`);
  }
  if (fail === 0 && regression === 0) {
    console.log(`✅ 全トピック問題なし。本番反映可能:`);
    console.log(`   cp ${FIXED_FILE} ${ORIGINAL_FILE}`);
    console.log(`   bun run scripts/ingest-takken-v3.ts`);
  }
}

main().catch(console.error);
