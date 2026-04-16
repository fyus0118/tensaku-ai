import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/rag/embeddings";
import {
  calculateBaseConfidence,
  updateStability,
  calcRetroactiveInterference,
  detectContradictions,
  verifyAgainstRAG,
  type CoreKnowledgeRow,
  type OperationEvidence,
} from "@/lib/core-engine";

export type KnowledgeSource =
  | "correct" | "verified"
  | "socratic_correct" | "socratic_error"
  | "case_correct" | "case_applied"
  | "mentor_recognition" | "mentor_gap";

export interface CoreEntry {
  content: string;
  level: number;
  connections: string[];
  mistake?: string;
  correction?: string;
  reason?: string;
  source: string;
}

export interface DiagnosticEntry {
  content: string;
  mistake?: string;
  reason?: string;
}

export interface ParsedDiagnostics {
  correct: CoreEntry[];
  verified: CoreEntry[];
  caught: DiagnosticEntry[];
  missed: DiagnosticEntry[];
  errors: DiagnosticEntry[];
  gaps: DiagnosticEntry[];
  recognized: CoreEntry[];
  applied: CoreEntry[];
  maxLevel: number;
}

const TAG_REGEX = /<!--(?:CAUGHT|MISSED|ERROR|CORRECT|VERIFIED|LEVEL|GAP|RECOGNITION|APPLICATION):.*?-->/g;

export function stripHiddenTags(text: string): string {
  return text.replace(TAG_REGEX, "");
}

function parseTagJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

