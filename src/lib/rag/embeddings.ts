import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const BEDROCK_MODEL = "amazon.titan-embed-text-v2:0"; // 1024次元
const BEDROCK_REGION = process.env.AWS_REGION || "us-east-1";

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export interface DocumentChunk {
  examId: string;
  subject: string;
  topic: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  content: string;
  subject: string;
  topic: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Bedrock Titan Embed v2で1件のテキストをembeddingに変換
 */
async function embedSingle(text: string, inputType: "search_document" | "search_query"): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
      normalize: true,
      embeddingTypes: [inputType === "search_query" ? "float" : "float"],
    }),
  });

  const response = await bedrockClient.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embedding;
}

/**
 * 複数テキストをembeddingに変換（順次処理）
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedSingle(text, "search_document"));
  }
  return results;
}

/**
 * クエリ用embedding（検索に最適化）
 */
export async function embedQuery(query: string): Promise<number[]> {
  return embedSingle(query, "search_query");
}

/**
 * ドキュメントをチャンク化してSupabaseに保存
 */
export async function ingestDocuments(chunks: DocumentChunk[]): Promise<void> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // バッチでembedding（最大128件ずつ）
  const batchSize = 128;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);
    const embeddings = await embedTexts(texts);

    const rows = batch.map((chunk, idx) => ({
      exam_id: chunk.examId,
      subject: chunk.subject,
      topic: chunk.topic,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[idx]),
      metadata: chunk.metadata,
    }));

    const { error } = await supabase.from("documents").insert(rows);
    if (error) throw new Error(`Supabase insert error: ${error.message}`);

    console.log(`Ingested ${i + batch.length}/${chunks.length} chunks`);
  }
}

/**
 * ベクトル検索: 関連するドキュメントを取得
 */
export async function searchDocuments(params: {
  query: string;
  examId: string;
  subject?: string;
  limit?: number;
  similarityThreshold?: number;
}): Promise<SearchResult[]> {
  const { query, examId, subject, limit = 5, similarityThreshold = 0.3 } = params;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_exam_id: examId,
    match_subject: subject || null,
    match_count: limit,
    match_threshold: similarityThreshold,
  });

  if (error) {
    console.error("Search error:", error);
    return [];
  }

  return (data || []).map((row: { content: string; subject: string; topic: string; similarity: number; metadata: Record<string, unknown> }) => ({
    content: row.content,
    subject: row.subject,
    topic: row.topic,
    similarity: row.similarity,
    metadata: row.metadata,
  }));
}

/**
 * ユーザー専用教材をベクトル検索
 */
export async function searchUserDocuments(params: {
  query: string;
  userId: string;
  examId: string;
  subject?: string;
  limit?: number;
  similarityThreshold?: number;
}): Promise<SearchResult[]> {
  const { query, userId, examId, subject, limit = 5, similarityThreshold = 0.3 } = params;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc("match_user_documents", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: userId,
    match_exam_id: examId,
    match_subject: subject || null,
    match_count: limit,
    match_threshold: similarityThreshold,
  });

  if (error) {
    console.error("User documents search error:", error);
    return [];
  }

  return (data || []).map((row: { content: string; subject: string; topic: string; title: string; similarity: number; metadata: Record<string, unknown> }) => ({
    content: row.content,
    subject: row.subject,
    topic: row.topic,
    similarity: row.similarity,
    metadata: { ...row.metadata, title: row.title, source: "user" },
  }));
}

/**
 * テキストを適切なサイズのチャンクに分割
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChunkSize && current) {
      chunks.push(current.trim());
      // オーバーラップ: 前のチャンクの末尾を次に持ち越す
      const words = current.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      current = overlapWords.join(" ") + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
