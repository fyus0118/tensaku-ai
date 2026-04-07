/**
 * 拡張トピック適用スクリプト
 *
 * expanded-topics.json の内容を exams.ts に反映する。
 * subjects の name でマッチし、topics 配列を置換する。
 *
 * 使い方:
 *   bun run scripts/apply-expanded-topics.ts
 *   bun run scripts/apply-expanded-topics.ts --dry-run
 */

import { readFileSync, writeFileSync } from "fs";
import { EXAM_CATEGORIES } from "../src/lib/exams";

const EXPANDED_FILE = "./scripts/expanded-topics.json";
const EXAMS_FILE = "./src/lib/exams.ts";
const dryRun = process.argv.includes("--dry-run");

function main() {
  const expanded: Record<string, { subject: string; topics: string[] }[]> =
    JSON.parse(readFileSync(EXPANDED_FILE, "utf-8"));

  let examsTs = readFileSync(EXAMS_FILE, "utf-8");
  let totalReplaced = 0;

  for (const [examId, subjects] of Object.entries(expanded)) {
    const exam = EXAM_CATEGORIES.find(e => e.id === examId);
    if (!exam) {
      console.log(`⚠️ ${examId}: exams.tsに見つからない — スキップ`);
      continue;
    }

    for (const newSub of subjects) {
      const oldSub = exam.subjects.find(s => s.name === newSub.subject);
      if (!oldSub) {
        console.log(`⚠️ ${examId}/${newSub.subject}: 科目が見つからない — スキップ`);
        continue;
      }

      if (oldSub.topics.length === newSub.topics.length) continue; // 変更なし

      // exams.ts内で該当topicsの配列を見つけて置換
      // oldSubのtopics配列を文字列としてマッチさせる
      const oldTopicsStr = buildTopicsString(oldSub.topics);
      const newTopicsStr = buildTopicsString(newSub.topics);

      if (examsTs.includes(oldTopicsStr)) {
        examsTs = examsTs.replace(oldTopicsStr, newTopicsStr);
        console.log(`  ${examId}/${newSub.subject}: ${oldSub.topics.length} → ${newSub.topics.length}`);
        totalReplaced++;
      } else {
        // フォールバック: 最初のトピック文字列でマッチを試みる
        const firstTopic = oldSub.topics[0];
        const escapedFirst = escapeRegex(firstTopic);

        // topics: [ の開始から ] の終了までを正規表現で探す
        // name: "科目名" の近くの topics 配列を探す
        const namePattern = `name: "${escapeRegex(newSub.subject)}"`;
        const nameIdx = examsTs.indexOf(`name: "${newSub.subject}"`);
        if (nameIdx === -1) {
          console.log(`  ⚠️ ${examId}/${newSub.subject}: パターンマッチ失敗 — スキップ`);
          continue;
        }

        // nameの後のtopics: [...]を見つける
        const afterName = examsTs.substring(nameIdx);
        const topicsStart = afterName.indexOf("topics: [");
        if (topicsStart === -1) {
          console.log(`  ⚠️ ${examId}/${newSub.subject}: topics配列が見つからない — スキップ`);
          continue;
        }

        const absStart = nameIdx + topicsStart + "topics: [".length;
        // 対応する ] を見つける（ネスト対応）
        let depth = 1;
        let pos = absStart;
        while (depth > 0 && pos < examsTs.length) {
          if (examsTs[pos] === "[") depth++;
          if (examsTs[pos] === "]") depth--;
          pos++;
        }
        const absEnd = pos - 1; // ] の位置

        const oldContent = examsTs.substring(absStart, absEnd);
        const newContent = "\n" + newSub.topics.map(t => `        "${t}",`).join("\n") + "\n      ";

        examsTs = examsTs.substring(0, absStart) + newContent + examsTs.substring(absEnd);
        console.log(`  ${examId}/${newSub.subject}: ${oldSub.topics.length} → ${newSub.topics.length} (フォールバック)`);
        totalReplaced++;
      }
    }
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] ${totalReplaced}科目を置換予定`);
  } else {
    writeFileSync(EXAMS_FILE, examsTs);
    console.log(`\n✅ ${totalReplaced}科目を置換 → ${EXAMS_FILE}`);
  }

  // サマリー
  const newTotal = Object.values(expanded).reduce(
    (sum, subs) => sum + subs.reduce((s, sub) => s + sub.topics.length, 0), 0
  );
  console.log(`合計トピック数: ${newTotal}`);
}

function buildTopicsString(topics: string[]): string {
  return topics.map(t => `        "${t}",`).join("\n");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main();
