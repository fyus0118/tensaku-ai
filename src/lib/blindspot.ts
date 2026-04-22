/**
 * 認知の死角 (blindspot) 検出
 *
 * 「知っていると思っているが、実は理解していない。しかも本人が気づいていない」を明示化する層。
 *
 * 無自覚スコア = storedConfidence - effectiveConfidence
 *   storedConf はユーザーに見えている自己申告・蓄積時のconfidence。
 *   effectiveConf は retention/prereq/interference/operation で補正した実効値。
 *   両者のギャップが「自覚と実態のズレ」。
 */

import {
  calcEffectiveConfidence,
  calcRetention,
  calcConnectionFactor,
  calcPrerequisiteHealth,
  calcInterferencePenalty,
  calcOperationMultiplier,
  getOperationLevel,
  getEntryIndex,
  type CoreKnowledgeRow,
} from "@/lib/core-engine";
import { getLexiconForExam, type BlindspotLexicon } from "@/lib/blindspot-lexicon";

export type BlindspotReasonType =
  | "prerequisite_forgotten"  // 土台が忘却
  | "low_retention"            // 記憶減衰
  | "shallow_operation"        // 認識止まり、運用できない
  | "interference"             // 過去の誤解が干渉
  | "weak_connections"         // 他知識との接続が薄い
  | "prior_mistake"            // 以前誤解した履歴
  | "unverified";              // 未照合

export interface BlindspotReason {
  type: BlindspotReasonType;
  detail: string;
  severity: number; // 0-1
}

export interface EntryBlindspot {
  entryId: string;
  subject: string;
  topic: string | null;
  contentPreview: string;
  storedConfidence: number;       // 自己申告 (0-1)
  effectiveConfidence: number;    // 実効 (0-1)
  unawarenessScore: number;       // stored - effective (0-1)
  isUnaware: boolean;              // 閾値超えの明示フラグ
  priority: number;                // 0-1, 優先度
  reasons: BlindspotReason[];
  userMessage: string;
  lastTaughtAt: string | null;
}

export interface TopicBlindspot {
  subject: string;
  topic: string;
  entryCount: number;
  avgUnawarenessScore: number;
  maxUnawarenessScore: number;
  unawareEntries: EntryBlindspot[];
  priority: number;
  summary: string;
}

export interface BlindspotReport {
  domain: string;
  lexicon: BlindspotLexicon;
  entryBlindspots: EntryBlindspot[];
  topicBlindspots: TopicBlindspot[];
  stats: {
    totalEntries: number;
    unawareCount: number;
    awareWeakCount: number; // 自覚済みだが弱い (effectiveConf低 かつ storedConf も低)
    avgUnawarenessScore: number;
  };
}

const UNAWARE_STORED_THRESHOLD = 0.7;  // 本人が「知っている」と感じている閾値
const UNAWARE_EFFECTIVE_THRESHOLD = 0.5; // 実は理解していない閾値
const UNAWARE_GAP_THRESHOLD = 0.25;      // ギャップが有意と見なす閾値

function computeReasons(
  entry: CoreKnowledgeRow,
  allEntries: CoreKnowledgeRow[]
): BlindspotReason[] {
  const reasons: BlindspotReason[] = [];

  const lastReinforced = laterDate(entry.last_taught_at, entry.last_retrieved_at);
  const retention = calcRetention(lastReinforced, entry.stability);
  const prerequisiteHealth = calcPrerequisiteHealth(entry.prerequisite_ids, allEntries);
  const interferencePenalty = calcInterferencePenalty(entry.interference_count, entry.retrieval_success_count);
  const operationMultiplier = calcOperationMultiplier(entry.operation_evidence);
  const connectionFactor = calcConnectionFactor(entry.connection_strengths, allEntries);
  const opLevel = getOperationLevel(entry.operation_evidence);

  if (prerequisiteHealth < 0.7 && entry.prerequisite_ids?.length) {
    const index = getEntryIndex(allEntries);
    const weakPrereqs = entry.prerequisite_ids
      .map(pid => index.get(pid))
      .filter((e): e is CoreKnowledgeRow => !!e)
      .filter(e => {
        const r = calcRetention(laterDate(e.last_taught_at, e.last_retrieved_at), e.stability);
        return r < 0.5;
      })
      .slice(0, 3);

    if (weakPrereqs.length > 0) {
      const names = weakPrereqs.map(e => e.topic || e.subject).join("、");
      reasons.push({
        type: "prerequisite_forgotten",
        detail: `前提となる「${names}」が薄れている`,
        severity: 1 - prerequisiteHealth,
      });
    }
  }

  if (retention < 0.4) {
    reasons.push({
      type: "low_retention",
      detail: `記憶定着度${Math.round(retention * 100)}%。このまま放置で消える`,
      severity: 1 - retention,
    });
  }

  if (operationMultiplier < 0.85) {
    const lvlMsg = opLevel === "none" || opLevel === "recognized"
      ? "見たことがあるだけで自分で説明・応用できない"
      : "応用・統合レベルに達していない";
    reasons.push({
      type: "shallow_operation",
      detail: lvlMsg,
      severity: 1 - operationMultiplier,
    });
  }

  if (interferencePenalty > 0.1) {
    reasons.push({
      type: "interference",
      detail: `以前の誤解が${entry.interference_count}回干渉している`,
      severity: interferencePenalty / 0.3,
    });
  }

  if (connectionFactor < 0.8) {
    reasons.push({
      type: "weak_connections",
      detail: "他の知識との結びつきが弱く、単独の記憶になっている",
      severity: 1 - connectionFactor,
    });
  }

  if (entry.initial_mistake) {
    reasons.push({
      type: "prior_mistake",
      detail: `以前「${entry.initial_mistake.slice(0, 40)}」と誤解した履歴がある`,
      severity: 0.6,
    });
  }

  if (entry.rag_verification_status === "unverified" && entry.confidence > 0.7) {
    reasons.push({
      type: "unverified",
      detail: "教材との照合が未完了。自信の根拠が内的評価のみ",
      severity: 0.3,
    });
  }

  return reasons.sort((a, b) => b.severity - a.severity);
}

