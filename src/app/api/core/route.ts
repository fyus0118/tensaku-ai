import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getExamById } from "@/lib/exams";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { embedQuery } from "@/lib/rag/embeddings";
import {
  calcEffectiveConfidence,
  calcConsistencyScore,
  calibrateConfidence,
  reconstructKnowledge,
  updateStability,
  getRetentionStatus,
  calcRetention,
  getOperationLevel,
  detectChunkingOpportunities,
  buildReviewSchedule,
  getInterleaveRecommendations,
  discoverInsights,
  predictTraps,
  buildCorePersonalityPrompt,
  type CoreKnowledgeRow,
} from "@/lib/core-engine";
import { generateProactiveReport } from "@/lib/core-engine-analysis";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface TopicDetail {
  topic: string;
  entries: number;
  maxDepth: number;
  avgConfidence: number;
  avgEffectiveConfidence: number;
  sources: { correct: number; verified: number };
  connections: string[];
  lastTaught: string;
  teachCount: number;
  hasMistakes: boolean;
  retentionStatus: string;
  needsReview: boolean;
  operationLevel: string;
  ragStatus: string;
}

interface SubjectStat {
  subject: string;
  totalTopics: number;
  coveredTopics: number;
  coverage: number;
  avgDepth: number;
  avgConfidence: number;
  avgEffectiveConfidence: number;
  entries: number;
  topics: TopicDetail[];
  gaps: string[];
  consistencyScore: { overall: number; prerequisitesFilled: number; contradictionFree: number; connectionDensity: number; chunkRate: number; operationBreadth: number };
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

// GET: 知識マップの詳細データを取得 (Brain Model)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const examId = url.searchParams.get("examId");
  if (!examId) return Response.json({ entries: [], stats: {} });

  const exam = getExamById(examId);
  if (!exam) return Response.json({ entries: [], stats: {} });

