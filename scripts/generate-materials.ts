/**
 * 教材生成スクリプト
 * 全48試験×全科目×全トピックの教材テキストをClaude APIで生成し、JSONで保存する
 *
 * 使い方:
 *   bun run scripts/generate-materials.ts
 *
 * 出力:
 *   scripts/materials/ ディレクトリに試験ごとのJSONファイル
 */

import Anthropic from "@anthropic-ai/sdk";
import { EXAM_CATEGORIES } from "../src/lib/exams";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const OUTPUT_DIR = "./scripts/materials";
const PROGRESS_FILE = `${OUTPUT_DIR}/_progress.json`;

interface MaterialEntry {
  examId: string;
  examName: string;
  subject: string;
  topic: string;
  content: string;
  generatedAt: string;
}

// 進捗管理
function loadProgress(): Set<string> {
  if (existsSync(PROGRESS_FILE)) {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    return new Set(data);
  }
  return new Set();
}

function saveProgress(done: Set<string>) {
  writeFileSync(PROGRESS_FILE, JSON.stringify([...done], null, 2));
}

async function generateMaterial(
  examName: string,
  subject: string,
  topic: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `あなたは${examName}の試験対策教材を作成する専門家です。

以下のトピックについて、試験対策に特化した解説を作成してください。

## 試験: ${examName}
## 科目: ${subject}
## トピック: ${topic}

## 作成ルール
1. 800〜1200文字程度
2. 試験で問われるポイントに絞る
3. 条文番号・根拠法令・判例がある場合は明記
4. 間違えやすいポイントを「注意」として明示
5. 暗記が必要な要素は語呂合わせや覚え方を提案
6. 関連トピックへの言及（「〇〇も参照」）
7. 頻出度を示す（A:毎年出る / B:隔年 / C:稀）

## 出力形式
マークダウン形式で構造化してください。`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const done = loadProgress();
  let totalTopics = 0;
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  // 総数を計算
  for (const exam of EXAM_CATEGORIES) {
    for (const subject of exam.subjects) {
      totalTopics += subject.topics.length;
    }
  }

  console.log(`\n📚 教材生成開始: ${EXAM_CATEGORIES.length}試験, ${totalTopics}トピック\n`);

  for (const exam of EXAM_CATEGORIES) {
    const examFile = `${OUTPUT_DIR}/${exam.id}.json`;
    let materials: MaterialEntry[] = [];

    // 既存ファイルがあれば読み込む
    if (existsSync(examFile)) {
      materials = JSON.parse(readFileSync(examFile, "utf-8"));
    }

    for (const subject of exam.subjects) {
      for (const topic of subject.topics) {
        const key = `${exam.id}::${subject.name}::${topic}`;

        if (done.has(key)) {
          skipped++;
          continue;
        }

        try {
          console.log(`  📝 ${exam.name} > ${subject.name} > ${topic}`);

          const content = await generateMaterial(exam.name, subject.name, topic);

          materials.push({
            examId: exam.id,
            examName: exam.name,
            subject: subject.name,
            topic,
            content,
            generatedAt: new Date().toISOString(),
          });

          done.add(key);
          generated++;

          // 都度保存（中断しても再開できるように）
          writeFileSync(examFile, JSON.stringify(materials, null, 2));
          saveProgress(done);

          // レート制限対策: 1秒待つ
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          console.error(`  ❌ エラー: ${exam.name} > ${subject.name} > ${topic}:`, err);
          errors++;
          // エラーでも続行
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    if (materials.length > 0) {
      console.log(`  ✅ ${exam.name}: ${materials.length}トピック保存完了\n`);
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 生成完了`);
  console.log(`  生成: ${generated}`);
  console.log(`  スキップ（生成済み）: ${skipped}`);
  console.log(`  エラー: ${errors}`);
  console.log(`  合計: ${totalTopics}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
