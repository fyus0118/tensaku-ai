import { searchDocuments, type SearchResult } from "./embeddings";

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
}): Promise<string> {
  try {
    const results = await searchDocuments({
      query: params.query,
      examId: params.examId,
      subject: params.subject,
      limit: 5,
      similarityThreshold: 0.3,
    });

    return formatRAGContext(results);
  } catch (error) {
    console.error("RAG context build failed:", error);
    return ""; // RAGが失敗してもチューターは動作する
  }
}

/**
 * 練習問題用: 科目・分野に関連する過去問や知識を取得
 */
export async function buildPracticeRAGContext(params: {
  examId: string;
  subject: string;
  topic?: string;
}): Promise<string> {
  const query = params.topic
    ? `${params.subject} ${params.topic} 過去問 重要論点`
    : `${params.subject} 頻出問題 重要論点`;

  try {
    const results = await searchDocuments({
      query,
      examId: params.examId,
      subject: params.subject,
      limit: 3,
      similarityThreshold: 0.25,
    });

    if (results.length === 0) return "";

    const formatted = results.map((r, i) =>
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
}): Promise<string> {
  try {
    const results = await searchDocuments({
      query: `${params.subject} 採点基準 模範解答 ${params.content.slice(0, 200)}`,
      examId: params.examId,
      subject: params.subject,
      limit: 3,
      similarityThreshold: 0.25,
    });

    if (results.length === 0) return "";

    return formatRAGContext(results);
  } catch (error) {
    console.error("Review RAG context build failed:", error);
    return "";
  }
}