function buildUserMessage(
  lexicon: BlindspotLexicon,
  topic: string | null,
  subject: string,
  isUnaware: boolean,
  reasons: BlindspotReason[]
): string {
  const label = topic ? `${subject} > ${topic}` : subject;
  const awareness = isUnaware ? lexicon.unawareLabel : lexicon.awareLabel;
  const topReason = reasons[0]?.detail || "複合要因";
  return `「${label}」は${awareness}が、${topReason}。この状態で${lexicon.impactVerb}危険がある。`;
}

export function computeEntryBlindspots(
  allEntries: CoreKnowledgeRow[],
  examId: string
): EntryBlindspot[] {
  const lexicon = getLexiconForExam(examId);
  const results: EntryBlindspot[] = [];

  for (const entry of allEntries) {
    const stored = entry.confidence;
    const effective = calcEffectiveConfidence(entry, allEntries);
    const gap = Math.max(0, stored - effective);

    const reasons = computeReasons(entry, allEntries);
    if (reasons.length === 0 && gap < UNAWARE_GAP_THRESHOLD) continue;

    const isUnaware =
      stored > UNAWARE_STORED_THRESHOLD &&
      effective < UNAWARE_EFFECTIVE_THRESHOLD &&
      gap > UNAWARE_GAP_THRESHOLD;

    const topSeverity = reasons[0]?.severity ?? 0;
    const priority = Math.min(1, gap * 0.6 + topSeverity * 0.4 + (isUnaware ? 0.15 : 0));

    results.push({
      entryId: entry.id,
      subject: entry.subject,
      topic: entry.topic,
      contentPreview: entry.content.slice(0, 120),
      storedConfidence: stored,
      effectiveConfidence: effective,
      unawarenessScore: gap,
      isUnaware,
      priority,
      reasons,
      userMessage: buildUserMessage(lexicon, entry.topic, entry.subject, isUnaware, reasons),
      lastTaughtAt: entry.last_taught_at,
    });
  }

  return results.sort((a, b) => b.priority - a.priority);
}

export function aggregateToTopicBlindspots(
  entryBlindspots: EntryBlindspot[]
): TopicBlindspot[] {
  const byTopic = new Map<string, EntryBlindspot[]>();
  for (const eb of entryBlindspots) {
    const key = `${eb.subject}::${eb.topic ?? "全般"}`;
    const list = byTopic.get(key) || [];
    list.push(eb);
    byTopic.set(key, list);
  }

  const topicResults: TopicBlindspot[] = [];
  for (const [key, entries] of byTopic) {
    const [subject, topic] = key.split("::");
    const unawareOnly = entries.filter(e => e.isUnaware);
    const avgGap = entries.reduce((s, e) => s + e.unawarenessScore, 0) / entries.length;
    const maxGap = entries.reduce((m, e) => Math.max(m, e.unawarenessScore), 0);
    const avgPriority = entries.reduce((s, e) => s + e.priority, 0) / entries.length;

    const holeCount = unawareOnly.length;
    const summary = holeCount > 0
      ? `この論点内に気づいていない穴が${holeCount}箇所`
      : entries.length > 0
        ? `この論点は自覚的に弱い箇所が${entries.length}箇所`
        : "問題なし";

    topicResults.push({
      subject,
      topic,
      entryCount: entries.length,
      avgUnawarenessScore: avgGap,
      maxUnawarenessScore: maxGap,
      unawareEntries: unawareOnly,
      priority: avgPriority,
      summary,
    });
  }

  return topicResults.sort((a, b) => b.priority - a.priority);
}

export function buildBlindspotReport(
  allEntries: CoreKnowledgeRow[],
  examId: string
): BlindspotReport {
  const lexicon = getLexiconForExam(examId);
  const entryBlindspots = computeEntryBlindspots(allEntries, examId);
  const topicBlindspots = aggregateToTopicBlindspots(entryBlindspots);

  const unawareCount = entryBlindspots.filter(e => e.isUnaware).length;
  const awareWeakCount = entryBlindspots.filter(e => !e.isUnaware).length;
  const avg = entryBlindspots.length > 0
    ? entryBlindspots.reduce((s, e) => s + e.unawarenessScore, 0) / entryBlindspots.length
    : 0;

  return {
    domain: examId,
    lexicon,
    entryBlindspots: entryBlindspots.slice(0, 30),
    topicBlindspots: topicBlindspots.slice(0, 20),
    stats: {
      totalEntries: allEntries.length,
      unawareCount,
      awareWeakCount,
      avgUnawarenessScore: avg,
    },
  };
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}
