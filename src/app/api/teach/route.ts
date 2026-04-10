import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildTeachSystemPrompt, buildTeachFirstMessage } from "@/lib/prompts/teach";
import { getExamById } from "@/lib/exams";
import { getWeakPoints } from "@/lib/adaptive-engine";
import { teachPostSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { embedQuery } from "@/lib/rag/embeddings";
import {
  calculateBaseConfidence,
  updateStability,
  calcRetroactiveInterference,
  detectContradictions,
  detectAbstractionUpgrade,
  executeAbstractionUpgrade,
  detectChunkingOpportunities,
  executeChunking,
  verifyAgainstRAG,
  selectRelatedProbeTargets,
  calcEffectiveConfidence,
  getInterleaveRecommendations,
  type CoreKnowledgeRow,
  type OperationEvidence,
} from "@/lib/core-engine";

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

// daysSince utility
function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
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

  // ユーザーの既存Core知識を取得（同じ科目の全知識 - Brain Model用）
  const { data: existingCore } = await supabase
    .from("core_knowledge")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("subject", subject)
    .order("understanding_depth", { ascending: false })
    .limit(100);

  // Brain Model: 既存Core知識から矛盾検出用コンテキストとプローブ対象を準備
  const allExistingForPrompt = (existingCore || []) as CoreKnowledgeRow[];
  const contradictionContext = allExistingForPrompt.length > 0
    ? allExistingForPrompt.slice(0, 10).map(e =>
      `- ${e.topic}: ${e.content.slice(0, 150)}`
    ).join("\n")
    : undefined;

  const probeTargetsForPrompt = selectRelatedProbeTargets(
    allExistingForPrompt.flatMap(e => e.connections || []),
    allExistingForPrompt
  ).map(t => ({
    topic: t.topic || "",
    effectiveConfidence: Math.round(calcEffectiveConfidence(t) * 100),
  }));

  const systemPrompt = buildTeachSystemPrompt({
    examName: exam.name,
    subject,
    topic,
    weakPoints,
    coreKnowledge: existingCore || undefined,
    contradictionContext,
    probeTargets: probeTargetsForPrompt.length > 0 ? probeTargetsForPrompt : undefined,
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

        // Core蓄積: CORRECT + VERIFIEDのみ (Brain Model)
        const coreEntries = [...diagnostics.correct, ...diagnostics.verified];
        const allExisting = (existingCore || []) as CoreKnowledgeRow[];
        let probeTargets: CoreKnowledgeRow[] = [];
        let abstractionUpgrade = null;

        if (coreEntries.length > 0) {
          try {
            for (const entry of coreEntries) {
              const now = new Date().toISOString();

              // embedding生成
              let embedding: number[] | null = null;
              try {
                embedding = await embedQuery(entry.content);
              } catch (err) {
                console.error("embedding generation error:", err);
              }

              // mistake_embedding生成 (VERIFIED = 過去に間違えた → 誤解のベクトルを保存)
              let mistakeEmbedding: number[] | null = null;
              if (entry.source === "verified" && entry.mistake) {
                try {
                  mistakeEmbedding = await embedQuery(entry.mistake);
                } catch (err) {
                  console.error("mistake embedding error:", err);
                }
              }

              const confidence = calculateBaseConfidence(entry.source, entry.level);

              // 同じトピックの既存知識を探す（UPSERT）
              const { data: existing } = await supabase
                .from("core_knowledge")
                .select("id, teach_count, understanding_depth, confidence, stability, last_taught_at, operation_evidence, retrieval_contexts")
                .eq("user_id", user.id)
                .eq("exam_id", examId)
                .eq("subject", subject)
                .eq("topic", topic || "")
                .eq("source", entry.source)
                .limit(1)
                .single();

              // operation_evidence更新
              const opEvidence: OperationEvidence = existing?.operation_evidence || {
                recognized: false, reproduced: false, explained: false, applied: false, integrated: false,
              };
              opEvidence.explained = true;
              if (entry.source === "verified") {
                opEvidence.reproduced = true;
              }

              // retrieval_contexts更新 (このteachセッションの文脈を追加)
              const existingContexts = existing?.retrieval_contexts || [];
              const newContexts = [
                ...existingContexts,
                { context: `teach:${subject}/${topic}`, at: now },
              ].slice(-20);

              if (existing) {
                // 既存の知識を更新（深化）+ stability更新
                const newDepth = Math.max(existing.understanding_depth || 1, entry.level);
                const newTeachCount = (existing.teach_count || 1) + 1;
                const timeSince = daysSince(existing.last_taught_at);
                const newStability = updateStability(
                  existing.stability || 3.0,
                  true,
                  timeSince,
                  entry.level
                );

                await supabase
                  .from("core_knowledge")
                  .update({
                    content: entry.content,
                    understanding_depth: newDepth,
                    confidence: Math.min(1.0, Math.max(existing.confidence || 0, confidence)),
                    connections: entry.connections.length > 0 ? entry.connections : undefined,
                    initial_mistake: entry.mistake || undefined,
                    correction_path: entry.correction || undefined,
                    embedding: embedding ? JSON.stringify(embedding) : undefined,
                    mistake_embedding: mistakeEmbedding ? JSON.stringify(mistakeEmbedding) : undefined,
                    teach_count: newTeachCount,
                    last_taught_at: now,
                    stability: newStability,
                    operation_evidence: opEvidence,
                    retrieval_contexts: newContexts,
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
                  mistake_embedding: mistakeEmbedding ? JSON.stringify(mistakeEmbedding) : null,
                  teach_count: 1,
                  last_taught_at: now,
                  stability: 3.0,
                  operation_evidence: opEvidence,
                  retrieval_contexts: newContexts,
                });
              }

              // 逆行干渉: 同subjectの既存知識のstabilityを微減
              if (embedding && allExisting.length > 0) {
                const interference = calcRetroactiveInterference(embedding, allExisting);
                for (const { id, stabilityMultiplier } of interference) {
                  const target = allExisting.find(e => e.id === id);
                  if (target) {
                    await supabase.from("core_knowledge").update({
                      stability: Math.max(3, (target.stability || 3) * stabilityMultiplier),
                    }).eq("id", id);
                  }
                }
              }

              // 矛盾検出 (非同期、エラーでも蓄積は止めない)
              if (embedding && allExisting.length > 0) {
                detectContradictions(entry.content, embedding, allExisting).then(result => {
                  if (result.contradicts) {
                    for (const conflictId of result.conflictingIds) {
                      supabase.from("core_knowledge").update({
                        interference_count: allExisting.find(e => e.id === conflictId)?.interference_count
                          ? allExisting.find(e => e.id === conflictId)!.interference_count + 1
                          : 1,
                      }).eq("id", conflictId).then(() => {});
                    }
                  }
                }).catch(() => {});
              }

              // RAG照合 (非同期、最大1件/セッション)
              if (embedding && coreEntries.indexOf(entry) === 0) {
                const entryForRAG = {
                  ...({} as CoreKnowledgeRow),
                  id: existing?.id || "",
                  content: entry.content,
                  embedding,
                  subject,
                } as CoreKnowledgeRow;
                verifyAgainstRAG(entryForRAG, examId).then(async (ragResult) => {
                  if (existing?.id && ragResult.status !== "unverifiable") {
                    await supabase.from("core_knowledge").update({
                      rag_verified_at: now,
                      rag_verification_status: ragResult.status,
                      ...(ragResult.status === "contradicted" ? {
                        confidence: Math.max(0.1, confidence * 0.5),
                        interference_count: (allExisting.find(e => e.id === existing.id)?.interference_count || 0) + 2,
                      } : {}),
                    }).eq("id", existing.id);
                  }
                }).catch(() => {});
              }

              // 抽象度昇格の検出と実行
              if (!abstractionUpgrade) {
                const fakeEntry = { topic, subject, id: existing?.id || "" } as CoreKnowledgeRow;
                abstractionUpgrade = detectAbstractionUpgrade(fakeEntry, allExisting);
                if (abstractionUpgrade) {
                  executeAbstractionUpgrade(supabase, user.id, examId, abstractionUpgrade, allExisting).catch(() => {});
                }
              }
            }

            // チャンキング自動実行（候補があれば統合）
            const chunkCandidates = detectChunkingOpportunities(allExisting);
            for (const candidate of chunkCandidates) {
              executeChunking(supabase, user.id, examId, candidate).catch(() => {});
            }

            // 関連知識プローブ対象を選定
            const allConnections = coreEntries.flatMap(e => e.connections || []);
            if (allConnections.length > 0) {
              probeTargets = selectRelatedProbeTargets(allConnections, allExisting);
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

        // インターリーブ推奨を生成
        const recentSubjects = [subject]; // 現在のセッションの科目
        const interleaveRecs = allExisting.length > 0
          ? getInterleaveRecommendations(subject, topic || null, allExisting, recentSubjects)
          : [];

        // 診断データをフロントに送信（Brain Model拡張版）
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
              probeTargets: probeTargets.map(t => ({
                topic: t.topic,
                effectiveConfidence: Math.round(calcEffectiveConfidence(t) * 100),
              })),
              abstractionUpgrade: abstractionUpgrade ? {
                topic: abstractionUpgrade.topic,
                contexts: abstractionUpgrade.contexts,
              } : null,
              interleave: interleaveRecs.map(r => ({
                subject: r.subject,
                topic: r.topic,
                reason: r.reason,
                effectiveConfidence: Math.round(r.effectiveConfidence * 100),
                retentionStatus: r.retentionStatus,
              })),
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
