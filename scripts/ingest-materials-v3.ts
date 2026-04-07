/**
 * v3教材をRAG投入（旧データ削除 → 新データ挿入 → embedding付与）
 *
 * 使い方:
 *   source .env.local && bun run scripts/ingest-materials-v3.ts              # 全試験
 *   source .env.local && bun run scripts/ingest-materials-v3.ts fp2          # 特定試験
 *   source .env.local && bun run scripts/ingest-materials-v3.ts fp2,boki2    # 複数指定
 */

import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { readdirSync, readFileSync, existsSync } from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const BEDROCK_MODEL = "amazon.titan-embed-text-v2:0";
const MATERIALS_DIR = "./scripts/materials-v3";

interface GeneratedTopic {
  examId: string;
  subject: string;
  topic: string;
  content: string;
  charCount: number;
  hasLawSource: boolean;
  generatedAt: string;
}

// embedding生成
async function embed(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text.slice(0, 8000),
      dimensions: 1024,
      normalize: true,
    }),
  });
  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embedding;
}

// セクション境界でチャンク分割
function chunkBySection(content: string, maxSize: number = 1500): string[] {
  const sections = content.split(/(?=^## )/m);
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    if (!section.trim()) continue;

    if ((current + "\n\n" + section).length > maxSize && current) {
      chunks.push(current.trim());
      current = section;
    } else {
      current = current ? current + "\n\n" + section : section;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // 大きすぎるチャンクをさらに分割
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > maxSize * 1.5) {
      const paragraphs = chunk.split(/\n\n+/);
      let sub = "";
      for (const para of paragraphs) {
        if ((sub + "\n\n" + para).length > maxSize && sub) {
          result.push(sub.trim());
          sub = para;
        } else {
          sub = sub ? sub + "\n\n" + para : para;
        }
      }
      if (sub.trim()) result.push(sub.trim());
    } else {
      result.push(chunk);
    }
  }

  return result;
}

async function ingestExam(examId: string, topics: GeneratedTopic[]) {
  console.log(`\n--- ${examId}: ${topics.length}トピック ---`);

  // 1. 旧データ削除
  console.log(`  旧データ削除...`);
  const { error: delError, count: delCount } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("exam_id", examId);

  if (delError) {
    console.error(`  削除エラー: ${delError.message}`);
    return;
  }
  console.log(`  ${delCount || 0}件削除`);

  // 2. チャンク分割 + 挿入
  console.log(`  チャンク分割 + 挿入...`);
  let totalChunks = 0;
  let insertErrors = 0;

  for (const topic of topics) {
    const chunks = chunkBySection(topic.content);

    const rows = chunks.map((chunk, idx) => ({
      exam_id: examId,
      subject: topic.subject,
      topic: topic.topic,
      content: chunk,
      metadata: {
        sourceType: topic.hasLawSource ? "law" : "ai_with_context",
        chunkIndex: idx,
        totalChunks: chunks.length,
        charCount: chunk.length,
        generatedAt: topic.generatedAt,
        version: "v3",
      },
    }));

    const { error } = await supabase.from("documents").insert(rows);
    if (error) {
      console.error(`  INSERT ERROR ${topic.subject} > ${topic.topic}: ${error.message}`);
      insertErrors++;
    } else {
      totalChunks += rows.length;
    }
  }

  console.log(`  ${totalChunks}チャンク挿入 (エラー: ${insertErrors})`);

  // 3. embedding付与
  console.log(`  embedding付与...`);

  const { data: nullDocs } = await supabase
    .from("documents")
    .select("id, content")
    .eq("exam_id", examId)
    .is("embedding", null)
    .order("created_at", { ascending: true });

  const docsToEmbed = nullDocs || [];
  let embedded = 0;
  let embedErrors = 0;

  for (let i = 0; i < docsToEmbed.length; i++) {
    const doc = docsToEmbed[i];
    try {
      const embedding = await embed(doc.content);

      const { error: updateErr } = await supabase
        .from("documents")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", doc.id);

      if (updateErr) {
        embedErrors++;
        if (embedErrors <= 3) console.error(`  embed error: ${updateErr.message}`);
      } else {
        embedded++;
      }

      if ((i + 1) % 50 === 0 || i === docsToEmbed.length - 1) {
        console.log(`  ${i + 1}/${docsToEmbed.length} embedded`);
      }
    } catch (err) {
      embedErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      if (embedErrors <= 3) console.error(`  embed error: ${msg.slice(0, 80)}`);

      if (msg.includes("Throttl") || msg.includes("rate")) {
        await new Promise(r => setTimeout(r, 5000));
        i--;
        embedErrors--;
      }
    }
  }

  console.log(`  完了: ${totalChunks}チャンク / ${embedded} embedded / エラー ${insertErrors}+${embedErrors}`);
  return { totalChunks, embedded, insertErrors, embedErrors };
}

async function main() {
  const targetArg = process.argv[2];
  const targetIds = targetArg ? targetArg.split(",").map(s => s.trim()) : null;

  // v3教材ファイルを列挙
  const files = readdirSync(MATERIALS_DIR)
    .filter(f => f.endsWith(".json") && !f.startsWith("_") && f !== "takken-full.json"
      && !f.includes("original") && !f.includes("fixed"));

  const examFiles = files.map(f => ({
    examId: f.replace(".json", ""),
    file: `${MATERIALS_DIR}/${f}`,
  })).filter(({ examId }) => {
    if (examId === "takken") return false; // 宅建は専用スクリプトで投入済み
    if (targetIds) return targetIds.includes(examId);
    return true;
  });

  if (examFiles.length === 0) {
    console.error("対象のv3教材ファイルがありません。");
    console.log("利用可能:", files.map(f => f.replace(".json", "")).join(", "));
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`v3教材 RAG投入`);
  console.log(`対象: ${examFiles.length}試験`);
  console.log(`========================================`);

  let grandTotalChunks = 0;
  let grandTotalEmbedded = 0;

  for (const { examId, file } of examFiles) {
    const topics: GeneratedTopic[] = JSON.parse(readFileSync(file, "utf-8"));
    const result = await ingestExam(examId, topics);
    if (result) {
      grandTotalChunks += result.totalChunks;
      grandTotalEmbedded += result.embedded;
    }
  }

  // 検証
  console.log(`\n========================================`);
  console.log(`投入完了: ${grandTotalChunks}チャンク / ${grandTotalEmbedded} embedded`);

  // 全体のドキュメント数を確認
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true });
  console.log(`documentsテーブル合計: ${count}件`);
  console.log(`========================================\n`);
}

main().catch(console.error);
