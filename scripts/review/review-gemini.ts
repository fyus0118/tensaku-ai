/**
 * 教材照合パイプライン（Gemini版）
 *
 * Claude生成教材をGeminiで検証する（生成者と検証者を分離）
 *
 * Step 1: Gemini Visionでスクショを全文書き起こし
 * Step 2: Geminiでテキストの事実を1つずつAI教材と照合
 *
 * 使い方:
 *   source .env.local && bun run scripts/review/review-gemini.ts scripts/review/screenshots/takken
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const MATERIALS_FILE = "./scripts/materials-v3/takken-full.json";

interface GeneratedTopic {
  subject: string;
  topic: string;
  content: string;
  charCount: number;
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

// 画像をbase64に変換
function imageToBase64(filePath: string): { base64: string; mimeType: string } {
  const data = readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return { base64: data.toString("base64"), mimeType };
}

// 教材読み込み
function loadMaterials(): GeneratedTopic[] {
  return JSON.parse(readFileSync(MATERIALS_FILE, "utf-8"));
}

// Step 1: Gemini Visionでスクショを全文書き起こし + トピック特定
async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  topicList: string
): Promise<{ textContent: string; matchedTopics: string[] }> {
  const result = await model.generateContent([
    {
      inlineData: { data: imageBase64, mimeType },
    },
    {
      text: `この画像は宅建試験の市販テキスト（みんなが欲しかった！宅建士の教科書）のページです。

## 指示
1. ページに書かれている**全ての文字情報**を正確に書き起こしてください
   - 見出し、本文、注釈、囲み記事、表、箇条書き、ページ番号を全て含める
   - 条文番号（第○条）、数字（○年、○万円、○㎡、○%）は1つも漏らさない
   - 要件の列挙（①②③...）は全て書き起こす
   - 「ただし〜」「〜の場合を除く」等の例外規定も含める
2. **目次・はしがき・索引・教科書の使い方説明**ページの場合はmatchedTopicsを空配列にする
3. 法律の解説がある場合、該当するトピックを以下から選ぶ

## トピック一覧
${topicList}

## 出力（JSON）
{
  "textContent": "全文書き起こし（省略・要約禁止）",
  "matchedTopics": ["トピック名"]
}

JSONのみ出力。`
    },
  ]);

  const text = result.response.text();
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  return { textContent: text, matchedTopics: [] };
}

// Step 2: Geminiでテキストの事実をAI教材と照合
async function compareWithGemini(
  textbookContent: string,
  materialContent: string,
  topicName: string
): Promise<Issue[]> {
  const result = await model.generateContent([
    {
      text: `あなたはClaude（別のAI）が生成した宅建教材の品質を検証する第三者監査人です。
Claudeは自分の生成物に甘い判定をする傾向があるため、あなたが厳格に検証します。

## 手順（必ずこの順番で実行）

### Step 1: 市販テキストから事実情報を全て抽出
テキストに含まれる全ての事実情報をリストアップしてください:
- 条文番号（第○条）
- 数字（期間、金額、面積、割合）
- 要件（○○の場合は△△）
- 例外（ただし〜）
- 判例
- 手続き（届出先、期限等）
- 用語の定義

### Step 2: 各事実がAI教材に存在するか1つずつ確認
抽出した事実の1つ1つについて:
- AI教材に同じ情報があるか全文を検索
- ある場合: 内容が正確か確認
- ない場合: missing（欠落）として報告
- 異なる場合: wrong（誤り）として報告

## トピック: ${topicName}

## 市販テキストの内容（これが正解）
${textbookContent}

## AI生成教材の内容（Claudeが生成。これを検証する）
${materialContent.slice(0, 15000)}

## 出力

### 事実照合リスト
1. [事実] → AI教材に [✅ある / ❌ない / ⚠️異なる]
2. [事実] → AI教材に [✅ある / ❌ない / ⚠️異なる]
...

### 問題JSON（❌と⚠️のもの）
[
  {
    "severity": "critical（条文番号・数字の誤り）/ warning（情報の欠落）/ info（表現の改善）",
    "type": "wrong_article / missing_requirement / wrong_number / missing_exception / missing_case_law / other",
    "description": "具体的な問題の説明",
    "textbookSays": "テキストの記述を正確に引用",
    "materialSays": "AI教材の記述（なければ '記載なし'）",
    "fix": "追加・修正すべき具体的内容"
  }
]

❌と⚠️が0の場合のみ空配列[]。
テキストにある情報がAI教材に1つでも欠けていればwarning以上で報告すること。`
    },
  ]);

  const text = result.response.text();
  try {
    // 最後のJSON配列を抽出
    const allMatches = [...text.matchAll(/\[[\s\S]*?\]/g)];
    for (let i = allMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(allMatches[i][0]);
        if (Array.isArray(parsed)) return parsed;
      } catch { continue; }
    }
  } catch {}

  // パース失敗時: ❌が含まれてれば問題ありとして報告
  if (text.includes("❌") || text.includes("⚠️")) {
    return [{
      severity: "warning",
      type: "other",
      description: "JSON解析失敗。手動確認必要。照合結果: " + text.slice(-300),
      textbookSays: "手動確認",
      materialSays: "手動確認",
      fix: "手動確認",
    }];
  }
  return [];
}

// メイン
async function main() {
  const args = process.argv.slice(2);
  const screenshotDir = args[0] || "./scripts/review/screenshots";

  if (!existsSync(screenshotDir)) {
    console.error(`❌ ディレクトリが見つかりません: ${screenshotDir}`);
    process.exit(1);
  }

  const outputDir = "./scripts/review/reports";
  mkdirSync(outputDir, { recursive: true });

  const images = readdirSync(screenshotDir)
    .filter(f => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"))
    .sort();

  if (images.length === 0) {
    console.error(`❌ スクショなし: ${screenshotDir}`);
    process.exit(1);
  }

  const materials = loadMaterials();
  const topicList = materials.map(m => `- ${m.topic}`).join("\n");

  // 既存の進捗を読み込み
  const resultsFile = path.join(outputDir, "review-gemini-results.json");
  let allResults: ReviewResult[] = [];
  const doneImages = new Set<string>();

  if (existsSync(resultsFile)) {
    allResults = JSON.parse(readFileSync(resultsFile, "utf-8"));
    for (const r of allResults) doneImages.add(r.imageFile);
  }

  console.log(`\n📋 教材照合パイプライン（Gemini版）`);
  console.log(`   スクショ: ${images.length}枚（済: ${doneImages.size}）`);
  console.log(`   教材: ${materials.length}トピック`);
  console.log(`   検証モデル: Gemini 2.5 Pro\n`);

  let totalIssues = 0;
  let criticalCount = 0;

  for (let i = 0; i < images.length; i++) {
    const imgFile = images[i];
    if (doneImages.has(imgFile)) continue;

    const imgPath = path.join(screenshotDir, imgFile);
    console.log(`  [${i + 1}/${images.length}] ${imgFile} ...`);

    try {
      // Step 1: Gemini Visionで読み取り
      const { base64, mimeType } = imageToBase64(imgPath);
      const { textContent, matchedTopics } = await extractFromImage(base64, mimeType, topicList);

      if (!textContent || textContent.length < 50 || matchedTopics.length === 0) {
        console.log(`    ⏭️  スキップ（非教材ページまたは読み取り不可）`);
        allResults.push({
          imageFile: imgFile, textbookContent: textContent || "",
          matchedTopics: [], issues: [], timestamp: new Date().toISOString(),
        });
        doneImages.add(imgFile);
        writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
        continue;
      }

      console.log(`    📖 ${textContent.slice(0, 60).replace(/\n/g, " ")}...`);
      console.log(`    🎯 ${matchedTopics.join(", ")}`);

      // Step 2: 各トピックと照合
      const allIssues: Issue[] = [];

      for (const topicName of matchedTopics) {
        const material = materials.find(m => m.topic === topicName);
        if (!material) continue;

        const issues = await compareWithGemini(textContent, material.content, topicName);
        allIssues.push(...issues);

        // レートリミット対策
        await new Promise(r => setTimeout(r, 1000));
      }

      const result: ReviewResult = {
        imageFile: imgFile,
        textbookContent: textContent,
        matchedTopics,
        issues: allIssues,
        timestamp: new Date().toISOString(),
      };

      allResults.push(result);
      doneImages.add(imgFile);
      totalIssues += allIssues.length;
      criticalCount += allIssues.filter(i => i.severity === "critical").length;

      if (allIssues.length > 0) {
        for (const issue of allIssues) {
          const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
          console.log(`    ${icon} [${issue.type}] ${issue.description.slice(0, 100)}`);
        }
      } else {
        console.log(`    ✅ 問題なし`);
      }

      // 毎回保存
      writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));

      // レートリミット対策
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ ${msg}`);

      if (msg.includes("429") || msg.includes("503") || msg.includes("quota") || msg.includes("rate") || msg.includes("Resource has been exhausted") || msg.includes("high demand") || msg.includes("Service Unavailable")) {
        const retryKey = `retry_${imgFile}`;
        const retryCount = (globalThis as Record<string, number>)[retryKey] || 0;
        if (retryCount < 10) {
          (globalThis as Record<string, number>)[retryKey] = retryCount + 1;
          const waitSec = 30 * (retryCount + 1); // 30秒、60秒、...300秒と増やす
          console.log(`    ⏸️  サーバーエラー（${retryCount + 1}/10回目）。${waitSec}秒待機...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          i--; // リトライ
        } else {
          console.log(`    ⏭️  10回リトライ失敗。スキップ（再実行で再処理されます）`);
        }
      } else {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // レポート生成
  const warningCount = allResults.reduce((s, r) => s + r.issues.filter(i => i.severity === "warning").length, 0);
  const infoCount = allResults.reduce((s, r) => s + r.issues.filter(i => i.severity === "info").length, 0);
  const reviewed = allResults.filter(r => r.matchedTopics.length > 0).length;

  let md = `# 宅建教材 照合レポート（Gemini検証）\n\n`;
  md += `生成: ${new Date().toISOString()}\n\n`;
  md += `| 指標 | 値 |\n|---|---|\n`;
  md += `| 総ページ | ${images.length} |\n`;
  md += `| 照合済み | ${reviewed} |\n`;
  md += `| 🔴 Critical | ${criticalCount} |\n`;
  md += `| 🟡 Warning | ${warningCount} |\n`;
  md += `| 🔵 Info | ${infoCount} |\n\n`;

  for (const r of allResults) {
    if (r.issues.length === 0) continue;
    md += `## ${r.imageFile}（${r.matchedTopics.join(", ")}）\n\n`;
    for (const issue of r.issues) {
      const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
      md += `${icon} **[${issue.type}]** ${issue.description}\n`;
      md += `- テキスト: ${issue.textbookSays}\n`;
      md += `- AI教材: ${issue.materialSays}\n`;
      md += `- 修正: ${issue.fix}\n\n`;
    }
  }

  writeFileSync(path.join(outputDir, "review-gemini-report.md"), md);

  console.log(`\n========================================`);
  console.log(`📊 照合完了（Gemini検証）`);
  console.log(`  照合: ${reviewed}/${images.length}ページ`);
  console.log(`  問題: 🔴${criticalCount} 🟡${warningCount} 🔵${infoCount}`);
  console.log(`  レポート: ${outputDir}/review-gemini-report.md`);
  console.log(`========================================\n`);
}

main().catch(console.error);