  // core_knowledgeから全カラム取得
  const { data: entries } = await supabase
    .from("core_knowledge")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });

  const knowledgeEntries: CoreKnowledgeRow[] = (entries || []).map(e => ({
    ...e,
    operation_evidence: e.operation_evidence || { recognized: false, reproduced: false, explained: false, applied: false, integrated: false },
    connection_strengths: e.connection_strengths || {},
    retrieval_contexts: e.retrieval_contexts || [],
    stability: e.stability || 3.0,
    retrieval_count: e.retrieval_count || 0,
    retrieval_success_count: e.retrieval_success_count || 0,
    retrieval_fail_count: e.retrieval_fail_count || 0,
    interference_count: e.interference_count || 0,
    rag_verification_status: e.rag_verification_status || "unverified",
  }));

  // knowledge_chunksを取得
  const { data: chunks } = await supabase
    .from("knowledge_chunks")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId);

  const knowledgeChunks = chunks || [];

  // confidence校正 (practice結果との照合)
  await calibrateConfidence(supabase, user.id, examId, knowledgeEntries).catch((err: unknown) => console.error("calibration error:", err));

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
    const subjectEntries = knowledgeEntries.filter(e => e.subject === examSubject.name);
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
          avgEffectiveConfidence: 0,
          sources: { correct: 0, verified: 0 },
          connections: [],
          lastTaught: entry.last_taught_at || entry.created_at,
          teachCount: 0,
          hasMistakes: false,
          retentionStatus: "fresh",
          needsReview: false,
          operationLevel: "none",
          ragStatus: "unverified",
        };
        topicMap.set(topicName, detail);
      }

      const effectiveConf = calcEffectiveConfidence(entry, knowledgeEntries);
      const lastReinforced = laterDate(entry.last_taught_at, entry.last_retrieved_at);
      const retention = calcRetention(lastReinforced, entry.stability);

      detail.entries++;
      detail.maxDepth = Math.max(detail.maxDepth, entry.understanding_depth || 1);
      detail.avgConfidence += entry.confidence || 0.5;
      detail.avgEffectiveConfidence += effectiveConf;
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

      // 最悪のretentionStatusを取る
      const status = getRetentionStatus(retention);
      const statusOrder = { forgotten: 0, stale: 1, fading: 2, fresh: 3 };
      if (statusOrder[status] < statusOrder[detail.retentionStatus as keyof typeof statusOrder]) {
        detail.retentionStatus = status;
      }

      if (effectiveConf < 0.5 && entry.confidence > 0.7) {
        detail.needsReview = true;
      }

      const opLevel = getOperationLevel(entry.operation_evidence);
      const opOrder = { none: 0, recognized: 1, reproduced: 2, explained: 3, applied: 4, integrated: 5 };
      if (opOrder[opLevel as keyof typeof opOrder] > opOrder[detail.operationLevel as keyof typeof opOrder]) {
        detail.operationLevel = opLevel;
      }

      if (entry.rag_verification_status !== "unverified") {
        detail.ragStatus = entry.rag_verification_status;
      }
    }

    for (const detail of topicMap.values()) {
      if (detail.entries > 0) {
        detail.avgConfidence /= detail.entries;
        detail.avgEffectiveConfidence /= detail.entries;
      }
    }

    const topics = Array.from(topicMap.values()).sort((a, b) => {
      // 要復習を先に、次にretentionStatusでソート
      if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
      return b.maxDepth - a.maxDepth;
    });

    const coveredTopicNames = new Set(topics.map(t => t.topic));
    const gaps = examSubject.topics.filter(t => !coveredTopicNames.has(t));

    const totalTopics = examSubject.topics.length;
    const coveredTopics = totalTopics - gaps.length;
    const coverage = totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;

    const allDepths = subjectEntries.map(e => e.understanding_depth || 1);
    const avgDepth = allDepths.length > 0
      ? Math.round(allDepths.reduce((a, b) => a + b, 0) / allDepths.length * 10) / 10
      : 0;

    const avgConfidence = subjectEntries.length > 0
      ? Math.round(subjectEntries.reduce((s, e) => s + (e.confidence || 0.5), 0) / subjectEntries.length * 100) / 100
      : 0;

    const avgEffectiveConfidence = subjectEntries.length > 0
      ? Math.round(subjectEntries.reduce((s, e) => s + calcEffectiveConfidence(e, knowledgeEntries), 0) / subjectEntries.length * 100) / 100
      : 0;

    const consistencyScore = calcConsistencyScore(examSubject.name, knowledgeEntries, knowledgeChunks);

    return {
      subject: examSubject.name,
      totalTopics,
      coveredTopics,
      coverage,
      avgDepth,
      avgConfidence,
      avgEffectiveConfidence,
      entries: subjectEntries.length,
      topics,
      gaps,
      consistencyScore,
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

  // 要復習の知識
  const needsReview = knowledgeEntries
    .filter(e => {
      const ec = calcEffectiveConfidence(e, knowledgeEntries);
      return ec < 0.5 && e.confidence > 0.7;
    })
    .map(e => ({
      id: e.id,
      subject: e.subject,
      topic: e.topic,
      storedConfidence: Math.round(e.confidence * 100),
      effectiveConfidence: Math.round(calcEffectiveConfidence(e, knowledgeEntries) * 100),
      retentionStatus: getRetentionStatus(calcRetention(laterDate(e.last_taught_at, e.last_retrieved_at), e.stability)),
      lastTaught: e.last_taught_at,
    }))
    .sort((a, b) => a.effectiveConfidence - b.effectiveConfidence)
    .slice(0, 10);

  // チャンキング機会の検出
  const chunkOpportunities = detectChunkingOpportunities(knowledgeEntries).map(c => ({
    subject: c.subject,
    suggestedLabel: c.suggestedLabel,
    entryCount: c.entries.length,
    entryIds: c.entries.map(e => e.id),
  }));

  // 復習スケジュール生成
  const reviewSchedule = buildReviewSchedule(knowledgeEntries, knowledgeEntries)
    .slice(0, 15)
    .map(r => ({
      id: r.id,
      subject: r.subject,
      topic: r.topic,
      content: r.content,
      currentRetention: Math.round(r.currentRetention * 100),
      retentionStatus: r.retentionStatus,
      effectiveConfidence: Math.round(r.effectiveConfidence * 100),
      reviewAt: r.reviewAt.toISOString(),
      overdueDays: Math.round(r.overdueDays * 10) / 10,
      priority: Math.round(r.priority * 10) / 10,
    }));

  // 洞察エンジン: 隠れた接続、矛盾、パターン、脆弱点を発見
  const insights = discoverInsights(knowledgeEntries).slice(0, 8).map(i => ({
    type: i.type,
    severity: i.severity,
    title: i.title,
    description: i.description,
    subjects: i.subjects,
  }));

  // 落とし穴予測: 試験で引っかかりそうな知識を予測
  const traps = predictTraps(knowledgeEntries).map(t => ({
    topic: t.topic,
    subject: t.subject,
    trapType: t.trapType,
    confidence: Math.round(t.confidence * 100),
    description: t.description,
  }));

  // インターリーブ推奨（最近学んだ科目から離れたトピックを提案）
  const recentSubjects = knowledgeEntries.slice(0, 5).map(e => e.subject);
  const lastEntry = knowledgeEntries[0];
  const interleaveRecs = lastEntry
    ? getInterleaveRecommendations(
        lastEntry.subject,
        lastEntry.topic,
        knowledgeEntries,
        recentSubjects
      ).map(r => ({
        subject: r.subject,
        topic: r.topic,
        reason: r.reason,
        effectiveConfidence: Math.round(r.effectiveConfidence * 100),
        retentionStatus: r.retentionStatus,
      }))
    : [];

  // プロアクティブ報告: 連鎖崩壊シミュレーション + 反実仮想テスト
  const proactiveReport = generateProactiveReport(knowledgeEntries);

  // 依存グラフデータ（ビジュアライゼーション用）
  const cascadeResults = proactiveReport.cascadeWarnings;
  const collapsingIds = new Set(cascadeResults.flatMap(c => [c.root.id, ...c.casualties.map(cas => cas.id)]));

  const graphNodes = knowledgeEntries.slice(0, 100).map(e => {
    const lastReinforced = laterDate(e.last_taught_at, e.last_retrieved_at);
    const retention = calcRetention(lastReinforced, e.stability);
    const ec = calcEffectiveConfidence(e, knowledgeEntries);
    const retStatus = getRetentionStatus(retention);
    const isCollapsing = collapsingIds.has(e.id);
    const cascadeRoot = cascadeResults.find(c => c.root.id === e.id);

    return {
      id: e.id,
      topic: e.topic || e.subject,
      subject: e.subject,
      effectiveConfidence: Math.round(ec * 100),
      retention: Math.round(retention * 100),
      retentionStatus: retStatus,
      depth: e.understanding_depth,
      isCollapsing,
      isCascadeRoot: !!cascadeRoot,
      casualtyCount: cascadeRoot?.casualties.length || 0,
    };
  });

  const graphEdges: { source: string; target: string; type: string; strength: number }[] = [];
  const nodeIds = new Set(graphNodes.map(n => n.id));
  for (const entry of knowledgeEntries.slice(0, 100)) {
    // prerequisite_ids
    if (entry.prerequisite_ids) {
      for (const prereqId of entry.prerequisite_ids) {
        if (nodeIds.has(prereqId)) {
          graphEdges.push({ source: prereqId, target: entry.id, type: "depends_on", strength: 1.0 });
        }
      }
    }
    // connection_strengths
    for (const [targetId, conn] of Object.entries(entry.connection_strengths)) {
      if (nodeIds.has(targetId) && conn.strength > 0.3) {
        graphEdges.push({ source: entry.id, target: targetId, type: conn.type, strength: conn.strength });
      }
    }
  }

  // 最近のCore蓄積（タイムライン用）
  const recentEntries = knowledgeEntries.slice(0, 20).map(e => ({
    subject: e.subject,
    topic: e.topic,
    content: e.content.slice(0, 100),
    source: e.source,
    depth: e.understanding_depth,
    confidence: e.confidence,
    effectiveConfidence: Math.round(calcEffectiveConfidence(e, knowledgeEntries) * 100),
    retentionStatus: getRetentionStatus(calcRetention(laterDate(e.last_taught_at, e.last_retrieved_at), e.stability)),
    operationLevel: getOperationLevel(e.operation_evidence),
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
      needsReview,
      reviewSchedule,
      insights,
      traps,
      interleaveRecs,
      chunkOpportunities,
      chunks: knowledgeChunks,
      proactiveReport: {
        summary: proactiveReport.summary,
        cascadeWarnings: proactiveReport.cascadeWarnings.map(c => ({
          rootTopic: c.root.topic || c.root.subject,
          rootRetention: Math.round(c.root.currentRetention * 100),
          casualtyCount: c.casualties.length,
          casualties: c.casualties.slice(0, 5).map(cas => ({
            topic: cas.topic || cas.subject,
            depth: cas.depth,
            effectiveConfidence: Math.round(cas.effectiveConfidence * 100),
          })),
          deadline: c.deadline?.toISOString() || null,
          severity: Math.round(c.severity * 100),
          warning: c.warning,
        })),
        counterfactualAlerts: proactiveReport.counterfactualAlerts.map(cf => ({
          targetTopic: cf.target.topic || cf.target.subject,
          targetConfidence: Math.round(cf.target.confidence * 100),
          impactedCount: cf.impacted.length,
          impacted: cf.impacted.slice(0, 5).map(i => ({
            topic: i.topic || i.subject,
            relationType: i.relationType,
            currentEC: Math.round(i.currentEC * 100),
            projectedEC: Math.round(i.projectedEC * 100),
          })),
          vulnerabilityScore: Math.round(cf.vulnerabilityScore * 100),
          report: cf.report,
        })),
        generatedAt: proactiveReport.generatedAt,
      },
      knowledgeGraph: {
        nodes: graphNodes,
        edges: graphEdges,
      },
    },
  });
}

