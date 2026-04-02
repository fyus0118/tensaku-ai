/**
 * 教材照合パイプライン
 *
 * スクショ画像（テキスト）とAI生成教材を照合し、差分レポートを出力する。
 *
 * 使い方:
 *   source .env.local && bun run scripts/review/review-material.ts [スクショDir] [科目名]
 *
 * 例:
 *   bun run scripts/review/review-material.ts scripts/review/screenshots/takken "宅建業法（免許・宅建士）"
 *
 * フロー:
 *   1. スクショ画像を読み込み
 *   2. Claude Visionでテキスト内容を読み取り
 *   3. 生成済み教材の該当トピックと照合
 *   4. 差分レポート（条文番号不一致・要件漏れ・数字食い違い）を出力
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MATERIALS_FILE = "./scripts/materials-v3/takken-full.json";

interface GeneratedTopic {
  subject: string;
  topic: string;
  content: string;
  charCount: number;
}

interface ReviewResult {
  imageFile: string;
  textbookContent: string;   // テキストから読み取った内容
  matchedTopics: string[];   // 照合した教材トピック
  issues: Issue[];
  timestamp: string;
}

interface Issue {
  severity: "critical" | "warning" | "info";
  type: "wrong_article" | "missing_requirement" | "wrong_number" | "missing_topic" | "missing_exception" | "missing_case_law" | "other";
  description: string;
  textbookSays: string;
  materialSays: string;
  fix: string;
}

// スクショを読み込んでbase64に変換
function imageToBase64(filePath: string): { base64: string; mediaType: "image/png" | "image/jpeg" } {
  const data = readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" as const : "image/png" as const;
  return { base64: data.toString("base64"), mediaType };
}

// 生成済み教材を読み込み
function loadMaterials(subjectFilter?: string): GeneratedTopic[] {
  const all: GeneratedTopic[] = JSON.parse(readFileSync(MATERIALS_FILE, "utf-8"));
  if (subjectFilter) {
    return all.filter(t => t.subject === subjectFilter || t.subject.includes(subjectFilter));
  }
  return all;
}

// Step 1: スクショからテキスト内容を読み取り + 該当トピック特定
async function extractAndMatch(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg",
  materials: GeneratedTopic[]
): Promise<{ textContent: string; matchedTopics: string[] }> {
  const topicList = materials.map(m => `- ${m.subject} > ${m.topic}`).join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imageBase64 },
        },
        {
          type: "text",
          text: `この画像は宅建試験の市販テキストのページです。

## 指示
1. このページに書かれている**全ての文字情報**を正確に書き起こしてください
   - 見出し、本文、注釈、囲み、表、箇条書き、ページ番号を全て含める
   - 条文番号（第○条）、数字（○年、○万円、○㎡、○%）は**1つも漏らさず正確に**
   - 要件の列挙（①②③...）は全て書き起こす
   - 「ただし〜」「〜の場合を除く」等の例外規定も必ず含める
   - 図やイラストの中のテキストも含める
2. このページが**目次・はしがき・索引・教科書の使い方の説明**の場合は、matchedTopicsを空にしてください
3. 法律の解説内容がある場合、該当するトピックを以下から選んでください

## トピック一覧
${topicList}

## 出力形式（JSON）
{
  "textContent": "ページの全文書き起こし（省略禁止。全ての文字情報を含める）",
  "matchedTopics": ["該当するトピック名1"]
}

JSONのみ出力。textContentの省略・要約は禁止。見たまま全て書き起こすこと。`,
        },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    // JSON部分を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  return { textContent: text, matchedTopics: [] };
}

// Step 2: テキスト内容と生成教材を照合
async function compareAndReport(
  textbookContent: string,
  materialContent: string,
  topicName: string
): Promise<Issue[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `あなたの仕事: 市販テキストに書かれている情報を1つずつリストアップし、それぞれがAI教材に存在するかチェックすること。

## 手順
1. まず市販テキストから「事実情報」を全て抽出する（条文番号、数字、要件、例外、判例、用語、手続き等）
2. 抽出した事実情報の1つ1つについて、AI教材の中に同じ情報があるか検索する
3. ない場合、または内容が異なる場合は問題として報告する

## トピック: ${topicName}

## 市販テキストの内容（これが正解）
${textbookContent}

## AI生成教材の内容（これを検証する）
${materialContent}

## 出力形式

まず市販テキストから抽出した事実情報を列挙し、それぞれの判定を出す。
最後にJSON配列で問題のみ出力。

### Step 1: 事実情報の抽出と照合

テキストの事実情報1: [内容] → AI教材に [ある/ない/異なる]
テキストの事実情報2: [内容] → AI教材に [ある/ない/異なる]
...

### Step 2: 問題のJSON（「ない」「異なる」のもののみ）

[
  {
    "severity": "critical（数字・条文番号の誤り）" | "warning（情報の欠落）" | "info（表現の改善）",
    "type": "wrong_article | missing_requirement | wrong_number | missing_exception | missing_case_law | other",
    "description": "何が問題か",
    "textbookSays": "テキストの記述を正確に引用",
    "materialSays": "AI教材の記述（なければ '記載なし'）",
    "fix": "追加・修正すべき内容"
  }
]

問題が0件の場合のみ空配列[]。`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    // 最後のJSON配列を探す（Step 2の出力）
    const allMatches = [...text.matchAll(/\[[\s\S]*?\]/g)];
    if (allMatches.length > 0) {
      // 最後のJSON配列を使う（Step 2の結果）
      for (let i = allMatches.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(allMatches[i][0]);
          if (Array.isArray(parsed)) return parsed;
        } catch { continue; }
      }
    }
  } catch {}

  // JSONパース失敗時: テキストに「ない」「異なる」「欠落」が含まれてたら手動で問題化
  if (text.includes("ない") || text.includes("異なる") || text.includes("欠落")) {
    return [{ severity: "warning" as const, type: "other" as const, description: "照合でJSON解析失敗。手動確認が必要: " + text.slice(-200), textbookSays: "手動確認", materialSays: "手動確認", fix: "手動確認" }];
  }
  return [];
}

// メイン
async function main() {
  const args = process.argv.slice(2);
  const screenshotDir = args[0] || "./scripts/review/screenshots";
  const subjectFilter = args[1] || undefined;

  if (!existsSync(screenshotDir)) {
    console.error(`❌ ディレクトリが見つかりません: ${screenshotDir}`);
    process.exit(1);
  }

  const outputDir = "./scripts/review/reports";
  mkdirSync(outputDir, { recursive: true });

  // スクショ一覧
  const images = readdirSync(screenshotDir)
    .filter(f => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"))
    .sort();

  if (images.length === 0) {
    console.error(`❌ スクショが見つかりません: ${screenshotDir}`);
    process.exit(1);
  }

  // 教材読み込み
  const materials = loadMaterials(subjectFilter);
  console.log(`\n📋 教材照合パイプライン`);
  console.log(`   スクショ: ${images.length}枚`);
  console.log(`   教材: ${materials.length}トピック${subjectFilter ? `（${subjectFilter}）` : ""}`);
  console.log();

  const allResults: ReviewResult[] = [];
  let totalIssues = 0;
  let criticalCount = 0;

  for (let i = 0; i < images.length; i++) {
    const imgFile = images[i];
    const imgPath = path.join(screenshotDir, imgFile);
    console.log(`  [${i + 1}/${images.length}] ${imgFile} ...`);

    try {
      // Step 1: 画像読み取り + トピック特定
      const { base64, mediaType } = imageToBase64(imgPath);
      const { textContent, matchedTopics } = await extractAndMatch(base64, mediaType, materials);

      if (!textContent || matchedTopics.length === 0) {
        console.log(`    ⏭️  テキスト読み取り不可またはトピック特定不可`);
        continue;
      }

      console.log(`    📖 ${textContent.slice(0, 50)}...`);
      console.log(`    🎯 ${matchedTopics.join(", ")}`);

      // Step 2: 各マッチトピックと照合
      const allIssues: Issue[] = [];

      for (const topicName of matchedTopics) {
        const material = materials.find(m => m.topic === topicName);
        if (!material) continue;

        const issues = await compareAndReport(textContent, material.content, topicName);
        allIssues.push(...issues);
      }

      const result: ReviewResult = {
        imageFile: imgFile,
        textbookContent: textContent,
        matchedTopics,
        issues: allIssues,
        timestamp: new Date().toISOString(),
      };

      allResults.push(result);
      totalIssues += allIssues.length;
      criticalCount += allIssues.filter(i => i.severity === "critical").length;

      // 問題があれば表示
      if (allIssues.length > 0) {
        for (const issue of allIssues) {
          const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
          console.log(`    ${icon} [${issue.type}] ${issue.description}`);
        }
      } else {
        console.log(`    ✅ 問題なし`);
      }

      // 進捗保存（毎回）
      writeFileSync(
        path.join(outputDir, "review-results.json"),
        JSON.stringify(allResults, null, 2)
      );

      // レートリミット対策
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ エラー: ${msg.slice(0, 80)}`);

      if (msg.includes("usage limits") || msg.includes("rate_limit")) {
        console.log(`    ⏸️  APIリミット。60秒待機...`);
        await new Promise(r => setTimeout(r, 60000));
        i--; // リトライ
      }
    }
  }

  // サマリーレポート生成
  const summary = {
    totalPages: images.length,
    pagesReviewed: allResults.length,
    totalIssues,
    criticalIssues: criticalCount,
    warningIssues: allResults.reduce((s, r) => s + r.issues.filter(i => i.severity === "warning").length, 0),
    infoIssues: allResults.reduce((s, r) => s + r.issues.filter(i => i.severity === "info").length, 0),
    issuesByType: {} as Record<string, number>,
    topicsWithIssues: new Set<string>(),
  };

  for (const r of allResults) {
    for (const issue of r.issues) {
      summary.issuesByType[issue.type] = (summary.issuesByType[issue.type] || 0) + 1;
      for (const t of r.matchedTopics) summary.topicsWithIssues.add(t);
    }
  }

  // マークダウンレポート
  let md = `# 宅建教材 照合レポート\n\n`;
  md += `生成日時: ${new Date().toISOString()}\n\n`;
  md += `## サマリー\n\n`;
  md += `| 指標 | 値 |\n|---|---|\n`;
  md += `| レビュー済みページ | ${allResults.length}/${images.length} |\n`;
  md += `| 問題数合計 | ${totalIssues} |\n`;
  md += `| 🔴 Critical | ${summary.criticalIssues} |\n`;
  md += `| 🟡 Warning | ${summary.warningIssues} |\n`;
  md += `| 🔵 Info | ${summary.infoIssues} |\n\n`;

  if (totalIssues > 0) {
    md += `## 問題一覧\n\n`;
    for (const r of allResults) {
      if (r.issues.length === 0) continue;
      md += `### ${r.imageFile}（${r.matchedTopics.join(", ")}）\n\n`;
      for (const issue of r.issues) {
        const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
        md += `${icon} **[${issue.type}]** ${issue.description}\n`;
        md += `- テキスト: ${issue.textbookSays}\n`;
        md += `- AI教材: ${issue.materialSays}\n`;
        md += `- 修正: ${issue.fix}\n\n`;
      }
    }
  }

  writeFileSync(path.join(outputDir, "review-report.md"), md);

  console.log(`\n========================================`);
  console.log(`📊 照合完了`);
  console.log(`  レビュー: ${allResults.length}/${images.length}ページ`);
  console.log(`  問題: 🔴${summary.criticalIssues} 🟡${summary.warningIssues} 🔵${summary.infoIssues}`);
  console.log(`  レポート: ${outputDir}/review-report.md`);
  console.log(`========================================\n`);
}

main().catch(console.error);
