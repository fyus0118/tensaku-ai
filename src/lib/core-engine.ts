/**
 * Core Brain Engine
 *
 * 人間の頭脳を再現するCore計算ロジック:
 * - 忘却曲線 (retention = e^(-t/stability))
 * - effective_confidence (6ファクター合成)
 * - 困難度付きstability更新
 * - 想起の再構成 (ネットワーク展開 + 文脈重み付け + 干渉チェック)
 * - 矛盾検出 / RAG照合
 * - 逆行干渉
 * - practice/flashcardフィードバック
 * - confidence校正
 * - チャンキング / 抽象度昇格
 * - 一貫性スコア
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { embedQuery, searchDocuments } from "@/lib/rag/embeddings";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface OperationEvidence {
  recognized: boolean;
  reproduced: boolean;
  explained: boolean;
  applied: boolean;
  integrated: boolean;
}

export interface ConnectionStrength {
  strength: number;
  type: "depends_on" | "related" | "contradicts" | "example_of";
  co_retrieval_count: number;
}

export interface RetrievalContext {
  context: string;
  at: string;
  embedding?: number[];
}

export interface CoreKnowledgeRow {
  id: string;
  user_id: string;
  exam_id: string;
  subject: string;
  topic: string | null;
  content: string;
  source: string;
  understanding_depth: number;
  confidence: number;
  embedding?: number[];
  connections: string[] | null;
  initial_mistake: string | null;
  correction_path: string | null;
  teach_count: number;
  last_taught_at: string;
  created_at: string;
  stability: number;
  retrieval_count: number;
  last_retrieved_at: string | null;
  retrieval_success_count: number;
  retrieval_fail_count: number;
  interference_count: number;
  mistake_embedding?: number[];
  operation_evidence: OperationEvidence;
  prerequisite_ids: string[] | null;
  connection_strengths: Record<string, ConnectionStrength>;
  retrieval_contexts: RetrievalContext[];
  rag_verified_at: string | null;
  rag_verification_status: string;
}

export interface ScoredKnowledge extends CoreKnowledgeRow {
  similarity: number;
  effectiveConfidence: number;
  retentionValue: number;
  interferenceRisk: number;
  retentionStatus: "fresh" | "fading" | "stale" | "forgotten";
}

export interface KnowledgeChunk {
  id: string;
  user_id: string;
  exam_id: string;
  subject: string;
  label: string;
  member_ids: string[];
  abstraction_level: number;
  synthesis_content: string;
  created_at: string;
}

export interface ConsistencyScore {
  overall: number;
  prerequisitesFilled: number;
  contradictionFree: number;
  connectionDensity: number;
  chunkRate: number;
  operationBreadth: number;
}

export interface ReconstructedResponse {
  certain: ScoredKnowledge[];
  uncertain: ScoredKnowledge[];
  interfered: ScoredKnowledge[];
  gaps: string[];
}

export interface RAGVerificationResult {
  status: "verified" | "minor_issue" | "contradicted" | "unverifiable";
  issue?: string;
  severity: "none" | "minor" | "major";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2a. 忘却曲線
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

export function calcRetention(lastReinforcedAt: string | null, stability: number): number {
  const days = daysSince(lastReinforcedAt);
  if (days === Infinity) return 0;
  return Math.exp(-days / Math.max(stability, 0.1));
}

export function getRetentionStatus(retention: number): "fresh" | "fading" | "stale" | "forgotten" {
  if (retention > 0.7) return "fresh";
  if (retention > 0.4) return "fading";
  if (retention > 0.15) return "stale";
  return "forgotten";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2a-b. 最適復習タイミング計算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * retention が targetRetention (デフォルト0.7) まで落ちる日時を計算する。
 * retention = e^(-t/stability) なので t = -stability * ln(targetRetention)
 */
