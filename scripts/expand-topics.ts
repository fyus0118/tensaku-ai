/**
 * トピック拡張スクリプト
 *
 * 既存のトピック定義を読み、粒度が粗いものをGeminiで分割する。
 * 宅建の157トピックをベンチマークに、主要試験のトピック数を適正化。
 *
 * 使い方:
 *   source .env.local && bun run scripts/expand-topics.ts
 *   source .env.local && bun run scripts/expand-topics.ts shihou-shiken
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXAM_CATEGORIES, type ExamCategory } from "../src/lib/exams";
import { writeFileSync, readFileSync } from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  generationConfig: { maxOutputTokens: 16384, responseMimeType: "application/json" },
});

// 試験ごとの目標トピック数
const TARGET_TOPICS: Record<string, number> = {
  "shihou-shiken": 150,
  "yobi-shihou": 140,
  "kounin-kaikeishi": 110,
  "ishi": 160,
  "kangoshi": 90,
  "shihou-shoshi": 100,
  "gyousei-shoshi": 90,
  "sharoshi": 90,
  "zeirishi": 90,
  "shindan-shi": 90,
  "fp2": 75,
  "hoiku-shi": 70,
  "koumuin": 70,
  "benri-shi": 60,
  "ap": 60,
};

const OUTPUT_FILE = "./scripts/expanded-topics.json";

async function expandSubject(
  examName: string,
  subject: { name: string; topics: string[] },
  targetTopics: number,
  retries = 0,
): Promise<{ subject: string; topics: string[] }> {
  const prompt = `あなたは${examName}の試験対策教材の専門家です。

以下の科目「${subject.name}」のトピック一覧を、**${targetTopics}トピック前後**に拡張してください。

## 拡張ルール

1. **粒度の粗いトピックを分割する**: 括弧内に5つ以上のサブトピックがあるものは、2〜4つの独立トピックに分割
2. **重要な欠落トピックを追加する**: 試験で頻出なのに一覧にないテーマを追加
3. **既存トピックで適切な粒度のものはそのまま残す**: 無理に分割しない
4. **トピック名の形式**: 「メインテーマ（サブトピック1・サブトピック2・サブトピック3）」— サブトピックは3〜5個が理想
5. **各トピックは10,000〜15,000字の教材1つに対応する**: 1トピックで解説しきれる範囲に収める

## 現在のトピック一覧（${subject.topics.length}トピック）

${subject.topics.map((t, i) => `${i+1}. ${t}`).join("\n")}

## 出力形式（JSON）

{ "subject": "${subject.name}", "topics": ["トピック名（サブトピック1・サブトピック2・サブトピック3）", ...] }`;

  try {
    const result = await model.generateContent([{ text: prompt }]);
    const text = result.response.text();

    const parsed = JSON.parse(text) as { subject: string; topics: string[] };

    if (!parsed.topics || parsed.topics.length < subject.topics.length) {
      console.log(`    ⚠️ ${subject.name}: トピック数減少 → 元のトピックを使用`);
      return { subject: subject.name, topics: [...subject.topics] };
    }

    console.log(`    ${subject.name}: ${subject.topics.length} → ${parsed.topics.length}`);
    return { subject: subject.name, topics: parsed.topics };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if ((msg.includes("503") || msg.includes("429")) && retries < 5) {
      const wait = 60 * (retries + 1);
      console.log(`    ⏸️ ${subject.name}: ${wait}秒待機してリトライ (${retries + 1}/5)...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      return expandSubject(examName, subject, targetTopics, retries + 1);
    }

    console.error(`    ❌ ${subject.name}: ${msg.slice(0, 100)}`);
    return { subject: subject.name, topics: [...subject.topics] };
  }
}

async function expandTopicsForExam(exam: ExamCategory): Promise<{ subject: string; topics: string[] }[]> {
  const currentTopics = exam.subjects.reduce((s, sub) => s + sub.topics.length, 0);
  const target = TARGET_TOPICS[exam.id] || currentTopics;

  if (currentTopics >= target * 0.9) {
    console.log(`  ${exam.id}: ${currentTopics}トピック — 目標${target}に近いのでスキップ`);
    return exam.subjects.map(s => ({ subject: s.name, topics: [...s.topics] }));
  }

  const ratio = target / currentTopics;
  console.log(`  ${exam.id}: ${currentTopics} → 目標${target} (${ratio.toFixed(1)}x拡張)`);

  // 科目ごとに目標トピック数を配分（現在のトピック数の比率で）
  const results: { subject: string; topics: string[] }[] = [];

  for (const sub of exam.subjects) {
    const subTarget = Math.round((sub.topics.length / currentTopics) * target);
    const expanded = await expandSubject(exam.name, sub, Math.max(subTarget, sub.topics.length), 0);
    results.push(expanded);
    await new Promise(r => setTimeout(r, 3000)); // API制限対策
  }

  const newTotal = results.reduce((s, sub) => s + sub.topics.length, 0);
  console.log(`    合計: ${currentTopics} → ${newTotal}`);

  return results;
}

async function main() {
  const targetArg = process.argv[2];
  const targetIds = targetArg ? targetArg.split(",").map(s => s.trim()) : Object.keys(TARGET_TOPICS);

  const exams = EXAM_CATEGORIES.filter(e => targetIds.includes(e.id));

  if (exams.length === 0) {
    console.error("対象試験がありません");
    console.log("対象:", Object.keys(TARGET_TOPICS).join(", "));
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`トピック拡張（Gemini 2.5 Pro）`);
  console.log(`対象: ${exams.length}試験`);
  console.log(`========================================\n`);

  // 既存の結果があれば読み込み
  let results: Record<string, { subject: string; topics: string[] }[]> = {};
  try {
    results = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
  } catch {}

  for (const exam of exams) {
    if (results[exam.id] && !targetArg) {
      const total = results[exam.id].reduce((s, sub) => s + sub.topics.length, 0);
      console.log(`  ${exam.id}: 拡張済み(${total}トピック) — スキップ`);
      continue;
    }

    const expanded = await expandTopicsForExam(exam);
    results[exam.id] = expanded;
    writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    await new Promise(r => setTimeout(r, 5000));
  }

  // サマリー
  console.log(`\n========================================`);
  console.log(`拡張結果サマリー`);
  let totalBefore = 0, totalAfter = 0;
  for (const exam of exams) {
    const before = exam.subjects.reduce((s, sub) => s + sub.topics.length, 0);
    const after = results[exam.id]?.reduce((s, sub) => s + sub.topics.length, 0) || before;
    totalBefore += before;
    totalAfter += after;
    console.log(`  ${exam.id.padEnd(20)} ${String(before).padStart(3)} → ${String(after).padStart(3)}  (目標: ${TARGET_TOPICS[exam.id] || '-'})`);
  }
  console.log(`  ${"合計".padEnd(20)} ${String(totalBefore).padStart(3)} → ${String(totalAfter).padStart(3)}`);
  console.log(`\n出力: ${OUTPUT_FILE}`);
  console.log(`\n次のステップ:`);
  console.log(`  bun run scripts/apply-expanded-topics.ts  # exams.tsに反映`);
  console.log(`========================================\n`);
}

main().catch(console.error);
