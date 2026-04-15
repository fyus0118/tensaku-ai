/**
 * Core Brain Engine — Analysis Functions
 *
 * 洞察発見・落とし穴予測・連鎖崩壊シミュレーション・反実仮想テスト・プロアクティブ報告
 * core-engine.ts から分離（Vercel Turbopack互換性のため）
 */

import {
  type CoreKnowledgeRow,
  getEntryIndex,
  calcRetention,
  calcEffectiveConfidence,
  calcOptimalReviewDate,
  laterDate,
} from "./core-engine";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 予測的崩壊シミュレーション
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CascadeCollapseResult {
  root: { id: string; topic: string | null; subject: string; currentRetention: number };
  casualties: {
    id: string;
    topic: string | null;
    subject: string;
    depth: number;
    currentRetention: number;
    effectiveConfidence: number;
  }[];
  deadline: Date | null;
  severity: number;
  warning: string;
}

export function simulateCascadeCollapse(
  allEntries: CoreKnowledgeRow[],
): CascadeCollapseResult[] {
  const index = getEntryIndex(allEntries);

  const dependents = new Map<string, CoreKnowledgeRow[]>();
  for (const entry of allEntries) {
    if (entry.prerequisite_ids) {
      for (const prereqId of entry.prerequisite_ids) {
        const list = dependents.get(prereqId) || [];
        list.push(entry);
        dependents.set(prereqId, list);
      }
    }
    for (const [targetId, conn] of Object.entries(entry.connection_strengths)) {
      if (conn.type === "depends_on") {
        const list = dependents.get(targetId) || [];
        list.push(entry);
        dependents.set(targetId, list);
      }
    }
  }

  const results: CascadeCollapseResult[] = [];

  for (const entry of allEntries) {
    const deps = dependents.get(entry.id);
    if (!deps || deps.length === 0) continue;

    const lastReinforced = laterDate(entry.last_taught_at, entry.last_retrieved_at);
    const retention = calcRetention(lastReinforced, entry.stability);

    if (retention > 0.7) continue;

    const casualties: CascadeCollapseResult["casualties"] = [];
    const visited = new Set<string>([entry.id]);
    let frontier = [{ entries: deps, depth: 1 }];

    while (frontier.length > 0) {
      const nextFrontier: typeof frontier = [];
      for (const { entries: currentEntries, depth } of frontier) {
        for (const dep of currentEntries) {
          if (visited.has(dep.id)) continue;
          visited.add(dep.id);

          const depRetention = calcRetention(
            laterDate(dep.last_taught_at, dep.last_retrieved_at),
            dep.stability
          );
          const ec = calcEffectiveConfidence(dep, allEntries);

          casualties.push({
            id: dep.id,
            topic: dep.topic,
            subject: dep.subject,
            depth,
            currentRetention: depRetention,
            effectiveConfidence: ec,
          });

          const nextDeps = dependents.get(dep.id);
          if (nextDeps && nextDeps.length > 0 && depth < 5) {
            nextFrontier.push({ entries: nextDeps, depth: depth + 1 });
          }
        }
      }
      frontier = nextFrontier;
    }

    if (casualties.length === 0) continue;

    const deadline = calcOptimalReviewDate(lastReinforced, entry.stability, 0.3);

    const maxDepth = Math.max(...casualties.map(c => c.depth));
    const severity = Math.min(1.0,
      (casualties.length / 10) * 0.4 +
      (maxDepth / 5) * 0.3 +
      (1 - retention) * 0.3
    );

    const deadlineStr = deadline
      ? `${deadline.getMonth() + 1}月${deadline.getDate()}日`
      : "不明";

    const topicNames = casualties
      .slice(0, 3)
      .map(c => c.topic || c.subject)
      .join("、");
    const moreCount = casualties.length > 3 ? `他${casualties.length - 3}個` : "";

    results.push({
      root: {
        id: entry.id,
        topic: entry.topic,
        subject: entry.subject,
        currentRetention: retention,
      },
      casualties,
      deadline,
      severity,
      warning: `「${entry.topic || entry.subject}」を忘れると${casualties.length}個の知識が巻き添えになる（${topicNames}${moreCount ? "、" + moreCount : ""}）。${deadlineStr}までに復習推奨。`,
    });
  }

  return results
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 10);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 反実仮想テスト
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CounterfactualResult {
  target: { id: string; topic: string | null; subject: string; confidence: number };
  impacted: {
    id: string;
    topic: string | null;
    subject: string;
    relationType: "depends_on" | "related" | "example_of";
    currentEC: number;
    projectedEC: number;
  }[];
  vulnerabilityScore: number;
  report: string;
}

