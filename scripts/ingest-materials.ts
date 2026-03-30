/**
 * 教材をSupabaseのdocumentsテーブルにRAG投入
 *
 * 使い方: bun run scripts/ingest-materials.ts
 * 前提: scripts/generate-materials-v2.ts で教材JSONが生成済み
 */

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MATERIALS_DIR = "./scripts/materials-v2";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MaterialEntry {
  examId: string;
  subject: string;
  topic: string;
  content: string;
  sourceType: string;
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

async function main() {
  const files = readdirSync(MATERIALS_DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  console.log(`\n📥 RAG投入開始: ${files.length}ファイル\n`);

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

      // Supabaseに挿入（embeddingはnull、後から追加可能）
      const rows = chunks.map((chunk, idx) => ({
        exam_id: mat.examId,
        subject: mat.subject,
        topic: mat.topic,
        content: chunk,
        metadata: {
          sourceType: mat.sourceType,
          chunkIndex: idx,
          totalChunks: chunks.length,
          generatedAt: mat.generatedAt,
        },
      }));

      const { error } = await supabase.from("documents").insert(rows);
      if (error) {
        console.error(`    ❌ ${mat.subject} > ${mat.topic}: ${error.message}`);
        totalErrors++;
      } else {
        totalInserted += chunks.length;
      }

      await new Promise(r => setTimeout(r, 100));
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
