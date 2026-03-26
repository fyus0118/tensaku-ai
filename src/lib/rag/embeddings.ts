import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!;
const VOYAGE_MODEL = "voyage-3-lite"; // 1024次元, 高速, 低コスト

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
 * Voyage AIでテキストをembeddingに変換
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: "document",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

/**
 * クエリ用embedding（検索に最適化）
 */
export async function embedQuery(query: string): Promise<number[]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [query],
      model: VOYAGE_MODEL,
      input_type: "query",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
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