export function runCounterfactualScan(
  allEntries: CoreKnowledgeRow[],
): CounterfactualResult[] {
  const index = getEntryIndex(allEntries);
  const results: CounterfactualResult[] = [];

  const candidates = allEntries
    .filter(e => {
      const isDependedOn = allEntries.some(other =>
        other.prerequisite_ids?.includes(e.id) ||
        Object.entries(other.connection_strengths).some(([id, c]) => id === e.id && c.type === "depends_on")
      );
      const hasHighConfidence = e.confidence > 0.7;
      return isDependedOn || (hasHighConfidence && Object.keys(e.connection_strengths).length >= 2);
    })
    .slice(0, 30);

  for (const target of candidates) {
    const impacted: CounterfactualResult["impacted"] = [];

    for (const entry of allEntries) {
      if (entry.id === target.id) continue;
      if (entry.prerequisite_ids?.includes(target.id)) {
        const ec = calcEffectiveConfidence(entry, allEntries);
        const projectedEC = ec * 0.3;
        impacted.push({
          id: entry.id, topic: entry.topic, subject: entry.subject,
          relationType: "depends_on", currentEC: ec, projectedEC,
        });
      }
    }

    for (const entry of allEntries) {
      if (entry.id === target.id) continue;
      if (impacted.some(i => i.id === entry.id)) continue;
      const conn = entry.connection_strengths[target.id];
      if (conn && (conn.type === "depends_on" || conn.type === "related")) {
        const ec = calcEffectiveConfidence(entry, allEntries);
        const factor = conn.type === "depends_on" ? 0.3 : 0.6;
        const projectedEC = ec * factor;
        impacted.push({
          id: entry.id, topic: entry.topic, subject: entry.subject,
          relationType: conn.type as "depends_on" | "related", currentEC: ec, projectedEC,
        });
      }
    }

    for (const entry of allEntries) {
      if (entry.id === target.id) continue;
      if (impacted.some(i => i.id === entry.id)) continue;
      const conn = entry.connection_strengths[target.id];
      if (conn && conn.type === "example_of") {
        const ec = calcEffectiveConfidence(entry, allEntries);
        impacted.push({
          id: entry.id, topic: entry.topic, subject: entry.subject,
          relationType: "example_of", currentEC: ec, projectedEC: ec * 0.5,
        });
      }
    }

    if (impacted.length === 0) continue;

    const avgDrop = impacted.reduce((sum, i) => sum + (i.currentEC - i.projectedEC), 0) / impacted.length;
    const vulnerabilityScore = Math.min(1.0,
      (impacted.length / 8) * 0.4 +
      target.confidence * 0.3 +
      avgDrop * 0.3
    );

    const dependsOnCount = impacted.filter(i => i.relationType === "depends_on").length;
    const topicNames = impacted.slice(0, 3).map(i => i.topic || i.subject).join("、");

    results.push({
      target: {
        id: target.id, topic: target.topic, subject: target.subject, confidence: target.confidence,
      },
      impacted,
      vulnerabilityScore,
      report: `「${target.topic || target.subject}」（確信度${Math.round(target.confidence * 100)}%）がもし間違っていたら、${impacted.length}個の知識が影響を受ける（${topicNames}）。うち${dependsOnCount}個は直接依存しており、修復不能になる可能性がある。`,
    });
  }

  return results
    .sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore)
    .slice(0, 10);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Coreプロアクティブ報告
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CoreProactiveReport {
  cascadeWarnings: CascadeCollapseResult[];
  counterfactualAlerts: CounterfactualResult[];
  generatedAt: string;
  summary: string;
}

export function generateProactiveReport(
  allEntries: CoreKnowledgeRow[],
): CoreProactiveReport {
  const cascadeWarnings = simulateCascadeCollapse(allEntries);
  const counterfactualAlerts = runCounterfactualScan(allEntries);

  const urgentCascades = cascadeWarnings.filter(c => c.severity > 0.5);
  const criticalVulns = counterfactualAlerts.filter(c => c.vulnerabilityScore > 0.6);

  let summary = "";
  if (urgentCascades.length === 0 && criticalVulns.length === 0) {
    summary = "今のところ、知識の構造に大きな問題は見つからなかった。いい感じ。";
  } else {
    const parts: string[] = [];
    if (urgentCascades.length > 0) {
      const totalCasualties = urgentCascades.reduce((sum, c) => sum + c.casualties.length, 0);
      parts.push(`${urgentCascades.length}箇所で連鎖崩壊のリスクがある（計${totalCasualties}個の知識が巻き添え）`);
    }
    if (criticalVulns.length > 0) {
      parts.push(`${criticalVulns.length}個の知識に構造的な脆弱性を発見した`);
    }
    summary = `考えてたんだけど、${parts.join("。さらに、")}。詳細を確認して。`;
  }

  return {
    cascadeWarnings,
    counterfactualAlerts,
    generatedAt: new Date().toISOString(),
    summary,
  };
}
