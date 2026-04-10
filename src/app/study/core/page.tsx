"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Send, Loader2, Brain, MessageCircle, Map,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle2,
  RefreshCw, TrendingUp, Clock, Target, ShieldCheck,
  ShieldAlert, ShieldQuestion, Layers, Activity, Zap,
  BookOpen, Shuffle, AlertTriangle, Lightbulb, Link2,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

// ── 型定義 ──

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
  consistencyScore: {
    overall: number;
    prerequisitesFilled: number;
    contradictionFree: number;
    connectionDensity: number;
    chunkRate: number;
    operationBreadth: number;
  };
}

interface DiagnosticsStat {
  totalSessions: number;
  totalCorrect: number;
  totalVerified: number;
  totalErrors: number;
  totalMissed: number;
  maxLevelReached: number;
}

interface NeedsReviewEntry {
  id: string;
  subject: string;
  topic: string | null;
  storedConfidence: number;
  effectiveConfidence: number;
  retentionStatus: string;
  lastTaught: string | null;
}

interface ChunkOpportunity {
  subject: string;
  suggestedLabel: string;
  entryCount: number;
  entryIds: string[];
}

interface RecentEntry {
  subject: string;
  topic: string | null;
  content: string;
  source: string;
  depth: number;
  confidence: number;
  effectiveConfidence: number;
  retentionStatus: string;
  operationLevel: string;
  hasMistake: boolean;
  createdAt: string;
}

interface ReviewScheduleEntry {
  id: string;
  subject: string;
  topic: string | null;
  content: string;
  currentRetention: number;
  retentionStatus: string;
  effectiveConfidence: number;
  reviewAt: string;
  overdueDays: number;
  priority: number;
}

interface InterleaveRec {
  subject: string;
  topic: string;
  reason: string;
  effectiveConfidence: number;
  retentionStatus: string;
}

interface CoreInsight {
  type: string;
  severity: string;
  title: string;
  description: string;
  subjects: string[];
}

interface TrapPrediction {
  topic: string;
  subject: string;
  trapType: string;
  confidence: number;
  description: string;
}

interface CoreStats {
  totalEntries: number;
  totalCoverage: number;
  subjects: SubjectStat[];
  diagnostics: DiagnosticsStat;
  recentEntries: RecentEntry[];
  needsReview: NeedsReviewEntry[];
  reviewSchedule: ReviewScheduleEntry[];
  insights: CoreInsight[];
  traps: TrapPrediction[];
  interleaveRecs: InterleaveRec[];
  chunkOpportunities: ChunkOpportunity[];
}

interface ChatMessage { role: "user" | "assistant"; content: string }

// ── ヘルパー ──

const levelLabels = ["", "What", "Why", "How", "What-if", "Compare", "Challenge"];

function depthColor(depth: number): string {
  if (depth >= 5) return "text-emerald-600";
  if (depth >= 3) return "text-amber-600";
  return "text-red-500";
}

function depthBg(depth: number): string {
  if (depth >= 5) return "bg-emerald-500";
  if (depth >= 3) return "bg-amber-500";
  return "bg-red-500";
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return "確実";
  if (c >= 0.7) return "理解";
  if (c >= 0.5) return "曖昧";
  return "不安";
}

function retentionColor(status: string): string {
  switch (status) {
    case "fresh": return "text-emerald-600";
    case "fading": return "text-amber-500";
    case "stale": return "text-orange-500";
    case "forgotten": return "text-red-500";
    default: return "text-gray-400";
  }
}

function retentionBg(status: string): string {
  switch (status) {
    case "fresh": return "bg-emerald-500";
    case "fading": return "bg-amber-400";
    case "stale": return "bg-orange-500";
    case "forgotten": return "bg-red-500";
    default: return "bg-gray-300";
  }
}

function retentionLabel(status: string): string {
  switch (status) {
    case "fresh": return "定着";
    case "fading": return "薄れ中";
    case "stale": return "要復習";
    case "forgotten": return "忘却";
    default: return "";
  }
}

