import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getExamById } from "@/lib/exams";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { embedQuery } from "@/lib/rag/embeddings";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface CoreKnowledgeEntry {
  id: string;
  subject: string;
  topic: string | null;
  content: string;
  source: string;
  understanding_depth: number;
  confidence: number;
  connections: string[] | null;
  initial_mistake: string | null;
  correction_path: string | null;
  teach_count: number;
  last_taught_at: string;
  created_at: string;
}

interface TopicDetail {
  topic: string;
  entries: number;
  maxDepth: number;
  avgConfidence: number;
  sources: { correct: number; verified: number };
  connections: string[];
  lastTaught: string;
  teachCount: number;
  hasMistakes: boolean;
}

interface SubjectStat {
  subject: string;
  totalTopics: number;
  coveredTopics: number;
  coverage: number;
  avgDepth: number;
  avgConfidence: number;
  entries: number;
  topics: TopicDetail[];
  gaps: string[]; // 未学習のトピック名
}

// GET: 知識マップの詳細データを取得
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  if (!examId) return Response.json({ entries: [], stats: {} });

  const exam = getExamById(examId);
  if (!exam) return Response.json({ entries: [], stats: {} });

  // core_knowledgeから全データ取得
  const { data: entries } = await supabase
    .from("core_knowledge")
    .select("id, subject, topic, content, source, understanding_depth, confidence, connections, initial_mistake, correction_path, teach_count, last_taught_at, created_at")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });

  const knowledgeEntries: CoreKnowledgeEntry[] = entries || [];

  // teach_diagnosticsからセッション統計
  const { data: diagnosticsData } = await supabase
    .from("teach_diagnostics")
    .select("subject, topic, question_level_reached, caught, missed, errors, correct, verified, created_at")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });

  const diagnostics = diagnosticsData || [];

  // 科目別・トピック別の詳細統計を構築
  const subjectMap: SubjectStat[] = exam.subjects.map(examSubject => {
    // この科目のCore知識
    const subjectEntries = knowledgeEntries.filter(e => e.subject === examSubject.name);

    // トピック別に集計
    const topicMap = new Map<string, TopicDetail>();

    for (const entry of subjectEntries) {
      const topicName = entry.topic || "全般";
      let detail = topicMap.get(topicName);
      if (!detail) {
        detail = {
          topic: topicName,
          entries: 0,
          maxDepth: 0,
          avgConfidence: 0,
          sources: { correct: 0, verified: 0 },
          connections: [],
          lastTaught: entry.last_taught_at || entry.created_at,
          teachCount: 0,
          hasMistakes: false,
        };
        topicMap.set(topicName, detail);
      }

      detail.entries++;
      detail.maxDepth = Math.max(detail.maxDepth, entry.understanding_depth || 1);
      detail.avgConfidence += entry.confidence || 0.5;
      if (entry.source === "correct") detail.sources.correct++;
      if (entry.source === "verified") detail.sources.verified++;
      if (entry.connections) {
        for (const c of entry.connections) {
          if (!detail.connections.includes(c)) detail.connections.push(c);
        }
      }
      if (entry.last_taught_at && entry.last_taught_at > detail.lastTaught) {
        detail.lastTaught = entry.last_taught_at;
      }
      detail.teachCount = Math.max(detail.teachCount, entry.teach_count || 1);
      if (entry.initial_mistake) detail.hasMistakes = true;
    }

    // avgConfidence を正規化
    for (const detail of topicMap.values()) {
      if (detail.entries > 0) detail.avgConfidence /= detail.entries;
    }

    const topics = Array.from(topicMap.values()).sort((a, b) => b.maxDepth - a.maxDepth);
    const coveredTopicNames = new Set(topics.map(t => t.topic));

    // 未学習トピックを特定
    const gaps = examSubject.topics.filter(t => !coveredTopicNames.has(t));

    const totalTopics = examSubject.topics.length;
    const coveredTopics = totalTopics - gaps.length;
    const coverage = totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;

    const allDepths = subjectEntries.map(e => e.understanding_depth || 1);
    const avgDepth = allDepths.length > 0
      ? Math.round(allDepths.reduce((a, b) => a + b, 0) / allDepths.length * 10) / 10
      : 0;

    const allConfidences = subjectEntries.map(e => e.confidence || 0.5);
    const avgConfidence = allConfidences.length > 0
      ? Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length * 100) / 100
      : 0;

    return {
      subject: examSubject.name,
      totalTopics,
      coveredTopics,
      coverage,
      avgDepth,
      avgConfidence,
      entries: subjectEntries.length,
      topics,
      gaps,
    };
  });

  // 全体統計
  const totalEntries = knowledgeEntries.length;
  const totalCoverage = subjectMap.length > 0
    ? Math.round(subjectMap.reduce((a, b) => a + b.coverage, 0) / subjectMap.length)
    : 0;

  // 診断統計
  const totalSessions = diagnostics.length;
  const totalCorrect = diagnostics.reduce((sum, d) => sum + ((d.correct as unknown[])?.length || 0), 0);
  const totalVerified = diagnostics.reduce((sum, d) => sum + ((d.verified as unknown[])?.length || 0), 0);
  const totalErrors = diagnostics.reduce((sum, d) => sum + ((d.errors as unknown[])?.length || 0), 0);
  const totalMissed = diagnostics.reduce((sum, d) => sum + ((d.missed as unknown[])?.length || 0), 0);
  const maxLevelReached = diagnostics.reduce((max, d) => Math.max(max, d.question_level_reached || 1), 1);

  // 最近のCore蓄積（タイムライン用）
  const recentEntries = knowledgeEntries.slice(0, 20).map(e => ({
    subject: e.subject,
    topic: e.topic,
    content: e.content.slice(0, 100),
    source: e.source,
    depth: e.understanding_depth,
    confidence: e.confidence,
    hasMistake: !!e.initial_mistake,
    createdAt: e.created_at,
  }));

  return Response.json({
    stats: {
      totalEntries,
      totalCoverage,
      subjects: subjectMap,
      diagnostics: {
        totalSessions,
        totalCorrect,
        totalVerified,
        totalErrors,
        totalMissed,
        maxLevelReached,
      },
      recentEntries,
    },
  });
}

