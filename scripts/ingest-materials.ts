/**
 * 教材をSupabaseのdocumentsテーブルにRAG投入するスクリプト
 *
 * 使い方:
 *   bun run scripts/ingest-materials.ts
 *
 * 前提:
 *   - scripts/generate-materials.ts で教材JSONが生成済み
 *   - .env.local にSupabase環境変数が設定済み
 *   - VOYAGE_API_KEY があればembedding付きで保存（なければテキストのみ）
 */

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "fs";

const MATERIALS_DIR = "./scripts/materials";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

interface MaterialEntry {
  examId: string;
  examName: string;
  subject: string;
  topic: string;
  content: string;
  generatedAt: string;
}

// テキストをチャンクに分割（RAG用）
function chunkText(text: string, maxSize: number = 800): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxSize && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Voyage APIでembeddingを生成
async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!VOYAGE_API_KEY) return null;

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: "voyage-3-lite",
      input_type: "document",
    }),
  });

  if (!response.ok) {
    console.error("Voyage API error:", await response.text());
    return null;
  }

  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

async function main() {
  const files = readdirSync(MATERIALS_DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  console.log(`\n📥 RAG投入開始: ${files.length}ファイル`);
  console.log(`   Voyage API: ${VOYAGE_API_KEY ? "✅ embedding有効" : "⚠️ なし（テキストのみ）"}\n`);

  for (const file of files) {
    const materials: MaterialEntry[] = JSON.parse(
      readFileSync(`${MATERIALS_DIR}/${file}`, "utf-8")
    );

    console.log(`  📄 ${file}: ${materials.length}トピック`);

    for (const mat of materials) {
      // 既存チェック
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("exam_id", mat.examId)
        .eq("subject", mat.subject)
        .eq("topic", mat.topic)
        .limit(1);

      if (existing && existing.length > 0) {
        totalSkipped++;
        continue;
      }

      // チャンク分割
      const chunks = chunkText(mat.content);

      // embedding生成（Voyage APIがあれば）
      let embeddings: number[][] | null = null;
      if (VOYAGE_API_KEY) {
        try {
          embeddings = await embedTexts(chunks);
        } catch (err) {
          console.error(`    ❌ Embedding error for ${mat.topic}:`, err);
        }
      }

      // Supabaseに挿入
      const rows = chunks.map((chunk, idx) => ({
        exam_id: mat.examId,
        subject: mat.subject,
        topic: mat.topic,
        content: chunk,
        embedding: embeddings ? JSON.stringify(embeddings[idx]) : null,
        metadata: {
          examName: mat.examName,
          chunkIndex: idx,
          totalChunks: chunks.length,
          generatedAt: mat.generatedAt,
        },
      }));

      const { error } = await supabase.from("documents").insert(rows);
      if (error) {
        console.error(`    ❌ Insert error for ${mat.topic}:`, error.message);
        totalErrors++;
      } else {
        totalInserted += chunks.length;
      }

      // レート制限対策
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 RAG投入完了`);
  console.log(`  挿入: ${totalInserted}チャンク`);
  console.log(`  スキップ（既存）: ${totalSkipped}`);
  console.log(`  エラー: ${totalErrors}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