function retentionWidth(status: string): string {
  switch (status) {
    case "fresh": return "100%";
    case "fading": return "60%";
    case "stale": return "30%";
    case "forgotten": return "10%";
    default: return "0%";
  }
}

const operationLabels: Record<string, string> = {
  none: "",
  recognized: "認識",
  reproduced: "再生",
  explained: "説明",
  applied: "応用",
  integrated: "統合",
};

function operationBadgeColor(level: string): string {
  switch (level) {
    case "integrated": return "bg-purple-100 text-purple-700";
    case "applied": return "bg-blue-100 text-blue-700";
    case "explained": return "bg-emerald-100 text-emerald-700";
    case "reproduced": return "bg-amber-100 text-amber-700";
    case "recognized": return "bg-gray-100 text-gray-600";
    default: return "";
  }
}

function ragBadge(status: string) {
  switch (status) {
    case "verified": return { icon: ShieldCheck, className: "text-emerald-600", label: "RAG検証済" };
    case "contradicted": return { icon: ShieldAlert, className: "text-red-500", label: "RAG矛盾" };
    default: return { icon: ShieldQuestion, className: "text-gray-400", label: "" };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return `${Math.floor(days / 7)}週間前`;
}

// ── メインコンポーネント ──

export default function CorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>}>
      <CoreContent />
    </Suspense>
  );
}

function CoreContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [tab, setTab] = useState<"map" | "ask">("map");
  const [stats, setStats] = useState<CoreStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Ask Core
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!examId) return;
    fetch(`/api/core?examId=${examId}`)
      .then(r => r.json())
      .then(data => setStats(data.stats))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [examId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, question: q }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) { fullText += data.text; setStreamingText(fullText); }
                if (data.done) {
                  setMessages(prev => [...prev, { role: "assistant", content: fullText }]);
                  setStreamingText("");
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "エラーが発生しました" }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  if (!exam) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)] mb-4">試験が選択されていません</p>
        <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">ダッシュボードに戻る</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen flex flex-col">
      {/* ヘッダー */}
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--color-accent)]" />
              <h1 className="text-lg font-bold">
                Core
                <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">{exam.name}</span>
              </h1>
            </div>
          </div>
          <div className="flex rounded-lg bg-[var(--color-bg-secondary)] p-0.5">
            <button onClick={() => setTab("map")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === "map" ? "bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)]"
              }`}>
              <Map className="w-3.5 h-3.5" />知識マップ
            </button>
            <button onClick={() => setTab("ask")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === "ask" ? "bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)]"
              }`}>
              <MessageCircle className="w-3.5 h-3.5" />Coreに聞く
            </button>
          </div>
        </div>
      </header>

      {/* 知識マップ */}
      {tab === "map" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {loadingStats ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : !stats || stats.totalEntries === 0 ? (
              <EmptyCore examId={examId} />
            ) : (
              <>
                {/* 全体サマリー */}
                <OverviewSection stats={stats} />

                {/* 落とし穴予測 */}
                {stats.traps && stats.traps.length > 0 && (
                  <TrapsSection traps={stats.traps} examId={examId} />
                )}

                {/* Coreの気づき */}
                {stats.insights && stats.insights.length > 0 && (
                  <InsightsSection insights={stats.insights} />
                )}

                {/* アクションセンター（復習/インターリーブ/チャンク） */}
                <ActionCenter stats={stats} examId={examId} />

                {/* 診断サマリー */}
                <DiagnosticsSection diagnostics={stats.diagnostics} />

                {/* 科目別マップ */}
                <div className="mt-8">
                  <h2 className="text-sm font-bold text-[var(--color-text-secondary)] mb-4">科目別の知識マップ</h2>
                  <div className="space-y-3">
                    {stats.subjects.map(s => (
                      <SubjectCard key={s.subject} stat={s} examId={examId} />
                    ))}
                  </div>
                </div>

                {/* 最近の蓄積タイムライン */}
                {stats.recentEntries.length > 0 && (
                  <TimelineSection entries={stats.recentEntries} />
                )}

                <p className="text-center text-xs text-[var(--color-text-muted)] mt-10">
                  Coreの穴 = あなたの知識の穴。未学習のトピックからPrism Teachで埋めていきましょう。
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Coreに聞く */}
      {tab === "ask" && (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6">
              {messages.length === 0 && !streamingText && !loading && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-[var(--color-accent)]" />
                  </div>
                  <h2 className="text-lg font-bold mb-2">Coreに質問する</h2>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-6">
                    Coreはあなたが教えた知識だけで回答します。ChatGPTの知識は混ざりません。
                    知らないことは「まだ教わっていません」と正直に答えます。
                  </p>
                  {stats && stats.totalEntries > 0 && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      現在 {stats.totalEntries}項目の知識を保持中
                    </p>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`mb-6 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-[var(--color-accent)] text-white text-sm whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0 mt-1">
                        <Brain className="w-4 h-4 text-[var(--color-accent)]" />
                      </div>
                      <div className="chat-result text-sm flex-1 min-w-0 prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {streamingText && (
                <div className="mb-6 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0 mt-1">
                    <Brain className="w-4 h-4 text-[var(--color-accent)]" />
                  </div>
                  <div className="chat-result text-sm flex-1 min-w-0 prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  </div>
                </div>
              )}

              {loading && !streamingText && (
                <div className="mb-6 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] shrink-0">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-6 py-4">
              <div className="flex gap-3 items-end">
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                  placeholder="Coreに質問する... (Shift+Enterで改行)" rows={1}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-sm resize-none max-h-32"
                  disabled={loading} />
                <button type="submit" disabled={loading || !input.trim()}
                  className="px-4 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </main>
  );
}

// ── サブコンポーネント ──

function EmptyCore({ examId }: { examId: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
        <Brain className="w-10 h-10 text-[var(--color-accent)]" />
      </div>
      <h2 className="text-xl font-bold mb-2">Coreはまだ空です</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
        Prism Teachで知識を教えると、検証済みの知識がCoreに蓄積されます。
        Coreはあなたの知識の分身 — あなたが教えたことだけを知っています。
      </p>
      <Link href={`/study/teach?exam=${examId}`}
        className="inline-block py-3 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors">
        Prism Teachを始める
      </Link>
    </div>
  );
}

function OverviewSection({ stats }: { stats: CoreStats }) {
  const totalGaps = stats.subjects.reduce((sum, s) => sum + s.gaps.length, 0);
  const totalTopics = stats.subjects.reduce((sum, s) => sum + s.totalTopics, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
        <div className={`text-2xl font-black ${
          stats.totalCoverage >= 70 ? "text-emerald-600" :
          stats.totalCoverage >= 40 ? "text-amber-600" :
          "text-red-500"
        }`}>{stats.totalCoverage}%</div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">知識充足度</div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
        <div className="text-2xl font-black text-[var(--color-text)]">{stats.totalEntries}</div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">蓄積済み知識</div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
        <div className="text-2xl font-black text-red-500">{totalGaps}</div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">未学習トピック / {totalTopics}</div>
      </div>
      <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
        <div className="text-2xl font-black text-[var(--color-accent)]">
          Lv{stats.diagnostics.maxLevelReached}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">最高到達レベル</div>
      </div>
    </div>
  );
}

function DiagnosticsSection({ diagnostics }: { diagnostics: DiagnosticsStat }) {
  if (diagnostics.totalSessions === 0) return null;
  const total = diagnostics.totalCorrect + diagnostics.totalVerified + diagnostics.totalErrors + diagnostics.totalMissed;
  if (total === 0) return null;

  const correctRate = Math.round(((diagnostics.totalCorrect + diagnostics.totalVerified) / total) * 100);

  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-sm font-bold">Prism診断サマリー</h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">{diagnostics.totalSessions}セッション</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-600">{diagnostics.totalCorrect}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">正確</div>
        </div>
        <div>
          <div className="text-lg font-bold text-blue-600">{diagnostics.totalVerified}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">修正→検証</div>
        </div>
        <div>
          <div className="text-lg font-bold text-red-500">{diagnostics.totalErrors}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">間違い</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-500">{diagnostics.totalMissed}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">見逃し</div>
        </div>
      </div>
      <div className="mt-3 w-full h-2 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden flex">
        {diagnostics.totalCorrect > 0 && (
          <div className="h-full bg-emerald-500" style={{ width: `${(diagnostics.totalCorrect / total) * 100}%` }} />
        )}
        {diagnostics.totalVerified > 0 && (
          <div className="h-full bg-blue-500" style={{ width: `${(diagnostics.totalVerified / total) * 100}%` }} />
        )}
        {diagnostics.totalErrors > 0 && (
          <div className="h-full bg-red-500" style={{ width: `${(diagnostics.totalErrors / total) * 100}%` }} />
        )}
        {diagnostics.totalMissed > 0 && (
          <div className="h-full bg-amber-500" style={{ width: `${(diagnostics.totalMissed / total) * 100}%` }} />
        )}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-2 text-right">
        知識定着率 {correctRate}%
      </div>
    </div>
  );
}

function SubjectCard({ stat, examId }: { stat: SubjectStat; examId: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
      {/* 科目ヘッダー */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />}
          </div>
          <div className="text-left flex-1 min-w-0">
            <h3 className="font-bold text-sm truncate">{stat.subject}</h3>
            <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] mt-0.5">
              <span>{stat.coveredTopics}/{stat.totalTopics}トピック</span>
              <span>{stat.entries}項目</span>
              {stat.avgDepth > 0 && <span>平均Lv{stat.avgDepth}</span>}
              {stat.gaps.length > 0 && (
                <span className="text-red-500">{stat.gaps.length}個の穴</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 rounded-full bg-[var(--color-bg-secondary)]">
            <div className={`h-full rounded-full transition-all ${
              stat.coverage >= 70 ? "bg-emerald-500" :
              stat.coverage >= 40 ? "bg-amber-500" :
              stat.coverage > 0 ? "bg-red-500" :
              "bg-[var(--color-border)]"
            }`} style={{ width: `${Math.max(stat.coverage, 2)}%` }} />
          </div>
          <span className={`text-xs font-bold w-10 text-right ${
            stat.coverage >= 70 ? "text-emerald-600" :
            stat.coverage >= 40 ? "text-amber-600" :
            stat.coverage > 0 ? "text-red-500" :
            "text-[var(--color-text-muted)]"
          }`}>{stat.coverage}%</span>
        </div>
      </button>

      {/* 展開: トピック詳細 */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          {/* 一貫性メーター */}
          {stat.consistencyScore && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">知識の一貫性</span>
                <span className={`text-xs font-bold ml-auto ${
                  stat.consistencyScore.overall >= 0.7 ? "text-emerald-600" :
                  stat.consistencyScore.overall >= 0.4 ? "text-amber-600" :
                  "text-red-500"
                }`}>{Math.round(stat.consistencyScore.overall * 100)}%</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: "前提充足", value: stat.consistencyScore.prerequisitesFilled },
                  { label: "矛盾なし", value: stat.consistencyScore.contradictionFree },
                  { label: "接続密度", value: stat.consistencyScore.connectionDensity },
                  { label: "統合度", value: stat.consistencyScore.chunkRate },
                  { label: "運用幅", value: stat.consistencyScore.operationBreadth },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] mb-1">
                      <div className={`h-full rounded-full ${
                        item.value >= 0.7 ? "bg-emerald-500" :
                        item.value >= 0.4 ? "bg-amber-500" :
                        "bg-red-500"
                      }`} style={{ width: `${Math.max(item.value * 100, 3)}%` }} />
                    </div>
                    <span className="text-[8px] text-[var(--color-text-muted)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 学習済みトピック */}
          {stat.topics.length > 0 && (
            <div className="space-y-2 mb-3">
              {stat.topics.map(t => (
                <div key={t.topic} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[var(--color-bg-secondary)]/50 ${
                  t.needsReview ? "ring-1 ring-orange-300" : ""
                }`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${
                    t.retentionStatus === "forgotten" ? "text-red-400" :
                    t.retentionStatus === "stale" ? "text-orange-400" :
                    "text-emerald-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium truncate">{t.topic}</span>
                      {t.needsReview && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />要復習
                        </span>
                      )}
                      {t.operationLevel && t.operationLevel !== "none" && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${operationBadgeColor(t.operationLevel)}`}>
                          {operationLabels[t.operationLevel]}
                        </span>
                      )}
                      {t.hasMistakes && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">修正済</span>
                      )}
                      {t.ragStatus !== "unverified" && (() => {
                        const badge = ragBadge(t.ragStatus);
                        return (
                          <span className={`text-[9px] flex items-center gap-0.5 ${badge.className}`}>
                            <badge.icon className="w-2.5 h-2.5" />{badge.label}
                          </span>
                        );
                      })()}
                      {t.teachCount > 1 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-0.5">
                          <RefreshCw className="w-2.5 h-2.5" />{t.teachCount}回
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-[var(--color-text-muted)] mt-0.5">
                      <span className={depthColor(t.maxDepth)}>Lv{t.maxDepth} {levelLabels[t.maxDepth] || ""}</span>
                      <span>{confidenceLabel(t.avgConfidence)} ({Math.round(t.avgConfidence * 100)}%)</span>
                      {t.avgEffectiveConfidence !== undefined && Math.round(t.avgEffectiveConfidence * 100) !== Math.round(t.avgConfidence * 100) && (
                        <span className={retentionColor(t.retentionStatus)}>
                          実効{Math.round(t.avgEffectiveConfidence * 100)}%
                        </span>
                      )}
                      {t.connections.length > 0 && (
                        <span>{t.connections.length}接続</span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{timeAgo(t.lastTaught)}
                      </span>
                    </div>
                    {/* 減衰バー */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${retentionBg(t.retentionStatus)}`}
                          style={{ width: retentionWidth(t.retentionStatus) }} />
                      </div>
                      <span className={`text-[8px] ${retentionColor(t.retentionStatus)}`}>
                        {retentionLabel(t.retentionStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5, 6].map(l => (
                      <div key={l} className={`w-1.5 h-4 rounded-sm ${l <= t.maxDepth ? depthBg(t.maxDepth) : "bg-[var(--color-border)]"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 未学習トピック（穴） */}
          {stat.gaps.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-2 mb-1">
                <AlertCircle className="w-3 h-3" />未学習（{stat.gaps.length}個）
              </div>
              {stat.gaps.map(gap => (
                <Link key={gap} href={`/study/teach?exam=${examId}&subject=${encodeURIComponent(stat.subject)}&topic=${encodeURIComponent(gap)}`}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-colors group">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-red-300 shrink-0" />
                  <span className="text-xs text-red-600 group-hover:text-red-700">{gap}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)] ml-auto group-hover:text-red-500">教える →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatReviewTiming(overdueDays: number, reviewAt: string): { text: string; urgent: boolean } {
  if (overdueDays > 0) {
    if (overdueDays < 1) return { text: `${Math.round(overdueDays * 24)}時間オーバー`, urgent: true };
    return { text: `${Math.round(overdueDays)}日オーバー`, urgent: true };
  }
  const daysUntil = -overdueDays;
  if (daysUntil < 1) return { text: `あと${Math.round(daysUntil * 24)}時間`, urgent: false };
  if (daysUntil < 7) return { text: `あと${Math.round(daysUntil)}日`, urgent: false };
  return { text: `${new Date(reviewAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}`, urgent: false };
}

function ReviewScheduleSection({ entries, examId }: { entries: ReviewScheduleEntry[]; examId: string }) {
  const overdue = entries.filter(e => e.overdueDays > 0);

  return (
    <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-orange-600" />
        <h3 className="text-sm font-bold text-orange-800">復習スケジュール</h3>
        {overdue.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
            {overdue.length}件が期限超過
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {entries.map(entry => {
          const timing = formatReviewTiming(entry.overdueDays, entry.reviewAt);
          return (
            <Link key={entry.id} href={`/study/teach?exam=${examId}&subject=${encodeURIComponent(entry.subject)}${entry.topic ? `&topic=${encodeURIComponent(entry.topic)}` : ""}`}
              className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors group ${
                timing.urgent ? "hover:bg-red-100 bg-red-50/50" : "hover:bg-orange-100"
              }`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${retentionBg(entry.retentionStatus)}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate">{entry.subject}{entry.topic ? ` > ${entry.topic}` : ""}</span>
                <div className="flex items-center gap-2 text-[9px] mt-0.5">
                  <span className={retentionColor(entry.retentionStatus)}>
                    記憶{entry.currentRetention}%
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    実効{entry.effectiveConfidence}%
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[9px] font-bold ${timing.urgent ? "text-red-600" : "text-orange-500"}`}>
                  {timing.text}
                </span>
              </div>
              <span className={`text-[9px] shrink-0 ${timing.urgent ? "text-red-500 group-hover:text-red-700" : "text-orange-500 group-hover:text-orange-700"}`}>
                復習 →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function trapTypeLabel(type: string): string {
  switch (type) {
    case "interference": return "干渉";
    case "overconfidence": return "過信";
    case "foundation_collapse": return "土台崩壊";
    case "recency_illusion": return "新鮮さの幻想";
    default: return type;
  }
}

function trapTypeBg(type: string): string {
  switch (type) {
    case "interference": return "bg-red-100 text-red-700";
    case "overconfidence": return "bg-amber-100 text-amber-700";
    case "foundation_collapse": return "bg-purple-100 text-purple-700";
    case "recency_illusion": return "bg-blue-100 text-blue-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function TrapsSection({ traps, examId }: { traps: TrapPrediction[]; examId: string }) {
  return (
    <div className="p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <h3 className="text-sm font-bold text-red-800">あなたが引っかかる落とし穴</h3>
        <span className="text-[10px] text-red-500">Coreがあなたの弱点から予測</span>
      </div>
      <div className="space-y-2">
        {traps.map((trap, i) => (
          <Link key={i} href={`/study/teach?exam=${examId}&subject=${encodeURIComponent(trap.subject)}&topic=${encodeURIComponent(trap.topic)}`}
            className="block py-2 px-3 rounded-lg bg-white/60 hover:bg-white transition-colors group">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${trapTypeBg(trap.trapType)}`}>
                {trapTypeLabel(trap.trapType)}
              </span>
              <span className="text-xs font-medium">{trap.subject} &gt; {trap.topic}</span>
              <span className="text-[9px] text-red-500 font-bold ml-auto">{trap.confidence}%の確率で罠</span>
            </div>
            <p className="text-[10px] text-red-700 leading-relaxed">{trap.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function insightIcon(type: string) {
  switch (type) {
    case "hidden_connection": return Link2;
    case "contradiction": return AlertTriangle;
    case "pattern": return AlertTriangle;
    case "vulnerability": return AlertTriangle;
    case "emergence": return Lightbulb;
    default: return Lightbulb;
  }
}

function insightBorder(severity: string): string {
  switch (severity) {
    case "critical": return "border-red-200 bg-red-50";
    case "warning": return "border-amber-200 bg-amber-50";
    default: return "border-indigo-200 bg-indigo-50";
  }
}

function InsightsSection({ insights }: { insights: CoreInsight[] }) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-sm font-bold text-[var(--color-text-secondary)]">Coreの気づき</h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">あなたの知識から発見した洞察</span>
      </div>
      {insights.map((insight, i) => {
        const Icon = insightIcon(insight.type);
        return (
          <div key={i} className={`p-3 rounded-xl border ${insightBorder(insight.severity)}`}>
            <div className="flex items-start gap-2">
              <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                insight.severity === "critical" ? "text-red-500" :
                insight.severity === "warning" ? "text-amber-500" :
                "text-indigo-500"
              }`} />
              <div>
                <p className="text-xs font-medium">{insight.title}</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">{insight.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionCenter({ stats, examId }: { stats: CoreStats; examId: string }) {
  const [expanded, setExpanded] = useState(false);
  const reviewCount = stats.reviewSchedule?.filter(e => e.overdueDays > 0).length || 0;
  const interleaveCount = stats.interleaveRecs?.length || 0;
  const chunkCount = stats.chunkOpportunities?.length || 0;
  const totalActions = reviewCount + interleaveCount + chunkCount;

  if (totalActions === 0) return null;

  return (
    <div className="mb-6 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />}
          <Zap className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-bold">アクションセンター</span>
        </div>
        <div className="flex items-center gap-2">
          {reviewCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
              復習{reviewCount}件
            </span>
          )}
          {interleaveCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              交互学習{interleaveCount}件
            </span>
          )}
          {chunkCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
              統合{chunkCount}件
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] p-4 space-y-4">
          {stats.reviewSchedule && stats.reviewSchedule.length > 0 && (
            <ReviewScheduleSection entries={stats.reviewSchedule} examId={examId} />
          )}
          {stats.interleaveRecs && stats.interleaveRecs.length > 0 && (
            <InterleaveSection recs={stats.interleaveRecs} examId={examId} />
          )}
          {stats.chunkOpportunities && stats.chunkOpportunities.length > 0 && (
            <ChunkSection chunks={stats.chunkOpportunities} />
          )}
        </div>
      )}
    </div>
  );
}

function InterleaveSection({ recs, examId }: { recs: InterleaveRec[]; examId: string }) {
  return (
    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Shuffle className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-bold text-indigo-800">次に学ぶべきトピック</h3>
        <span className="text-[10px] text-indigo-500">交互学習で定着率UP</span>
      </div>
      <div className="space-y-1.5">
        {recs.map((rec, i) => (
          <Link key={i} href={`/study/teach?exam=${examId}&subject=${encodeURIComponent(rec.subject)}&topic=${encodeURIComponent(rec.topic)}`}
            className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-indigo-100 transition-colors group">
            <div className={`w-2 h-2 rounded-full shrink-0 ${retentionBg(rec.retentionStatus)}`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium">{rec.subject} &gt; {rec.topic}</span>
              <div className="flex items-center gap-2 text-[9px] mt-0.5">
                <span className="text-indigo-500">{rec.reason}</span>
                <span className={retentionColor(rec.retentionStatus)}>
                  実効{rec.effectiveConfidence}%
                </span>
              </div>
            </div>
            <span className="text-[9px] text-indigo-400 group-hover:text-indigo-600">学ぶ →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChunkSection({ chunks }: { chunks: ChunkOpportunity[] }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-sm font-bold">統合チャンス</h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">関連する知識をまとめて強化できます</span>
      </div>
      <div className="space-y-1.5">
        {chunks.map((chunk, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-[var(--color-bg-secondary)]/50">
            <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium">{chunk.suggestedLabel}</span>
              <span className="text-[9px] text-[var(--color-text-muted)] ml-2">{chunk.subject} - {chunk.entryCount}件の知識</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineSection({ entries }: { entries: RecentEntry[] }) {
  return (
    <div className="mt-8">
      <h2 className="text-sm font-bold text-[var(--color-text-secondary)] mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />最近の蓄積
      </h2>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${retentionBg(entry.retentionStatus)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-medium truncate">{entry.subject}{entry.topic ? ` > ${entry.topic}` : ""}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                  entry.source === "verified" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                }`}>{entry.source === "verified" ? "修正検証" : "正確"}</span>
                {entry.operationLevel && entry.operationLevel !== "none" && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${operationBadgeColor(entry.operationLevel)}`}>
                    {operationLabels[entry.operationLevel]}
                  </span>
                )}
                {entry.hasMistake && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">間違い修正</span>
                )}
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{entry.content}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[8px] ${retentionColor(entry.retentionStatus)}`}>
                  {retentionLabel(entry.retentionStatus)}
                </span>
                <span className="text-[8px] text-[var(--color-text-muted)]">
                  実効{entry.effectiveConfidence}%
                </span>
              </div>
            </div>
            <div className="text-[9px] text-[var(--color-text-muted)] shrink-0">
              {timeAgo(entry.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
