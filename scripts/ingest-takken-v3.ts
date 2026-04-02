/**
 * 宅建v3教材をRAG投入（旧データ削除 → 新データ挿入 → embedding付与）
 *
 * 1. documentsテーブルから宅建の旧データを全削除
 * 2. takken-full.jsonをチャンク分割して挿入
 * 3. Bedrock Titan Embed v2でembedding付与
 *
 * 使い方: source .env.local && bun run scripts/ingest-takken-v3.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { readFileSync } from "fs";
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
const INPUT_FILE = "./scripts/materials-v3/takken-full.json";

interface GeneratedTopic {
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
      inputText: text.slice(0, 8000), // Titan v2の入力制限
      dimensions: 1024,
      normalize: true,
    }),
  });
  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embedding;
}

// チャンク分割: セクション（##）を境界にして意味のある単位で分割
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
      // 段落単位で分割
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

async function main() {
  console.log("\n📥 宅建v3教材 RAG投入開始\n");

  // 1. 教材JSON読み込み
  const topics: GeneratedTopic[] = JSON.parse(readFileSync(INPUT_FILE, "utf-8"));
  console.log(`  教材: ${topics.length}トピック / ${topics.reduce((s, t) => s + t.charCount, 0).toLocaleString()}字`);

  // 2. 旧データ削除（宅建のみ）
  console.log("\n  🗑️  旧宅建データを削除...");
  const { error: delError, count: delCount } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("exam_id", "takken");

  if (delError) {
    console.error(`  ❌ 削除エラー: ${delError.message}`);
  } else {
    console.log(`  ✅ ${delCount || 0}件削除`);
  }

  // 3. チャンク分割 + 挿入
  console.log("\n  📝 チャンク分割 + 挿入...");
  let totalChunks = 0;
  let insertErrors = 0;
  const allChunks: { id?: string; exam_id: string; subject: string; topic: string; content: string; metadata: Record<string, unknown> }[] = [];

  for (const topic of topics) {
    const chunks = chunkBySection(topic.content);

    const rows = chunks.map((chunk, idx) => ({
      exam_id: "takken",
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

    // バッチ挿入
    const { data, error } = await supabase.from("documents").insert(rows).select("id, content");
    if (error) {
      console.error(`  ❌ ${topic.subject} > ${topic.topic}: ${error.message}`);
      insertErrors++;
    } else {
      totalChunks += rows.length;
      if (data) allChunks.push(...data.map((d, i) => ({ ...rows[i], id: d.id })));
    }
  }

  console.log(`  ✅ ${totalChunks}チャンク挿入（エラー: ${insertErrors}）`);

  // 4. embedding付与
  console.log("\n  🧮 embedding付与...");

  // embeddingがNULLのドキュメントを取得
  const { data: nullDocs } = await supabase
    .from("documents")
    .select("id, content")
    .eq("exam_id", "takken")
    .is("embedding", null)
    .order("created_at", { ascending: true });

  const docsToEmbed = nullDocs || [];
  console.log(`  対象: ${docsToEmbed.length}件`);

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
        if (embedErrors <= 3) console.error(`  ❌ embed: ${updateErr.message}`);
      } else {
        embedded++;
      }

      if ((i + 1) % 50 === 0 || i === docsToEmbed.length - 1) {
        console.log(`  ✅ ${i + 1}/${docsToEmbed.length} embedded`);
      }
    } catch (err) {
      embedErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      if (embedErrors <= 3) console.error(`  ❌ embed error: ${msg.slice(0, 80)}`);
      // レートリミットの場合は待機
      if (msg.includes("Throttl") || msg.includes("rate")) {
        await new Promise(r => setTimeout(r, 5000));
        i--; // リトライ
        embedErrors--;
      }
    }
  }

  // 5. サマリー
  console.log(`\n========================================`);
  console.log(`📊 宅建v3 RAG投入完了`);
  console.log(`  トピック: ${topics.length}`);
  console.log(`  チャンク挿入: ${totalChunks}`);
  console.log(`  embedding付与: ${embedded}`);
  console.log(`  エラー: 挿入${insertErrors} / embed${embedErrors}`);

  // 検証: ランダムに1件検索してみる
  console.log(`\n  🔍 検索テスト...`);
  try {
    const testEmbedding = await embed("抵当権の法定地上権の成立要件を教えてください");
    const { data: results } = await supabase.rpc("match_documents", {
      query_embedding: JSON.stringify(testEmbedding),
      match_exam_id: "takken",
      match_subject: null,
      match_count: 3,
      match_threshold: 0.3,
    });

    if (results && results.length > 0) {
      console.log(`  ✅ 検索OK: ${results.length}件ヒット`);
      for (const r of results) {
        console.log(`    [${(r.similarity * 100).toFixed(1)}%] ${r.subject} > ${r.topic}: ${r.content.slice(0, 60)}...`);
      }
    } else {
      console.log(`  ⚠️ 検索結果0件`);
    }
  } catch (err) {
    console.log(`  ⚠️ 検索テストエラー: ${err}`);
  }

  console.log(`========================================\n`);
}

main().catch(console.error);