export function parseHiddenTags(fullResult: string): ParsedDiagnostics {
  const correct: CoreEntry[] = [];
  const verified: CoreEntry[] = [];
  const caught: DiagnosticEntry[] = [];
  const missed: DiagnosticEntry[] = [];
  const errors: DiagnosticEntry[] = [];
  const gaps: DiagnosticEntry[] = [];
  const recognized: CoreEntry[] = [];
  const applied: CoreEntry[] = [];
  let maxLevel = 1;

  for (const m of fullResult.matchAll(/<!--LEVEL:(\d)-->/g)) {
    const l = parseInt(m[1]);
    if (l > maxLevel) maxLevel = l;
  }

  for (const m of fullResult.matchAll(/<!--CORRECT:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    correct.push({
      content: (d.content as string) || m[1], level: (d.level as number) || maxLevel,
      connections: (d.connections as string[]) || [], source: "correct",
    });
  }

  for (const m of fullResult.matchAll(/<!--VERIFIED:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    verified.push({
      content: (d.content as string) || m[1], level: (d.level as number) || maxLevel,
      connections: (d.connections as string[]) || [], source: "verified",
      mistake: d.mistake as string, correction: d.correction as string,
    });
  }

  for (const m of fullResult.matchAll(/<!--CAUGHT:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    caught.push({ content: (d.content as string) || m[1] });
  }

  for (const m of fullResult.matchAll(/<!--MISSED:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    missed.push({ content: (d.content as string) || m[1] });
  }

  for (const m of fullResult.matchAll(/<!--ERROR:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    errors.push({ content: (d.content as string) || m[1], mistake: d.mistake as string, reason: d.reason as string });
  }

  for (const m of fullResult.matchAll(/<!--GAP:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    gaps.push({ content: (d.content as string) || m[1] });
  }

  for (const m of fullResult.matchAll(/<!--RECOGNITION:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    recognized.push({
      content: (d.content as string) || m[1], level: (d.level as number) || maxLevel,
      connections: (d.connections as string[]) || [], source: "mentor_recognition",
    });
  }

  for (const m of fullResult.matchAll(/<!--APPLICATION:(.*?)-->/g)) {
    const d = parseTagJson(m[1]);
    applied.push({
      content: (d.content as string) || m[1], level: (d.level as number) || maxLevel,
      connections: (d.connections as string[]) || [], source: "case_applied",
    });
  }

  return { correct, verified, caught, missed, errors, gaps, recognized, applied, maxLevel };
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

const SOURCE_CONFIDENCE_MULTIPLIER: Record<string, number> = {
  correct: 1.0,
  verified: 1.0,
  socratic_correct: 0.85,
  case_correct: 0.75,
  case_applied: 0.80,
  mentor_recognition: 0.40,
};

function getOperationUpdate(source: string): Partial<OperationEvidence> {
  switch (source) {
    case "correct": case "verified": return { explained: true, ...(source === "verified" ? { reproduced: true } : {}) };
    case "socratic_correct": return { reproduced: true };
    case "case_correct": case "case_applied": return { applied: true };
    case "mentor_recognition": return { recognized: true };
    default: return {};
  }
}

function mapSourceForDB(source: string): string {
  if (source === "socratic_correct") return "correct";
  if (source === "case_correct" || source === "case_applied") return "correct";
  if (source === "mentor_recognition") return "correct";
  return source;
}

export async function upsertCoreKnowledge(params: {
  supabase: SupabaseClient;
  userId: string;
  examId: string;
  subject: string;
  topic: string | null;
  entries: CoreEntry[];
  allExisting: CoreKnowledgeRow[];
  sessionContext: string;
}): Promise<void> {
  const { supabase, userId, examId, subject, topic, entries, allExisting, sessionContext } = params;
  const now = new Date().toISOString();

  for (const entry of entries) {
    let embedding: number[] | null = null;
    try { embedding = await embedQuery(entry.content); } catch {}

    let mistakeEmbedding: number[] | null = null;
    if (entry.source === "verified" && entry.mistake) {
      try { mistakeEmbedding = await embedQuery(entry.mistake); } catch {}
    }

    const multiplier = SOURCE_CONFIDENCE_MULTIPLIER[entry.source] || 0.5;
    const baseSource = entry.source === "verified" ? "verified" : "correct";
    const confidence = calculateBaseConfidence(baseSource, entry.level) * multiplier;

    const { data: existing } = await supabase
      .from("core_knowledge")
      .select("id, teach_count, understanding_depth, confidence, stability, last_taught_at, operation_evidence, retrieval_contexts")
      .eq("user_id", userId)
      .eq("exam_id", examId)
      .eq("subject", subject)
      .eq("topic", topic || "")
      .eq("source", mapSourceForDB(entry.source))
      .limit(1)
      .single();

    const opEvidence: OperationEvidence = existing?.operation_evidence || {
      recognized: false, reproduced: false, explained: false, applied: false, integrated: false,
    };
    Object.assign(opEvidence, getOperationUpdate(entry.source));

    const existingContexts = existing?.retrieval_contexts || [];
    const newContexts = [...existingContexts, { context: sessionContext, at: now }].slice(-20);

    if (existing) {
      if (entry.source === "mentor_recognition" && (existing.confidence || 0) > confidence) {
        await supabase.from("core_knowledge").update({
          operation_evidence: opEvidence,
          retrieval_contexts: newContexts,
          last_taught_at: now,
        }).eq("id", existing.id);
        continue;
      }
      const newDepth = Math.max(existing.understanding_depth || 1, entry.level);
      const newStability = updateStability(existing.stability || 3.0, true, daysSince(existing.last_taught_at), entry.level);

      await supabase.from("core_knowledge").update({
        content: entry.content,
        understanding_depth: newDepth,
        confidence: Math.min(1.0, Math.max(existing.confidence || 0, confidence)),
        connections: entry.connections.length > 0 ? entry.connections : undefined,
        initial_mistake: entry.mistake || undefined,
        correction_path: entry.correction || undefined,
        embedding: embedding ? JSON.stringify(embedding) : undefined,
        mistake_embedding: mistakeEmbedding ? JSON.stringify(mistakeEmbedding) : undefined,
        teach_count: (existing.teach_count || 1) + 1,
        last_taught_at: now,
        stability: newStability,
        operation_evidence: opEvidence,
        retrieval_contexts: newContexts,
      }).eq("id", existing.id);
    } else {
      await supabase.from("core_knowledge").insert({
        user_id: userId, exam_id: examId, subject, topic: topic || null,
        content: entry.content, source: mapSourceForDB(entry.source),
        understanding_depth: entry.level, confidence,
        connections: entry.connections.length > 0 ? entry.connections : null,
        initial_mistake: entry.mistake || null, correction_path: entry.correction || null,
        embedding: embedding ? JSON.stringify(embedding) : null,
        mistake_embedding: mistakeEmbedding ? JSON.stringify(mistakeEmbedding) : null,
        teach_count: 1, last_taught_at: now, stability: 3.0,
        operation_evidence: opEvidence, retrieval_contexts: newContexts,
      });
    }

    if (embedding && allExisting.length > 0) {
      const interference = calcRetroactiveInterference(embedding, allExisting);
      for (const { id, stabilityMultiplier } of interference) {
        const target = allExisting.find(e => e.id === id);
        if (target) {
          supabase.from("core_knowledge").update({
            stability: Math.max(3, (target.stability || 3) * stabilityMultiplier),
          }).eq("id", id).then(() => {});
        }
      }

      detectContradictions(entry.content, embedding, allExisting).then(result => {
        if (result.contradicts) {
          for (const conflictId of result.conflictingIds) {
            const target = allExisting.find(e => e.id === conflictId);
            supabase.from("core_knowledge").update({
              interference_count: (target?.interference_count || 0) + 1,
            }).eq("id", conflictId).then(() => {});
          }
        }
      }).catch(() => {});
    }

    if (embedding && entries.indexOf(entry) === 0) {
      const entryForRAG = { id: existing?.id || "", content: entry.content, embedding, subject } as CoreKnowledgeRow;
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
  }
}

export async function degradeCoreKnowledge(params: {
  supabase: SupabaseClient;
  userId: string;
  examId: string;
  subject: string;
  topic: string | null;
  errors: DiagnosticEntry[];
  missed: DiagnosticEntry[];
}): Promise<void> {
  const { supabase, userId, examId, subject, topic, errors, missed } = params;
  const errorCount = errors.length + missed.length;
  if (errorCount === 0) return;

  const { data: matchingCore } = await supabase
    .from("core_knowledge")
    .select("id, confidence, stability, retrieval_fail_count, interference_count")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("subject", subject)
    .eq("topic", topic || "");

  if (matchingCore && matchingCore.length > 0) {
    for (const entry of matchingCore) {
      const damageFactor = Math.max(0.4, 1 - errorCount * 0.15);
      await supabase.from("core_knowledge").update({
        confidence: Math.max(0.05, (entry.confidence || 0.5) * damageFactor),
        stability: updateStability(entry.stability || 3.0, false, Infinity, 3),
        retrieval_fail_count: (entry.retrieval_fail_count || 0) + errorCount,
        interference_count: (entry.interference_count || 0) + 1,
      }).eq("id", entry.id);
    }
  } else {
    const contents = [...errors.map(e => e.content), ...missed.map(e => e.content)].filter(Boolean);
    if (contents.length > 0) {
      await supabase.from("core_knowledge").insert({
        user_id: userId, exam_id: examId, subject, topic: topic || null,
        content: contents.join("; "), source: "verified",
        understanding_depth: 0, confidence: 0.1, stability: 0.5,
        teach_count: 1, last_taught_at: new Date().toISOString(),
        operation_evidence: { recognized: false, reproduced: false, explained: false, applied: false, integrated: false },
        retrieval_fail_count: errorCount, interference_count: 1,
      });
    }
  }
}

export const HIDDEN_TAG_INSTRUCTION_SOCRATIC = `
## ★★★ 隠しタグ（ユーザーには見えない）★★★

ユーザーが質問に回答するたびに、以下のタグをメッセージ末尾に付与:

- \`<!--CORRECT:{"content":"ユーザーが正しく答えた知識","level":理解レベル(1-6),"connections":["関連トピック"]}-->\`
  → ユーザーが自力で正しく答えた場合
- \`<!--ERROR:{"content":"間違えた内容","mistake":"何を間違えたか","reason":"なぜ間違えたか"}-->\`
  → ユーザーが間違えた場合
- \`<!--MISSED:{"content":"答えられなかった内容"}-->\`
  → ユーザーが答えられなかった、またはスキッ��した場合
- \`<!--LEVEL:現在の質問レベル(1-6)-->\`

ルール:
- ユーザーが質問に正しく答えた場合のみCORRECTを付与
- あなたが質問しただけの段階ではタグを付けない
- ユーザーが回答した後のあなたの応答にタグを付ける
`;

export const HIDDEN_TAG_INSTRUCTION_CASE_STUDY = `
## ★★★ 隠しタグ（ユーザーには見えない）★★★

ユーザーがケースを分析・判断するたびに、以下のタグをメッセージ末尾��付与:

- \`<!--CORRECT:{"content":"ユーザーが正しく分析した知識","level":理解レベル(1-6),"connections":["関連トピック"]}-->\`
  → ユーザーの分析・判断が正しかった場合
- \`<!--APPLICATION:{"content":"応用できた知識","level":理解レベル(1-6),"connections":["関連トピッ��"]}-->\`
  → ユーザーが知識を実際の場面に正しく適用できた場合（CORRECTより高い評価）
- \`<!--ERROR:{"content":"間違った分析","mistake":"何を間違えた��","reason":"なぜ間違えたか"}-->\`
  �� ユーザーの分析・判断が間違っていた場合
- \`<!--MISSED:{"content":"ユーザーが見落とした論点"}-->\`
  → ユーザーが重要な論点を見落とした場合
- \`<!--LEVEL:現��の難易度レベ��(1-6)-->\`

ルール:
- ケース提示段階ではタグを付けない
- ユーザーの判断を聴いた後にタグを付ける
- APPLICATIONはCORRECTとは別。知識を具体的場面で使えた場合に付��
`;

export const HIDDEN_TAG_INSTRUCTION_MENTOR = `
## ★★★ 隠しタグ（ユーザーには���えない）★★★

ユーザーの質問を分析し、以下のタグをメッセージ末尾に付��:

- \`<!--GAP:{"content":"ユーザーが知らなかったこと","topic":"関連トピック"}-->\`
  → ユーザーの質問から推測される知識の穴
- \`<!--RECOGNITION:{"content":"あなたが回答した知識の要約","level":難易度(1-6),"connections":["関連��ピック"]}-->\`
  → あなたが回答した内容の中核知識（ユーザーは読んだだけなので低確信度で記録される）
- \`<!--CORRECT:{"content":"ユーザーが正しく述べた知識","level":理解レベル(1-6),"connections":["関連トピ��ク"]}-->\`
  → ユーザーが「〇〇は△△ですよね？」等と正しい知識を述べた場合
- \`<!--ERROR:{"content":"間違えた内容","mistake":"何を間違えたか","reason":"なぜ間違えたか"}-->\`
  → ユーザーが誤った認識を述べた場合
- \`<!--LEVEL:回答の難易度レベル(1-6)-->\`

ルール:
- 毎回の回答にRECOGNITIONタグを1つ付与する（回答の核心部分を要約）
- GAPタグはユーザーの質問が明確な知識の穴を示している場合のみ
- ユーザーが確認質問で正しい知識を述べた場合はCORRECTとして扱う
`;