// POST: Coreに質問する (再構成エンジン)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const limited = checkRateLimit(user.id, "core:post", RATE_LIMITS.ai);
  if (limited) return limited;

  const { examId, question } = await request.json();
  if (!examId || !question) return Response.json({ error: "入力が不正です" }, { status: 400 });

  // 全Core知識を取得 (再構成エンジン用)
  const { data: allEntriesRaw } = await supabase
    .from("core_knowledge")
    .select("*")
    .eq("user_id", user.id)
    .eq("exam_id", examId);

  const allEntries: CoreKnowledgeRow[] = (allEntriesRaw || []).map(e => ({
    ...e,
    operation_evidence: e.operation_evidence || { recognized: false, reproduced: false, explained: false, applied: false, integrated: false },
    connection_strengths: e.connection_strengths || {},
    retrieval_contexts: e.retrieval_contexts || [],
    stability: e.stability || 3.0,
    retrieval_count: e.retrieval_count || 0,
    retrieval_success_count: e.retrieval_success_count || 0,
    retrieval_fail_count: e.retrieval_fail_count || 0,
    interference_count: e.interference_count || 0,
    rag_verification_status: e.rag_verification_status || "unverified",
  }));

  if (allEntries.length === 0) {
    return Response.json({
      answer: "まだ何も学んでいません。Prism Teachで知識を教えてください。Coreはあなたが教えたことだけを知っています。",
      fromCore: false,
    });
  }

  // セマンティック検索でseed取得
  let semanticResults: Array<CoreKnowledgeRow & { similarity: number }> = [];
  let queryEmbedding: number[] | null = null;

  try {
    queryEmbedding = await embedQuery(question);
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await adminClient.rpc("match_core_knowledge", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_user_id: user.id,
      match_exam_id: examId,
      match_count: 15,
      match_threshold: 0.25,
    });

    if (data && data.length > 0) {
      semanticResults = data.map((r: Record<string, unknown>) => ({
        ...allEntries.find(e => e.id === r.id) || r,
        similarity: r.similarity as number,
      })) as Array<CoreKnowledgeRow & { similarity: number }>;
    }
  } catch (err) {
    console.error("semantic search error:", err);
  }

  // フォールバック: セマンティック検索失敗時は最新順
  if (semanticResults.length === 0) {
    semanticResults = allEntries
      .sort((a, b) => new Date(b.last_taught_at).getTime() - new Date(a.last_taught_at).getTime())
      .slice(0, 15)
      .map(e => ({ ...e, similarity: 0.5 }));
  }

  // 再構成エンジン
  const reconstructed = await reconstructKnowledge(
    question,
    queryEmbedding || [],
    semanticResults,
    allEntries
  );

  // 想起した知識のretrievalメタデータを更新
  const now = new Date().toISOString();
  const allRetrieved = [...reconstructed.certain, ...reconstructed.uncertain, ...reconstructed.interfered];

  // 各エントリのconnection_strengthsをメモリ上でバッチ集約
  const strengthUpdates = new Map<string, Record<string, { strength: number; type: string; co_retrieval_count: number }>>();

  // co_retrieval更新をメモリ上で集約（O(n^2)計算だがDB書き込みはO(n)回に削減）
  for (let i = 0; i < allRetrieved.length; i++) {
    for (let j = i + 1; j < allRetrieved.length; j++) {
      const a = allRetrieved[i];
      const b = allRetrieved[j];

      // a -> b
      if (!strengthUpdates.has(a.id)) {
        strengthUpdates.set(a.id, { ...(a.connection_strengths || {}) });
      }
      const aStrengths = strengthUpdates.get(a.id)!;
      if (aStrengths[b.id]) {
        aStrengths[b.id] = {
          ...aStrengths[b.id],
          co_retrieval_count: (aStrengths[b.id].co_retrieval_count || 0) + 1,
          strength: Math.min(1.0, aStrengths[b.id].strength + 0.05),
        };
      } else {
        aStrengths[b.id] = { strength: 0.3, type: "related", co_retrieval_count: 1 };
      }
    }
  }

  // バッチDB書き込み: 1エントリ1回のupdate
  for (const entry of allRetrieved) {
    const daysSince = entry.last_retrieved_at
      ? (Date.now() - new Date(entry.last_retrieved_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    const newStability = updateStability(entry.stability, true, daysSince);
    const newContexts = [
      ...(entry.retrieval_contexts || []),
      { context: question.slice(0, 200), at: now, embedding: queryEmbedding },
    ].slice(-20);

    const updatePayload: Record<string, unknown> = {
      retrieval_count: (entry.retrieval_count || 0) + 1,
      last_retrieved_at: now,
      stability: newStability,
      retrieval_contexts: newContexts,
      retrieval_success_count: (entry.retrieval_success_count || 0) + 1,
    };

    // connection_strengthsの更新があれば一緒にバッチ
    if (strengthUpdates.has(entry.id)) {
      updatePayload.connection_strengths = strengthUpdates.get(entry.id);
    }

    supabase.from("core_knowledge").update(updatePayload)
      .eq("id", entry.id)
      .then(() => {}, (err: unknown) => console.error("retrieval update error:", err));
  }

  // Coreの人格プロンプトを生成（洞察・落とし穴予測・ネットワーク情報を含む）
  const systemPrompt = buildCorePersonalityPrompt(reconstructed, allEntries);

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
        // 生成的再構成: 回答を記録し、過去の再構成との差分を検出
        const reconstructionRecord = {
          query: question.slice(0, 200),
          response_summary: fullResult.slice(0, 500),
          at: now,
          topics_used: allRetrieved.map(e => e.topic).filter(Boolean).slice(0, 10),
        };

        // 関連する知識のretrieval_contextsに再構成記録を追加
        // 同じ知識が異なる文脈で呼び出されるたびに、異なる説明が生成される
        // → その差分自体が「知識の豊かさ」の指標になる
        for (const entry of allRetrieved.slice(0, 5)) {
          const existingContexts = entry.retrieval_contexts || [];
          const pastResponses = existingContexts
            .filter((ctx: { context: string }) => ctx.context !== question.slice(0, 200))
            .slice(-3);

          if (pastResponses.length > 0) {
            // 過去に異なる文脈で想起されたことがある → 再構成の多様性を記録
            const reconstructionDiversity = pastResponses.length + 1;
            supabase.from("core_knowledge").update({
              teach_count: Math.max(entry.teach_count, reconstructionDiversity),
            }).eq("id", entry.id)
              .then(() => {}, (err: unknown) => console.error("reconstruction diversity update error:", err));
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, reconstructionRecord })}\n\n`));
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
