/**
 * 既存ドキュメントのembedding(NULL)をAWS Bedrock Titan Embed v2で埋める
 *
 * 使い方: bun run scripts/backfill-embeddings.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BEDROCK_MODEL = "amazon.titan-embed-text-v2:0";
const BATCH_SIZE = 20; // Bedrock は1件ずつだが、DB更新をまとめる単位

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

async function embed(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
      normalize: true,
    }),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embedding;
}

async function main() {
  // embedding が NULL のドキュメントを取得
  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, content")
    .is("embedding", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("取得エラー:", error.message);
    process.exit(1);
  }

  if (!docs || docs.length === 0) {
    console.log("✅ 全ドキュメントにembedding済み。処理不要。");
    return;
  }

  console.log(`\n🔄 embedding未設定: ${docs.length}件\n`);

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    try {
      const embedding = await embed(doc.content);

      const { error: updateErr } = await supabase
        .from("documents")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", doc.id);

      if (updateErr) {
        console.error(`  ❌ ${doc.id}: ${updateErr.message}`);
        errors++;
      } else {
        processed++;
      }

      if ((i + 1) % BATCH_SIZE === 0) {
        console.log(`  ✅ ${i + 1}/${docs.length} 完了`);
      }
    } catch (e) {
      console.error(`  ❌ ${doc.id}: ${e}`);
      errors++;
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 embedding付与完了`);
  console.log(`  成功: ${processed}件`);
  console.log(`  エラー: ${errors}件`);
  console.log(`========================================\n`);
}

main().catch(console.error);
