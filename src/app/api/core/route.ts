import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getExamById } from "@/lib/exams";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// GET: Coreの知識マップを取得
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  if (!examId) return Response.json({ entries: [], stats: {} });

  const exam = getExamById(examId);
  if (!exam) return Response.json({ entries: [], stats: {} });

  // core_knowledgeから取得
  const { data: entries } = await supabase
    .from("core_knowledge")
    .select("subject, topic, content, source, understanding_depth, created_at")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });

  const knowledgeEntries = entries || [];

  // 科目別の知識充足度を計算
  const subjectStats: Record<string, { total: number; topics: Set<string>; avgDepth: number; depths: number[] }> = {};

  for (const entry of knowledgeEntries) {
    const s = entry.subject;
    if (!subjectStats[s]) subjectStats[s] = { total: 0, topics: new Set(), avgDepth: 0, depths: [] };
    subjectStats[s].total++;
    if (entry.topic) subjectStats[s].topics.add(entry.topic);
    subjectStats[s].depths.push(entry.understanding_depth || 3);
  }

  // 試験の全科目に対する充足率
  const subjectMap = exam.subjects.map(s => {
    const stat = subjectStats[s.name];
    const totalTopics = s.topics.length;
    const coveredTopics = stat ? stat.topics.size : 0;
    const coverage = totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;
    const avgDepth = stat && stat.depths.length > 0
      ? Math.round(stat.depths.reduce((a, b) => a + b, 0) / stat.depths.length * 10) / 10
      : 0;

    return {
      subject: s.name,
      totalTopics,
      coveredTopics,
      coverage,
      avgDepth,
      entries: stat?.total || 0,
    };
  });

  const totalEntries = knowledgeEntries.length;
  const totalCoverage = subjectMap.length > 0
    ? Math.round(subjectMap.reduce((a, b) => a + b.coverage, 0) / subjectMap.length)
    : 0;

  return Response.json({
    entries: knowledgeEntries.slice(0, 50),
    stats: {
      totalEntries,
      totalCoverage,
      subjects: subjectMap,
    },
  });
}

// POST: Coreに質問する（Coreが知っていることだけで回答）
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "core:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { examId, question } = await request.json();
  if (!examId || !question) return Response.json({ error: "入力が不正です" }, { status: 400 });

  // Coreの知識を取得
  const { data: entries } = await supabase
    .from("core_knowledge")
    .select("subject, topic, content, source, understanding_depth")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false })
    .limit(50);

  const knowledge = entries || [];

  if (knowledge.length === 0) {
    return Response.json({
      answer: "まだ何も学んでいません。教えてマスターで知識を教えてください。Coreはあなたが教えたことだけを知っています。",
      fromCore: false,
    });
  }

  const knowledgeContext = knowledge.map((k, i) =>
    `[${i + 1}] ${k.subject}${k.topic ? ` > ${k.topic}` : ""} (深さLv${k.understanding_depth})\n${k.content}`
  ).join("\n\n");

  const systemPrompt = `あなたは「StudyEngines」の**Core（コア）**です。

## あなたの正体
あなたはユーザーの知識の分身です。まっさらな状態からユーザーが教えてくれた知識だけで構築されました。
あなたはChatGPTでもClaudeでもありません。あなたは**このユーザーの脳のクローン**です。

## 絶対ルール
1. 以下の「あなたの知識」に含まれる情報**だけ**で回答する
2. 知識にないことは「まだ教わっていません」と正直に答える
3. 推測・補完・外部知識の混入は**絶対禁止**
4. 知識が足りない場合は「この部分は教えてマスターで教えてもらえると嬉しいです」と促す

## あなたの知識
${knowledgeContext}

## 回答スタイル
- ユーザーが教えてくれた言葉をできるだけそのまま使う
- 教科書的な説明ではなく、ユーザーの理解の仕方で説明する
- 自信がない部分は「ここは曖昧です」と正直に言う`;

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
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "エラーが発生しました" })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
