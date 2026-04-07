/**
 * Fail判定トピック再修正スクリプト
 *
 * 問題: レビュー時に複数トピックにマッチしたissueが別トピックに混入した
 * 対策: issueをトピック名でフィルタし、関連するissueのみで修正する
 *
 * 1. バックアップからfail対象トピックのコンテンツを復元
 * 2. issueをトピック名の関連性でフィルタ
 * 3. Geminiで再修正
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

const BACKUP_FILE = "./scripts/materials-v3/takken-full-fixed-critical-warning.json";
const OUTPUT_FILE = "./scripts/materials-v3/takken-full-fixed.json";
const REVIEW_FILE = "./scripts/review/reports/review-gemini-results.json";
const VERIFY_FILE = "./scripts/review/reports/verify-fixes-report.json";
const LAWS_DIR = "./scripts/laws";

interface GeneratedTopic {
  subject: string;
  topic: string;
  content: string;
  charCount: string | number;
  hasLawSource?: string | boolean;
  generatedAt?: string;
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

// ============================================================
// Issue Relevance Filter — トピックに関連するissueのみ抽出
// ============================================================

function isIssueRelevantToTopic(issue: Issue, topicName: string): boolean {
  const topicKeywords = extractKeywords(topicName);
  const issueText = `${issue.description} ${issue.textbookSays} ${issue.fix}`.toLowerCase();

  // issueのテキストにトピックのキーワードが含まれているか
  let matchCount = 0;
  for (const kw of topicKeywords) {
    if (issueText.includes(kw.toLowerCase())) matchCount++;
  }

  // 少なくとも1つのキーワードマッチが必要
  return matchCount >= 1;
}

function extractKeywords(topicName: string): string[] {
  // 括弧内のキーワードを抽出
  const match = topicName.match(/（(.+)）/);
  const keywords: string[] = [];

  if (match) {
    // 括弧内を「・」で分割
    keywords.push(...match[1].split(/[・、]/));
  }

  // 括弧前のメイン名称
  const mainName = topicName.replace(/（.+）/, "").trim();
  keywords.push(mainName);

  // 条文番号を抽出
  const articleMatch = topicName.match(/(\d+)条/);
  if (articleMatch) keywords.push(`${articleMatch[1]}条`);

  return keywords.filter(k => k.length >= 2);
}

// ============================================================
// Law Source
// ============================================================

function loadLawSource(topicName: string): string {
  const lawMapping: Record<string, string[]> = {
    "物権": ["民法.json"], "対抗要件": ["民法.json"], "質権": ["民法.json"],
    "法定地上権": ["民法.json"], "物上代位": ["民法.json"], "詐害行為": ["民法.json"],
    "保証": ["民法.json"], "相殺": ["民法.json"], "請負": ["民法.json"],
    "賃貸借": ["民法.json", "借地借家法.json"], "使用者責任": ["民法.json"],
    "不法行為": ["民法.json"], "借家": ["借地借家法.json"], "造作買取": ["借地借家法.json"],
    "地域地区": ["都市計画法.json"], "重要事項説明": ["宅建業法.json"],
    "35条": ["宅建業法.json"], "37条": ["宅建業法.json"], "所有権留保": ["宅建業法.json"],
    "印紙税": ["印紙税法.json"], "所得税": ["所得税法.json"],
    "住宅金融": ["住宅金融支援機構法.json"],
  };

  const parts: string[] = [];
  const loaded = new Set<string>();
  for (const [kw, files] of Object.entries(lawMapping)) {
    if (topicName.includes(kw)) {
      for (const file of files) {
        if (loaded.has(file)) continue;
        const p = `${LAWS_DIR}/${file}`;
        if (existsSync(p)) {
          const data = readFileSync(p, "utf-8");
          parts.push(`\n### ${file}\n${data.slice(0, 25000)}`);
          loaded.add(file);
        }
      }
    }
  }
  return parts.join("\n");
}

// ============================================================
// Fix Prompt — トピックに絞った修正指示
// ============================================================

function buildFixPrompt(
  topic: GeneratedTopic,
  issues: Issue[],
  textbookExcerpts: string[],
  lawSource: string,
  verifyNotes: string,
): string {
  let textbookContext = textbookExcerpts.join("\n\n---\n\n");
  if (textbookContext.length > 15000) textbookContext = textbookContext.slice(0, 15000);

  return `あなたは宅建試験の教材作成の専門家です。
以下の教材を修正してください。

## 絶対ルール（前回の修正で違反があった）

1. **このトピックに関係ない内容を追加しない** — 「${topic.topic}」のみを扱う
2. **既存の正しい内容を削除しない** — 修正対象外の記述はそのまま残す
3. **issueの修正指示がこのトピックと無関係なら無視する** — 別トピックのissueが混入している可能性がある
4. **条文番号・数字は法令データに基づく** — 推測で書かない
5. **出力はMarkdown** — 元の構造を維持

## 前回の検証で指摘された問題
${verifyNotes}

## トピック: ${topic.topic}（${topic.subject}）

## 現在の教材
${topic.content}

## 修正すべきissue（このトピックに関連するもののみ）
${issues.map((issue, i) => `
### #${i + 1} [${issue.severity}] ${issue.type}
- 問題: ${issue.description}
- テキスト: ${issue.textbookSays}
- AI教材: ${issue.materialSays}
- 修正: ${issue.fix}
`).join("\n")}

## 市販テキストの該当ページ
${textbookContext}
${lawSource ? `\n## 関連法令\n${lawSource}` : ""}

## 出力
修正済みのMarkdown教材本文のみ。\`\`\`で囲まない。`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  // データ読み込み
  const backup: GeneratedTopic[] = JSON.parse(readFileSync(BACKUP_FILE, "utf-8"));
  const output: GeneratedTopic[] = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
  const reviews: ReviewResult[] = JSON.parse(readFileSync(REVIEW_FILE, "utf-8"));
  const verifyResults = JSON.parse(readFileSync(VERIFY_FILE, "utf-8"));

  // Fail判定トピックを特定
  const failedTopics = new Set<string>();
  const verifyNotes = new Map<string, string>();
  for (const r of verifyResults) {
    const v = (r.verdict || "").toLowerCase();
    if (v.includes("fail") && !v.includes("pass")) {
      failedTopics.add(r.topic);
      verifyNotes.set(r.topic, `${r.notes}\n新規問題: ${(r.newIssues || []).join("; ")}`);
    }
  }

  console.log(`\n🔧 Fail判定トピック再修正（${failedTopics.size}件）\n`);

  // Issue集約 + トピック関連性フィルタ
  const topicIssues = new Map<string, { issues: Issue[]; excerpts: string[] }>();
  for (const page of reviews) {
    for (const topicName of page.matchedTopics) {
      if (!failedTopics.has(topicName)) continue;
      if (!topicIssues.has(topicName)) topicIssues.set(topicName, { issues: [], excerpts: [] });
      const entry = topicIssues.get(topicName)!;

      const existingDescs = new Set(entry.issues.map(i => i.description));
      for (const issue of page.issues) {
        if (!issue || typeof issue !== "object" || !issue.severity) continue;
        // トピック関連性フィルタ
        if (!isIssueRelevantToTopic(issue, topicName)) continue;
        if (!existingDescs.has(issue.description)) {
          entry.issues.push(issue);
          existingDescs.add(issue.description);
        }
      }

      if (page.textbookContent && page.textbookContent.length > 50) {
        entry.excerpts.push(page.textbookContent);
      }
    }
  }

  let fixed = 0;

  for (const topicName of failedTopics) {
    // バックアップから復元
    const backupIdx = backup.findIndex(m => m.topic === topicName);
    const outputIdx = output.findIndex(m => m.topic === topicName);
    if (backupIdx === -1 || outputIdx === -1) {
      console.log(`  ⚠️  ${topicName} — インデックス不一致、スキップ`);
      continue;
    }

    // バックアップ版をベースにする
    const baseTopic = backup[backupIdx];
    const issueData = topicIssues.get(topicName);
    const issues = issueData?.issues ?? [];
    const excerpts = issueData?.excerpts ?? [];
    const notes = verifyNotes.get(topicName) ?? "";

    const relevantIssues = issues.filter(i => i.severity === "critical" || i.severity === "warning");

    console.log(`  [${fixed + 1}/${failedTopics.size}] ${topicName}`);
    console.log(`    元issue: ${issues.length} → フィルタ後: ${relevantIssues.length} (🔴${relevantIssues.filter(i=>i.severity==="critical").length} 🟡${relevantIssues.filter(i=>i.severity==="warning").length})`);

    if (relevantIssues.length === 0) {
      // issueがフィルタで全部消えた → バックアップ版をそのまま使う
      console.log(`    ↩️  バックアップ版を復元`);
      output[outputIdx] = { ...baseTopic, fixedAt: new Date().toISOString(), fixedBy: "restored-from-backup" };
      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
      fixed++;
      continue;
    }

    try {
      const lawSource = loadLawSource(topicName);
      const prompt = buildFixPrompt(baseTopic, relevantIssues, excerpts, lawSource, notes);
      const result = await model.generateContent([{ text: prompt }]);
      const fixedContent = result.response.text();

      if (!fixedContent || fixedContent.length < baseTopic.content.length * 0.5) {
        console.log(`    ⚠️  出力短すぎ → バックアップ版を復元`);
        output[outputIdx] = { ...baseTopic, fixedAt: new Date().toISOString(), fixedBy: "restored-from-backup" };
      } else {
        output[outputIdx] = {
          ...output[outputIdx],
          content: fixedContent,
          charCount: String(fixedContent.length),
          fixedAt: new Date().toISOString(),
          fixedBy: "gemini-2.5-pro-refix",
          fixCount: relevantIssues.length,
        };
        console.log(`    ✅ 修正完了 (${baseTopic.content.length} → ${fixedContent.length} chars)`);
      }

      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
      fixed++;
      await new Promise(r => setTimeout(r, 5000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ ${msg.slice(0, 200)}`);

      if (msg.includes("503") || msg.includes("429")) {
        console.log(`    ⏸️  60秒待機してリトライ...`);
        await new Promise(r => setTimeout(r, 60000));
        // バックアップ版で復元しておく
        output[outputIdx] = { ...baseTopic, fixedAt: new Date().toISOString(), fixedBy: "restored-from-backup" };
        writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        fixed++;
      } else {
        console.log(`    ↩️  バックアップ版を復元`);
        output[outputIdx] = { ...baseTopic, fixedAt: new Date().toISOString(), fixedBy: "restored-from-backup" };
        writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        fixed++;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 再修正完了: ${fixed}/${failedTopics.size} トピック`);
  console.log(`   出力: ${OUTPUT_FILE}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
