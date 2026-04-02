import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildTeachSystemPrompt, buildTeachFirstMessage } from "@/lib/prompts/teach";
import { getExamById } from "@/lib/exams";
import { getWeakPoints } from "@/lib/adaptive-engine";
import { teachPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { embedQuery } from "@/lib/rag/embeddings";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// 隠しタグからJSON形式の診断データを抽出
interface CoreEntry {
  content: string;
  level: number;
  connections: string[];
  mistake?: string;
  correction?: string;
  reason?: string;
  source: "correct" | "verified";
}

interface DiagnosticEntry {
  content: string;
  mistake?: string;
  reason?: string;
}

function parseHiddenTags(fullResult: string) {
  const correct: CoreEntry[] = [];
  const verified: CoreEntry[] = [];
  const caught: DiagnosticEntry[] = [];
  const missed: DiagnosticEntry[] = [];
  const errors: DiagnosticEntry[] = [];
  let maxLevel = 1;

  // LEVELタグ
  const levelMatches = [...fullResult.matchAll(/<!--LEVEL:(\d)-->/g)];
  for (const m of levelMatches) {
    const l = parseInt(m[1]);
    if (l > maxLevel) maxLevel = l;
  }

  // CORRECTタグ（JSON形式）
  for (const m of fullResult.matchAll(/<!--CORRECT:(.*?)-->/g)) {
    try {
      const data = JSON.parse(m[1]);
      correct.push({
        content: data.content || m[1],
        level: data.level || maxLevel,
        connections: data.connections || [],
        source: "correct",
      });
    } catch {
      correct.push({ content: m[1], level: maxLevel, connections: [], source: "correct" });
    }
  }

  // VERIFIEDタグ（JSON形式）
  for (const m of fullResult.matchAll(/<!--VERIFIED:(.*?)-->/g)) {
    try {
      const data = JSON.parse(m[1]);
      verified.push({
        content: data.content || m[1],
        level: data.level || maxLevel,
        connections: data.connections || [],
        mistake: data.mistake,
        correction: data.correction,
        source: "verified",
      });
    } catch {
      verified.push({ content: m[1], level: maxLevel, connections: [], source: "verified" });
    }
  }

  // CAUGHTタグ
  for (const m of fullResult.matchAll(/<!--CAUGHT:(.*?)-->/g)) {
    try {
      const data = JSON.parse(m[1]);
      caught.push({ content: data.content || m[1] });
    } catch {
      caught.push({ content: m[1] });
    }
  }

  // MISSEDタグ
  for (const m of fullResult.matchAll(/<!--MISSED:(.*?)-->/g)) {
    try {
      const data = JSON.parse(m[1]);
      missed.push({ content: data.content || m[1] });
    } catch {
      missed.push({ content: m[1] });
    }
  }

  // ERRORタグ
  for (const m of fullResult.matchAll(/<!--ERROR:(.*?)-->/g)) {
    try {
      const data = JSON.parse(m[1]);
      errors.push({ content: data.content || m[1], mistake: data.mistake, reason: data.reason });
    } catch {
      errors.push({ content: m[1] });
    }
  }

  return { correct, verified, caught, missed, errors, maxLevel };
}

// confidence計算: ソースと到達レベルに基づく
function calculateConfidence(source: "correct" | "verified", level: number): number {
  // 修正ループを経た知識は、自力修正できた分やや高い
  const baseConfidence = source === "verified" ? 0.85 : 0.75;
  // レベルが高いほどconfidenceが上がる (Lv1=+0, Lv6=+0.15)
  const levelBonus = (level - 1) * 0.03;
  return Math.min(1.0, baseConfidence + levelBonus);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const limited = checkRateLimit(user.id, "teach:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  }

  if (profile.plan === "free" && profile.free_reviews_used >= profile.free_reviews_limit) {
    return Response.json(
      { error: "無料プランの利用回数を使い切りました。プロプランにアップグレードしてください。" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = parseBody(teachPostSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { examId, subject, topic, message, history } = parsed.data;

  const exam = getExamById(examId);
  if (!exam) {
    return Response.json({ error: "不明な試験カテゴリです" }, { status: 400 });
  }

  // ユーザーの弱点を取得
  const weakPoints = await getWeakPoints(supabase, user.id, examId, 10);

  // ユーザーの既存Core知識を取得（同じトピック）
  const { data: existingCore } = await supabase
    .from("core_knowledge")
    .select("topic, content, understanding_depth")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("subject", subject)
    .order("understanding_depth", { ascending: false })
    .limit(10);

  const systemPrompt = buildTeachSystemPrompt({
    examName: exam.name,
    subject,
    topic,
    weakPoints,
    coreKnowledge: existingCore || undefined,
  });

  // 会話履歴を構築
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  if (history && Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-20);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: message });
  } else {
    const firstMsg = buildTeachFirstMessage(subject, topic);
    messages.push({ role: "assistant", content: firstMsg });
    messages.push({ role: "user", content: message });
  }

  // ストリーミング
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  let fullResult = "";
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResult += text;
            // 隠しタグはフロントに送らない
            const cleanText = text.replace(/<!--(?:CAUGHT|MISSED|ERROR|CORRECT|VERIFIED|LEVEL):.*?-->/g, "");
            if (cleanText) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: cleanText })}\n\n`)
              );
            }
          }
        }

        // 隠しタグを解析
        const diagnostics = parseHiddenTags(fullResult);

        // 表示用テキスト（タグ除去）
        const cleanResult = fullResult.replace(/<!--(?:CAUGHT|MISSED|ERROR|CORRECT|VERIFIED|LEVEL):.*?-->/g, "").trim();

        // 会話をDBに保存
        await supabase.from("chat_messages").insert([
          { user_id: user.id, exam_id: examId, subject, role: "user", content: message },
          { user_id: user.id, exam_id: examId, subject, role: "assistant", content: cleanResult },
        ]);

        // Core蓄積: CORRECT + VERIFIEDのみ
        const coreEntries = [...diagnostics.correct, ...diagnostics.verified];

        if (coreEntries.length > 0) {
          try {
            for (const entry of coreEntries) {
              // embedding生成
              let embedding: number[] | null = null;
              try {
                embedding = await embedQuery(entry.content);
              } catch (err) {
                console.error("embedding generation error:", err);
              }

              const confidence = calculateConfidence(entry.source, entry.level);

              // 同じトピックの既存知識を探す（UPSERT）
              const { data: existing } = await supabase
                .from("core_knowledge")
                .select("id, teach_count, understanding_depth, confidence")
                .eq("user_id", user.id)
                .eq("exam_id", examId)
                .eq("subject", subject)
                .eq("topic", topic || "")
                .eq("source", entry.source)
                .limit(1)
                .single();

              if (existing) {
                // 既存の知識を更新（深化）
                const newDepth = Math.max(existing.understanding_depth || 1, entry.level);
                const newConfidence = Math.min(1.0, Math.max(existing.confidence || 0, confidence));
                const newTeachCount = (existing.teach_count || 1) + 1;

                await supabase
                  .from("core_knowledge")
                  .update({
                    content: entry.content,
                    understanding_depth: newDepth,
                    confidence: newConfidence,
                    connections: entry.connections.length > 0 ? entry.connections : undefined,
                    initial_mistake: entry.mistake || undefined,
                    correction_path: entry.correction || undefined,
                    embedding: embedding ? JSON.stringify(embedding) : undefined,
                    teach_count: newTeachCount,
                    last_taught_at: new Date().toISOString(),
                  })
                  .eq("id", existing.id);
              } else {
                // 新規蓄積
                await supabase.from("core_knowledge").insert({
                  user_id: user.id,
                  exam_id: examId,
                  subject,
                  topic: topic || null,
                  content: entry.content,
                  source: entry.source,
                  understanding_depth: entry.level,
                  confidence,
                  connections: entry.connections.length > 0 ? entry.connections : null,
                  initial_mistake: entry.mistake || null,
                  correction_path: entry.correction || null,
                  embedding: embedding ? JSON.stringify(embedding) : null,
                  teach_count: 1,
                  last_taught_at: new Date().toISOString(),
                });
              }
            }
          } catch (err) {
            console.error("core_knowledge upsert error:", err);
          }
        }

        // 診断データを記録
        const hasDiagnostics = diagnostics.caught.length > 0 || diagnostics.missed.length > 0 ||
          diagnostics.errors.length > 0 || diagnostics.correct.length > 0 || diagnostics.verified.length > 0;

        if (hasDiagnostics) {
          try {
            await supabase.from("teach_diagnostics").insert({
              user_id: user.id,
              exam_id: examId,
              subject,
              topic: topic || null,
              question_level_reached: diagnostics.maxLevel,
              caught: diagnostics.caught,
              missed: diagnostics.missed,
              errors: diagnostics.errors,
              correct: diagnostics.correct,
              verified: diagnostics.verified,
            });
          } catch (err) {
            console.error("teach_diagnostics insert error:", err);
          }
        }

        // 無料プランの場合、使用回数を増やす
        if (profile.plan === "free") {
          await supabase
            .from("profiles")
            .update({ free_reviews_used: profile.free_reviews_used + 1 })
            .eq("id", user.id);
        }

        // 診断データをフロントに送信（拡張版）
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            diagnostics: {
              caught: diagnostics.caught.length,
              missed: diagnostics.missed.length,
              errors: diagnostics.errors.length,
              correct: diagnostics.correct.length,
              verified: diagnostics.verified.length,
              level: diagnostics.maxLevel,
              coreUpdated: coreEntries.length,
            },
          })}\n\n`)
        );

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (err) {
        console.error("teach streaming error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "エラーが発生しました" })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