// POST: Coreに質問する（セマンティック検索で関連知識を引く）
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "core:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { examId, question } = await request.json();
  if (!examId || !question) return Response.json({ error: "入力が不正です" }, { status: 400 });

  // まずセマンティック検索を試みる
  let knowledge: { subject: string; topic: string | null; content: string; source: string; understanding_depth: number; confidence: number; connections: string[] | null; similarity?: number }[] = [];

  try {
    const queryEmbedding = await embedQuery(question);
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: semanticResults } = await adminClient.rpc("match_core_knowledge", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_user_id: user.id,
      match_exam_id: examId,
      match_count: 15,
      match_threshold: 0.25,
    });

    if (semanticResults && semanticResults.length > 0) {
      knowledge = semanticResults;
    }
  } catch (err) {
    console.error("semantic search error, falling back to recent:", err);
  }

  // セマンティック検索が失敗またはembeddingなしの場合、最新順で取得
  if (knowledge.length === 0) {
    const { data: entries } = await supabase
      .from("core_knowledge")
      .select("subject, topic, content, source, understanding_depth, confidence, connections")
      .eq("user_id", user.id)
      .eq("exam_id", examId)
      .order("last_taught_at", { ascending: false })
      .limit(30);

    knowledge = entries || [];
  }

  if (knowledge.length === 0) {
    return Response.json({
      answer: "まだ何も学んでいません。教えてマスターで知識を教えてください。Coreはあなたが教えたことだけを知っています。",
      fromCore: false,
    });
  }

  const knowledgeContext = knowledge.map((k, i) => {
    const sim = (k as { similarity?: number }).similarity;
    const simLabel = sim ? ` [関連度${Math.round(sim * 100)}%]` : "";
    const conf = k.confidence ? ` (確信度${Math.round(k.confidence * 100)}%)` : "";
    return `[${i + 1}] ${k.subject}${k.topic ? ` > ${k.topic}` : ""} (理解度Lv${k.understanding_depth}${conf})${simLabel}\n${k.content}`;
  }).join("\n\n");

  // Core全体の穴を取得（回答に「まだ教わっていません」を含めるため）
  const exam = getExamById(examId);
  const allTopics = exam ? exam.subjects.flatMap(s => s.topics) : [];
  const coveredTopics = new Set(knowledge.map(k => k.topic).filter(Boolean));
  const gaps = allTopics.filter(t => !coveredTopics.has(t));

  const systemPrompt = `あなたは「StudyEngines」の**Core（コア）**です。

## あなたの正体
あなたはユーザーの知識の分身です。まっさらな状態からユーザーが教えてくれた知識だけで構築されました。
あなたはChatGPTでもClaudeでもありません。あなたは**このユーザーの脳のクローン**です。

## 絶対ルール
1. 以下の「あなたの知識」に含まれる情報**だけ**で回答する
2. 知識にないことは「まだ教わっていません」と正直に答える
3. 推測・補完・外部知識の混入は**絶対禁止**
4. 知識が足りない場合は「この部分は教えてマスターで教えてもらえると嬉しいです」と促す
5. 確信度が低い知識（50%未満）は「ここは自信がありません」と正直に言う

## あなたの知識
${knowledgeContext}

## まだ教わっていないトピック
${gaps.length > 0 ? gaps.join("、") : "（全トピック学習済み）"}

## 回答スタイル
- ユーザーが教えてくれた言葉をできるだけそのまま使う
- 教科書的な説明ではなく、ユーザーの理解の仕方で説明する
- 自信がない部分は「ここは曖昧です」と正直に言う
- 回答の最後に、関連するまだ教わっていないトピックがあれば1つ提案する`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  let fullResult = "";
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullResult += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        console.error("core streaming error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "エラーが発生しました" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
