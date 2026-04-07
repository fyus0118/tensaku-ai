import { searchDocuments, searchUserDocuments, type SearchResult } from "./embeddings";

export interface RAGReference {
  key: string;
  source: "official" | "user";
  subject: string;
  topic: string | null;
  title: string | null;
  similarity: number;
  excerpt: string;
  materialId: string | null;
}

function buildReferenceKey(result: SearchResult): string {
  const source = result.metadata?.source === "user" ? "user" : "official";
  const materialId =
    typeof result.metadata?.materialId === "string" ? result.metadata.materialId : null;

  if (source === "user" && materialId) {
    return `user:${materialId}`;
  }

  const title =
    typeof result.metadata?.title === "string" ? result.metadata.title : result.topic || result.subject;
  return `${source}:${result.subject}:${result.topic || ""}:${title}`;
}

function buildReferenceExcerpt(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 110 ? `${compact.slice(0, 109).trim()}…` : compact;
}

export function buildRAGReferences(results: SearchResult[], limit: number = 5): RAGReference[] {
  const byKey = new Map<string, RAGReference>();

  for (const result of results) {
    const key = buildReferenceKey(result);
    const candidate: RAGReference = {
      key,
      source: result.metadata?.source === "user" ? "user" : "official",
      subject: result.subject,
      topic: result.topic || null,
      title: typeof result.metadata?.title === "string" ? result.metadata.title : null,
      similarity: result.similarity,
      excerpt: buildReferenceExcerpt(result.content),
      materialId:
        typeof result.metadata?.materialId === "string" ? result.metadata.materialId : null,
    };

    const existing = byKey.get(key);
    if (!existing || candidate.similarity > existing.similarity) {
      byKey.set(key, candidate);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * RAG検索結果をプロンプトに注入可能な形式に整形
 */
export function formatRAGContext(results: SearchResult[]): string {
  if (results.length === 0) return "";

  const sections = results.map((r, i) => {
    const header = `[参考資料${i + 1}] ${r.subject}${r.topic ? ` > ${r.topic}` : ""} (関連度: ${Math.round(r.similarity * 100)}%)`;
    return `${header}\n${r.content}`;
  });

  return `\n\n## 参考資料（RAGから取得）\n\n以下はデータベースから取得した関連資料です。回答の根拠として活用してください。ただし、資料に含まれない情報を捏造しないでください。\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * チューター用: 質問に関連する知識を取得してコンテキストを構築
 */
export async function buildTutorRAGContext(params: {
  query: string;
  examId: string;
  subject?: string;
  userId?: string;
}): Promise<string> {
  const bundle = await buildTutorRAGBundle(params);
  return bundle.context;
}

export async function buildTutorRAGBundle(params: {
  query: string;
  examId: string;
  subject?: string;
  userId?: string;
}): Promise<{ context: string; references: RAGReference[] }> {
  try {
    const searches = [
      searchDocuments({
        query: params.query,
        examId: params.examId,
        subject: params.subject,
        limit: 5,
        similarityThreshold: 0.3,
      }),
    ];

    if (params.userId) {
      searches.push(
        searchUserDocuments({
          query: params.query,
          userId: params.userId,
          examId: params.examId,
          subject: params.subject,
          limit: 3,
          similarityThreshold: 0.25,
        })
      );
    }

    const allResults = (await Promise.all(searches)).flat();
    allResults.sort((a, b) => b.similarity - a.similarity);
    const topResults = allResults.slice(0, 8);
    return {
      context: formatRAGContext(topResults),
      references: buildRAGReferences(topResults, 5),
    };
  } catch (error) {
    console.error("RAG context build failed:", error);
    return { context: "", references: [] };
  }
}

/**
 * 練習問題用: 科目・分野に関連する過去問や知識を取得
 */
export async function buildPracticeRAGContext(params: {
  examId: string;
  subject: string;
  topic?: string;
  userId?: string;
}): Promise<string> {
  const query = params.topic
    ? `${params.subject} ${params.topic} 過去問 重要論点`
    : `${params.subject} 頻出問題 重要論点`;

  try {
    const searches = [
      searchDocuments({
        query,
        examId: params.examId,
        subject: params.subject,
        limit: 3,
        similarityThreshold: 0.25,
      }),
    ];

    if (params.userId) {
      searches.push(
        searchUserDocuments({
          query,
          userId: params.userId,
          examId: params.examId,
          subject: params.subject,
          limit: 2,
          similarityThreshold: 0.25,
        })
      );
    }

    const results = (await Promise.all(searches)).flat();
    results.sort((a, b) => b.similarity - a.similarity);
    const top = results.slice(0, 5);

    if (top.length === 0) return "";

    const formatted = top.map((r, i) =>
      `[過去の出題例${i + 1}] ${r.topic || r.subject}\n${r.content}`
    ).join("\n\n");

    return `\n\n## 参考: 過去の出題傾向\n\n以下を参考に、類似だが異なるオリジナル問題を作成してください。\n\n${formatted}`;
  } catch (error) {
    console.error("Practice RAG context build failed:", error);
    return "";
  }
}

/**
 * 添削用: 採点基準や模範解答に関連する知識を取得
 */
export async function buildReviewRAGContext(params: {
  examId: string;
  subject: string;
  content: string;
  userId?: string;
}): Promise<string> {
  try {
    const query = `${params.subject} 採点基準 模範解答 ${params.content.slice(0, 200)}`;
    const searches = [
      searchDocuments({
        query,
        examId: params.examId,
        subject: params.subject,
        limit: 3,
        similarityThreshold: 0.25,
      }),
    ];

    if (params.userId) {
      searches.push(
        searchUserDocuments({
          query,
          userId: params.userId,
          examId: params.examId,
          subject: params.subject,
          limit: 2,
          similarityThreshold: 0.25,
        })
      );
    }

    const results = (await Promise.all(searches)).flat();
    results.sort((a, b) => b.similarity - a.similarity);

    if (results.length === 0) return "";

    return formatRAGContext(results.slice(0, 5));
  } catch (error) {
    console.error("Review RAG context build failed:", error);
    return "";
  }
}