export function calcOptimalReviewDate(
  lastReinforcedAt: string | null,
  stability: number,
  targetRetention: number = 0.7
): Date | null {
  if (!lastReinforcedAt) return null;
  const daysUntilTarget = -stability * Math.log(targetRetention);
  const reviewAt = new Date(new Date(lastReinforcedAt).getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
  return reviewAt;
}

export interface ReviewScheduleEntry {
  id: string;
  subject: string;
  topic: string | null;
  content: string;
  currentRetention: number;
  retentionStatus: string;
  effectiveConfidence: number;
  reviewAt: Date;
  overdueDays: number;
  priority: number;
}

/**
 * 復習スケジュールを生成する。
 * overdueDays > 0 なら既に復習すべき時期を過ぎている。
 * priorityが高いほど緊急。
 */
export function buildReviewSchedule(
  entries: CoreKnowledgeRow[],
  allEntries: CoreKnowledgeRow[],
): ReviewScheduleEntry[] {
  const now = Date.now();

  return entries
    .map(entry => {
      const lastReinforced = laterDate(entry.last_taught_at, entry.last_retrieved_at);
      const retention = calcRetention(lastReinforced, entry.stability);
      const ec = calcEffectiveConfidence(entry, allEntries);
      const reviewDate = calcOptimalReviewDate(lastReinforced, entry.stability);
      if (!reviewDate) return null;

      const overdueDays = (now - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
      // priority: overdue + low effective confidence = highest priority
      const priority = Math.max(0, overdueDays) * 2 + (1 - ec) * 3;

      return {
        id: entry.id,
        subject: entry.subject,
        topic: entry.topic,
        content: entry.content.slice(0, 100),
        currentRetention: retention,
        retentionStatus: getRetentionStatus(retention),
        effectiveConfidence: ec,
        reviewAt: reviewDate,
        overdueDays,
        priority,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.priority - a.priority) as ReviewScheduleEntry[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2q. 困難度付きstability更新
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function updateStability(
  currentStability: number,
  success: boolean,
  timeSinceLast: number,
  difficulty: number = 3
): number {
  const normalizedDifficulty = Math.min(1.0, Math.max(0.2, difficulty / 5));

  if (success) {
    // SM-2準拠: 倍率上限2.5、spacingBonusは控えめ
    const spacingBonus = timeSinceLast > currentStability * 0.5 ? 0.3 : 0.0;
    const difficultyMultiplier = 1.0 + normalizedDifficulty * 1.5;
    const newStability = currentStability * Math.min(2.5, difficultyMultiplier + spacingBonus);
    // 上限365日（1年以上の間隔は非現実的）
    return Math.min(365, newStability);
  } else {
    const damageMultiplier = 0.2 + normalizedDifficulty * 0.3;
    // 下限0.5日（失敗したら翌日復習すべき）
    return Math.max(0.5, currentStability * damageMultiplier);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2c. ファクター計算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// O(1)参照用のインデックス（allEntries.find O(n)を排除）
function buildEntryIndex(entries: CoreKnowledgeRow[]): Map<string, CoreKnowledgeRow> {
  const map = new Map<string, CoreKnowledgeRow>();
  for (const e of entries) map.set(e.id, e);
  return map;
}

// モジュールレベルキャッシュ（同一リクエスト内で再利用）
let _cachedIndex: Map<string, CoreKnowledgeRow> | null = null;
let _cachedEntries: CoreKnowledgeRow[] | null = null;

function getEntryIndex(allEntries: CoreKnowledgeRow[]): Map<string, CoreKnowledgeRow> {
  if (_cachedEntries === allEntries && _cachedIndex) return _cachedIndex;
  _cachedIndex = buildEntryIndex(allEntries);
  _cachedEntries = allEntries;
  return _cachedIndex;
}

export function calcConnectionFactor(
  connectionStrengths: Record<string, ConnectionStrength>,
  allEntries?: CoreKnowledgeRow[]
): number {
  const connections = Object.entries(connectionStrengths);
  if (connections.length === 0) return 0.7;

  let baseFactor: number;
  if (connections.length <= 2) baseFactor = 0.85;
  else baseFactor = 1.0;

  if (!allEntries) return baseFactor;

  const index = getEntryIndex(allEntries);
  let connHealthSum = 0;
  let connCount = 0;
  for (const [targetId, conn] of connections) {
    const target = index.get(targetId);
    if (!target) continue;

    const targetRetention = calcRetention(
      laterDate(target.last_taught_at, target.last_retrieved_at),
      target.stability
    );

    const weight = conn.type === "depends_on" ? 1.5
      : conn.type === "example_of" ? 1.2
      : conn.type === "contradicts" ? 0
      : 1.0;

    connHealthSum += targetRetention * weight;
    connCount += weight;
  }

  if (connCount === 0) return baseFactor;
  const avgConnHealth = connHealthSum / connCount;
  return baseFactor * Math.max(0.5, avgConnHealth);
}

export function calcPrerequisiteHealth(
  prerequisiteIds: string[] | null,
  allEntries: CoreKnowledgeRow[]
): number {
  if (!prerequisiteIds || prerequisiteIds.length === 0) return 1.0;

  const index = getEntryIndex(allEntries);
  const prereqs = prerequisiteIds
    .map(pid => index.get(pid))
    .filter((e): e is CoreKnowledgeRow => !!e);

  if (prereqs.length === 0) return 1.0;

  const avgEffective = prereqs.reduce((sum, e) => {
    const retention = calcRetention(
      laterDate(e.last_taught_at, e.last_retrieved_at),
      e.stability
    );
    return sum + e.confidence * retention;
  }, 0) / prereqs.length;

  if (avgEffective < 0.3) return 0.5;
  return avgEffective;
}

export function calcInterferencePenalty(
  interferenceCount: number,
  retrievalSuccessCount: number
): number {
  const penalty = interferenceCount / (retrievalSuccessCount + 1);
  return Math.min(0.3, penalty);
}

export function calcOperationMultiplier(evidence: OperationEvidence): number {
  if (evidence.integrated) return 1.0;
  if (evidence.applied) return 0.95;
  if (evidence.explained) return 0.9;
  if (evidence.reproduced) return 0.8;
  if (evidence.recognized) return 0.7;
  return 0.6;
}

export function getOperationLevel(evidence: OperationEvidence): string {
  if (evidence.integrated) return "integrated";
  if (evidence.applied) return "applied";
  if (evidence.explained) return "explained";
  if (evidence.reproduced) return "reproduced";
  if (evidence.recognized) return "recognized";
  return "none";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2b. effective_confidence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function calcEffectiveConfidence(
  entry: CoreKnowledgeRow,
  allEntries?: CoreKnowledgeRow[]
): number {
  const lastReinforced = laterDate(entry.last_taught_at, entry.last_retrieved_at);
  const retention = calcRetention(lastReinforced, entry.stability);
  const connectionFactor = calcConnectionFactor(entry.connection_strengths, allEntries);
  const prerequisiteHealth = calcPrerequisiteHealth(entry.prerequisite_ids, allEntries || []);
  const interferencePenalty = calcInterferencePenalty(entry.interference_count, entry.retrieval_success_count);
  const operationMultiplier = calcOperationMultiplier(entry.operation_evidence);

  return Math.max(0, Math.min(1,
    entry.confidence
    * retention
    * connectionFactor
    * prerequisiteHealth
    * (1 - interferencePenalty)
    * operationMultiplier
  ));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2a (original). base_confidence計算 (蓄積時の初期値)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function calculateBaseConfidence(source: "correct" | "verified", level: number): number {
  const baseConfidence = source === "verified" ? 0.85 : 0.75;
  const levelBonus = (level - 1) * 0.03;
  return Math.min(1.0, baseConfidence + levelBonus);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2e. 想起の再構成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

function expandNetwork(
  seeds: CoreKnowledgeRow[],
  allEntries: CoreKnowledgeRow[],
  maxHops: number = 2
): CoreKnowledgeRow[] {
  const index = getEntryIndex(allEntries);
  const visited = new Set<string>(seeds.map(s => s.id));
  let frontier = [...seeds];
  const result = [...seeds];

  for (let hop = 0; hop < maxHops; hop++) {
    const nextFrontier: CoreKnowledgeRow[] = [];
    for (const node of frontier) {
      const connIds = Object.keys(node.connection_strengths || {});
      for (const connId of connIds) {
        if (visited.has(connId)) continue;
        const target = index.get(connId);
        if (!target) continue;

        const conn = node.connection_strengths[connId];
        if (conn.strength < 0.3) continue;

        visited.add(connId);
        result.push(target);
        nextFrontier.push(target);
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return result;
}

// 2f. 文脈依存の想起
function applyContextWeighting(
  candidates: CoreKnowledgeRow[],
  queryEmbedding: number[],
  similarities: Map<string, number>
): ScoredKnowledge[] {
  return candidates.map(entry => {
    const baseSimilarity = similarities.get(entry.id) || 0.5;
    let contextBoost = 1.0;

    for (const ctx of entry.retrieval_contexts || []) {
      if (ctx.embedding) {
        const contextSim = cosineSimilarity(ctx.embedding, queryEmbedding);
        if (contextSim > 0.7) {
          contextBoost = Math.max(contextBoost, 1.0 + contextSim * 0.3);
        }
      }
    }

    const lastReinforced = laterDate(entry.last_taught_at, entry.last_retrieved_at);
    const retentionValue = calcRetention(lastReinforced, entry.stability);
    const effectiveConfidence = calcEffectiveConfidence(entry);

    // 2g. 干渉判定
    let interferenceRisk = 0;
    if (entry.mistake_embedding) {
      const mistakeSim = cosineSimilarity(entry.mistake_embedding, queryEmbedding);
      if (mistakeSim > 0.6) {
        interferenceRisk = mistakeSim;
      }
    }

    return {
      ...entry,
      similarity: baseSimilarity * contextBoost,
      effectiveConfidence,
      retentionValue,
      interferenceRisk,
      retentionStatus: getRetentionStatus(retentionValue),
    };
  }).sort((a, b) => b.similarity - a.similarity);
}

export async function reconstructKnowledge(
  query: string,
  queryEmbedding: number[],
  semanticResults: Array<CoreKnowledgeRow & { similarity: number }>,
  allEntries: CoreKnowledgeRow[]
): Promise<ReconstructedResponse> {
  const similarities = new Map(semanticResults.map(r => [r.id, r.similarity]));
  const seeds = semanticResults as CoreKnowledgeRow[];

  // ネットワーク展開
  const network = expandNetwork(seeds, allEntries, 2);

  // 文脈重み付け + 干渉チェック + retention適用
  const scored = applyContextWeighting(network, queryEmbedding, similarities);

  // 分類
  const certain = scored.filter(k => k.retentionValue > 0.7 && k.interferenceRisk < 0.3);
  const uncertain = scored.filter(k => k.retentionValue > 0.15 && k.retentionValue <= 0.7 && k.interferenceRisk < 0.3);
  const interfered = scored.filter(k => k.interferenceRisk >= 0.3);

  // 穴の特定: ネットワークから推定されるがCoreにないトピック
  const knownTopics = new Set(allEntries.map(e => e.topic).filter(Boolean));
  const connectionTopics = new Set<string>();
  for (const entry of network) {
    for (const conn of entry.connections || []) {
      if (!knownTopics.has(conn)) connectionTopics.add(conn);
    }
  }
  const gaps = Array.from(connectionTopics);

  return { certain, uncertain, interfered, gaps };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2h. 矛盾検出
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function detectContradictions(
  newContent: string,
  newEmbedding: number[],
  existingEntries: CoreKnowledgeRow[]
): Promise<{ contradicts: boolean; conflictingIds: string[] }> {
  // embedding類似度0.7以上の既存知識を取得
  const similar = existingEntries.filter(e => {
    if (!e.embedding) return false;
    return cosineSimilarity(newEmbedding, e.embedding) > 0.7;
  });

  if (similar.length === 0) return { contradicts: false, conflictingIds: [] };

  // Claudeに矛盾判定させる
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const existingContext = similar.map(e => `- ${e.topic}: ${e.content.slice(0, 200)}`).join("\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `新しい知識:\n${newContent.slice(0, 300)}\n\n既存の知識:\n${existingContext}\n\n矛盾していますか？JSON: {"contradicts": true/false, "conflicting_indices": [0,1,...]}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      const conflictingIds = (result.conflicting_indices || [])
        .map((i: number) => similar[i]?.id)
        .filter(Boolean);
      return { contradicts: result.contradicts, conflictingIds };
    }
  } catch (err) {
    console.error("contradiction detection error:", err);
  }

  return { contradicts: false, conflictingIds: [] };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2j. 逆行干渉
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function calcRetroactiveInterference(
  newEmbedding: number[],
  existingEntries: CoreKnowledgeRow[]
): { id: string; stabilityMultiplier: number }[] {
  const results: { id: string; stabilityMultiplier: number }[] = [];

  for (const entry of existingEntries) {
    if (!entry.embedding) continue;
    const sim = cosineSimilarity(newEmbedding, entry.embedding);

    // 中程度の類似度(0.4-0.7)が最も干渉する
    if (sim > 0.4 && sim < 0.7) {
      const retention = calcRetention(
        laterDate(entry.last_taught_at, entry.last_retrieved_at),
        entry.stability
      );
      // すでに薄れている知識ほど干渉の影響を受けやすい
      const penalty = 0.05 + (0.1 * (1 - retention));
      results.push({
        id: entry.id,
        stabilityMultiplier: 1 - penalty,
      });
    }
  }

  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2i. 関連知識プローブ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function selectRelatedProbeTargets(
  connections: string[],
  allEntries: CoreKnowledgeRow[],
  maxTargets: number = 3
): CoreKnowledgeRow[] {
  if (!connections || connections.length === 0) return [];

  const candidates = allEntries.filter(e => {
    if (!e.topic) return false;
    if (!connections.includes(e.topic)) return false;
    const ec = calcEffectiveConfidence(e);
    return ec > 0.15 && ec < 0.7; // fading/stale range
  });

  return candidates
    .sort((a, b) => calcEffectiveConfidence(a) - calcEffectiveConfidence(b))
    .slice(0, maxTargets);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2k. practice/flashcardフィードバック
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function feedbackFromPractice(
  supabase: SupabaseClient,
  userId: string,
  examId: string,
  subject: string,
  topic: string,
  isCorrect: boolean,
  difficulty: number,
  questionType: "practice" | "flashcard"
): Promise<void> {
  const { data: entries } = await supabase
    .from("core_knowledge")
    .select("id, stability, retrieval_count, last_retrieved_at, retrieval_success_count, retrieval_fail_count, interference_count, operation_evidence")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("subject", subject)
    .eq("topic", topic);

  if (!entries || entries.length === 0) return;

  const now = new Date().toISOString();

  for (const entry of entries) {
    const timeSince = daysSince(entry.last_retrieved_at);
    const opEvidence: OperationEvidence = entry.operation_evidence || {
      recognized: false, reproduced: false, explained: false, applied: false, integrated: false,
    };

    if (isCorrect) {
      const newStability = updateStability(entry.stability, true, timeSince, difficulty);

      if (questionType === "flashcard") opEvidence.recognized = true;
      else opEvidence.applied = true;

      await supabase.from("core_knowledge").update({
        retrieval_count: (entry.retrieval_count || 0) + 1,
        retrieval_success_count: (entry.retrieval_success_count || 0) + 1,
        last_retrieved_at: now,
        stability: newStability,
        operation_evidence: opEvidence,
      }).eq("id", entry.id);
    } else {
      const newStability = updateStability(entry.stability, false, timeSince, difficulty);

      await supabase.from("core_knowledge").update({
        retrieval_count: (entry.retrieval_count || 0) + 1,
        retrieval_fail_count: (entry.retrieval_fail_count || 0) + 1,
        interference_count: (entry.interference_count || 0) + 1,
        last_retrieved_at: now,
        stability: newStability,
      }).eq("id", entry.id);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2l. confidence校正
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function calibrateConfidence(
  supabase: SupabaseClient,
  userId: string,
  examId: string,
  allEntries: CoreKnowledgeRow[]
): Promise<{ adjusted: number }> {
  // practice_resultsから科目・トピック別の正解率を取得
  const { data: results } = await supabase
    .from("practice_results")
    .select("subject, topic, is_correct")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!results || results.length < 10) return { adjusted: 0 };

  // トピック別の正解率を計算
  const topicAccuracy = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    const key = `${r.subject}::${r.topic}`;
    const acc = topicAccuracy.get(key) || { correct: 0, total: 0 };
    acc.total++;
    if (r.is_correct) acc.correct++;
    topicAccuracy.set(key, acc);
  }

  let adjusted = 0;

  for (const [key, acc] of topicAccuracy) {
    if (acc.total < 3) continue; // 最低3問必要

    const [subject, topic] = key.split("::");
    const accuracy = acc.correct / acc.total;

    const coreEntries = allEntries.filter(e =>
      e.subject === subject && e.topic === topic
    );
    if (coreEntries.length === 0) continue;

    const avgEffective = coreEntries.reduce((sum, e) =>
      sum + calcEffectiveConfidence(e), 0
    ) / coreEntries.length;

    if (avgEffective === 0) continue;
    const ratio = accuracy / avgEffective;

    if (ratio < 0.7) {
      // 過信: 正解率低いのにconfidence高い
      for (const entry of coreEntries) {
        await supabase.from("core_knowledge").update({
          confidence: Math.max(0.1, entry.confidence * 0.85),
          operation_evidence: { ...entry.operation_evidence, applied: false },
        }).eq("id", entry.id);
        entry.confidence *= 0.85;
        adjusted++;
      }
    } else if (ratio > 1.3) {
      // 過小評価: 正解率高いのにconfidence低い
      for (const entry of coreEntries) {
        await supabase.from("core_knowledge").update({
          confidence: Math.min(1.0, entry.confidence * 1.1),
        }).eq("id", entry.id);
        entry.confidence = Math.min(1.0, entry.confidence * 1.1);
        adjusted++;
      }
    }
  }

  return { adjusted };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2m. チャンキング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ChunkCandidate {
  subject: string;
  entries: CoreKnowledgeRow[];
  suggestedLabel: string;
}

export function detectChunkingOpportunities(
  allEntries: CoreKnowledgeRow[]
): ChunkCandidate[] {
  // 相互接続クラスタを検出
  const candidates: ChunkCandidate[] = [];
  const visited = new Set<string>();

  for (const entry of allEntries) {
    if (visited.has(entry.id)) continue;
    if (calcEffectiveConfidence(entry) < 0.7) continue;
    if (!entry.operation_evidence.explained) continue;

    // BFSで接続クラスタを構築
    const cluster: CoreKnowledgeRow[] = [entry];
    const queue = [entry];
    visited.add(entry.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const connId of Object.keys(current.connection_strengths || {})) {
        if (visited.has(connId)) continue;
        const target = allEntries.find(e => e.id === connId);
        if (!target) continue;
        if (calcEffectiveConfidence(target) < 0.7) continue;
        if (!target.operation_evidence.explained) continue;
        if (target.subject !== entry.subject) continue;

        visited.add(connId);
        cluster.push(target);
        queue.push(target);
      }
    }

    if (cluster.length >= 3) {
      const topics = cluster.map(e => e.topic).filter(Boolean);
      candidates.push({
        subject: entry.subject,
        entries: cluster,
        suggestedLabel: topics.join(" + "),
      });
    }
  }

  return candidates;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2n. 抽象度昇格
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AbstractionUpgrade {
  topic: string;
  contexts: string[];
  entryIds: string[];
}

export function detectAbstractionUpgrade(
  newEntry: CoreKnowledgeRow,
  allEntries: CoreKnowledgeRow[]
): AbstractionUpgrade | null {
  if (!newEntry.topic) return null;

  const crossSubject = allEntries.filter(e =>
    e.topic === newEntry.topic
    && e.subject !== newEntry.subject
    && calcEffectiveConfidence(e) > 0.6
  );

  if (crossSubject.length === 0) return null;

  return {
    topic: newEntry.topic,
    contexts: [newEntry.subject, ...crossSubject.map(e => e.subject)],
    entryIds: [newEntry.id, ...crossSubject.map(e => e.id)],
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2m-b. チャンキング実行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function executeChunking(
  supabase: SupabaseClient,
  userId: string,
  examId: string,
  candidate: ChunkCandidate,
): Promise<{ chunkId: string } | null> {
  const memberIds = candidate.entries.map(e => e.id).sort();

  // 重複チェック: 同じメンバーを含む既存チャンクがあればスキップ
  const { data: existingChunks } = await supabase.from("knowledge_chunks")
    .select("id, member_ids")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("subject", candidate.subject);

  if (existingChunks) {
    for (const chunk of existingChunks) {
      const existingIds = (chunk.member_ids as string[]).sort();
      // 既存チャンクと70%以上メンバーが重複していたらスキップ
      const overlap = memberIds.filter(id => existingIds.includes(id)).length;
      const overlapRate = overlap / Math.max(memberIds.length, existingIds.length);
      if (overlapRate >= 0.7) return null;
    }
  }

  const synthesisContent = candidate.entries
    .map(e => `[${e.topic || e.subject}] ${e.content.slice(0, 200)}`)
    .join("\n");

  const embedding = await embedQuery(synthesisContent).catch(() => null);

  const { data, error } = await supabase.from("knowledge_chunks").insert({
    user_id: userId,
    exam_id: examId,
    subject: candidate.subject,
    label: candidate.suggestedLabel,
    member_ids: memberIds,
    abstraction_level: 2,
    synthesis_content: synthesisContent,
    embedding,
  }).select("id").single();

  if (error || !data) return null;

  // メンバー知識の operation_evidence.integrated を true に設定
  for (const entry of candidate.entries) {
    const newEvidence = { ...entry.operation_evidence, integrated: true };
    await supabase.from("core_knowledge").update({
      operation_evidence: newEvidence,
    }).eq("id", entry.id);
  }

  return { chunkId: data.id };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2n-b. 抽象度昇格実行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function executeAbstractionUpgrade(
  supabase: SupabaseClient,
  userId: string,
  examId: string,
  upgrade: AbstractionUpgrade,
  sourceEntries: CoreKnowledgeRow[],
): Promise<{ abstractEntryId: string; principle: string } | null> {
  const relevantEntries = sourceEntries.filter(e => upgrade.entryIds.includes(e.id));
  if (relevantEntries.length < 2) return null;

  // 既に同じトピックの抽象化エントリがあればスキップ
  const { data: existing } = await supabase.from("core_knowledge")
    .select("id")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("topic", upgrade.topic)
    .eq("source", "abstracted")
    .limit(1);

  if (existing && existing.length > 0) return null;

  // Claudeで上位原則を生成
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const entriesContext = relevantEntries.map(e =>
    `[${e.subject} > ${e.topic}] ${e.content.slice(0, 300)}`
  ).join("\n\n");

  let principle: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `以下の知識は異なる科目で同じトピック「${upgrade.topic}」について述べています。\n\n${entriesContext}\n\nこれらに共通する汎用的な原則・概念を1-2文で抽出してください。具体的な科目名は含めず、抽象的な原則として書いてください。`,
      }],
    });
    principle = response.content[0].type === "text" ? response.content[0].text : "";
    if (!principle) return null;
  } catch {
    return null;
  }

  // 抽象化エントリを新規作成
  const embedding = await embedQuery(principle).catch(() => null);
  const { data: newEntry, error } = await supabase.from("core_knowledge").insert({
    user_id: userId,
    exam_id: examId,
    subject: upgrade.contexts.join(" / "),
    topic: upgrade.topic,
    content: principle,
    source: "abstracted",
    understanding_depth: 6,
    confidence: Math.min(...relevantEntries.map(e => e.confidence)),
    embedding,
    connections: relevantEntries.map(e => e.topic).filter(Boolean),
    prerequisite_ids: relevantEntries.map(e => e.id),
    stability: Math.min(...relevantEntries.map(e => e.stability)),
    operation_evidence: { recognized: true, reproduced: true, explained: true, applied: true, integrated: true },
    connection_strengths: Object.fromEntries(
      relevantEntries.map(e => [e.id, { strength: 0.9, type: "abstracts", co_retrieval_count: 0 }])
    ),
  }).select("id").single();

  if (error || !newEntry) return null;

  // 元エントリのunderstanding_depthを上げ、抽象エントリへの接続を追加
  for (const entry of relevantEntries) {
    const newStrengths = {
      ...(entry.connection_strengths || {}),
      [newEntry.id]: { strength: 0.9, type: "abstracted_by", co_retrieval_count: 0 },
    };
    await supabase.from("core_knowledge").update({
      understanding_depth: Math.min(6, (entry.understanding_depth || 1) + 1),
      connection_strengths: newStrengths,
    }).eq("id", entry.id);
  }

  return { abstractEntryId: newEntry.id, principle };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2r. インターリーブ推奨
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface InterleaveRecommendation {
  subject: string;
  topic: string;
  reason: string;
  effectiveConfidence: number;
  retentionStatus: string;
}

/**
 * 直近の学習トピックと異なる科目/トピックを推奨する。
 * インターリーブ効果: 交互に異なるトピックを学ぶと記憶定着率が上がる。
 */
export function getInterleaveRecommendations(
  currentSubject: string,
  currentTopic: string | null,
  allEntries: CoreKnowledgeRow[],
  recentSubjects: string[],
  maxRecommendations: number = 3,
): InterleaveRecommendation[] {
  // 最近学んだ科目を避け、異なる科目のfading/staleな知識を優先
  const candidates = allEntries
    .filter(e => {
      // 同じ科目・トピックは除外
      if (e.subject === currentSubject && e.topic === currentTopic) return false;
      return true;
    })
    .map(e => {
      const lastReinforced = laterDate(e.last_taught_at, e.last_retrieved_at);
      const retention = calcRetention(lastReinforced, e.stability);
      const ec = calcEffectiveConfidence(e, allEntries);
      const status = getRetentionStatus(retention);

      // スコアリング: 異なる科目 + fading/stale = 高スコア
      let score = 0;

      // 科目の多様性ボーナス
      if (e.subject !== currentSubject) score += 3;
      if (!recentSubjects.includes(e.subject)) score += 2;

      // 復習が有効な状態（fadingが最もインターリーブ効果が高い）
      if (status === "fading") score += 4;
      else if (status === "stale") score += 3;
      else if (status === "fresh") score += 1;
      // forgottenは復習よりも再学習が必要なので低め

      // effective_confidenceが中程度の知識が最も効果的
      if (ec > 0.4 && ec < 0.8) score += 2;

      return { entry: e, score, ec, status };
    })
    .sort((a, b) => b.score - a.score);

  // トピック重複を除いて上位N件
  const seen = new Set<string>();
  const results: InterleaveRecommendation[] = [];

  for (const c of candidates) {
    const key = `${c.entry.subject}:${c.entry.topic}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      subject: c.entry.subject,
      topic: c.entry.topic || "全般",
      reason: c.entry.subject !== currentSubject
        ? "異なる科目で交互学習"
        : "同科目の別トピックで定着強化",
      effectiveConfidence: c.ec,
      retentionStatus: c.status,
    });

    if (results.length >= maxRecommendations) break;
  }

  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2o. 一貫性スコア
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function calcConsistencyScore(
  subject: string,
  entries: CoreKnowledgeRow[],
  chunks: KnowledgeChunk[]
): ConsistencyScore {
  const subjectEntries = entries.filter(e => e.subject === subject);
  if (subjectEntries.length === 0) {
    return { overall: 0, prerequisitesFilled: 0, contradictionFree: 0, connectionDensity: 0, chunkRate: 0, operationBreadth: 0 };
  }

  // 1. 前提知識の充足率
  const prerequisitesFilled = subjectEntries.filter(e => {
    if (!e.prerequisite_ids?.length) return true;
    return e.prerequisite_ids.every(pid =>
      entries.some(other => other.id === pid && calcEffectiveConfidence(other) > 0.5)
    );
  }).length / subjectEntries.length;

  // 2. 矛盾がない率
  const contradictionFree = subjectEntries.filter(e =>
    e.interference_count === 0
  ).length / subjectEntries.length;

  // 3. 接続密度
  const avgConnections = average(subjectEntries.map(e =>
    Object.keys(e.connection_strengths || {}).length
  ));
  const connectionDensity = Math.min(1.0, avgConnections / 3);

  // 4. チャンク化率
  const subjectChunks = chunks.filter(c => c.subject === subject);
  const chunkedIds = new Set(subjectChunks.flatMap(c => c.member_ids));
  const chunkRate = subjectEntries.filter(e => chunkedIds.has(e.id)).length / subjectEntries.length;

  // 5. 運用実績の広がり
  const operationBreadth = average(subjectEntries.map(e => {
    const ev = e.operation_evidence;
    return [ev.recognized, ev.reproduced, ev.explained, ev.applied, ev.integrated]
      .filter(Boolean).length / 5;
  }));

  const overall = prerequisitesFilled * 0.25
    + contradictionFree * 0.2
    + connectionDensity * 0.2
    + chunkRate * 0.15
    + operationBreadth * 0.2;

  return { overall, prerequisitesFilled, contradictionFree, connectionDensity, chunkRate, operationBreadth };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2p. RAG照合
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function verifyAgainstRAG(
  entry: CoreKnowledgeRow,
  examId: string
): Promise<RAGVerificationResult> {
  if (!entry.embedding) {
    return { status: "unverifiable", severity: "none" };
  }

  try {
    const ragMatches = await searchDocuments({
      query: entry.content.slice(0, 500),
      examId,
      subject: entry.subject,
      limit: 5,
      similarityThreshold: 0.5,
    });

    if (!ragMatches || ragMatches.length === 0) {
      return { status: "unverifiable", severity: "none" };
    }

    const ragContext = ragMatches.map((m: { content: string }) => m.content).join("\n---\n").slice(0, 2000);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `ユーザーの知識:\n${entry.content.slice(0, 500)}\n\n公式教材:\n${ragContext}\n\n判定: この知識は公式教材と整合していますか？\nJSON: {"aligned": true, "issue": "", "severity": "none"} or {"aligned": false, "issue": "問題点", "severity": "minor" or "major"}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      if (!result.aligned) {
        return {
          status: result.severity === "major" ? "contradicted" : "minor_issue",
          issue: result.issue,
          severity: result.severity,
        };
      }
      return { status: "verified", severity: "none" };
    }
  } catch (err) {
    console.error("RAG verification error:", err);
  }

  return { status: "unverifiable", severity: "none" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function laterDate(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}
