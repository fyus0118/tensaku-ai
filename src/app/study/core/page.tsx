"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Send, Loader2, Brain, MessageCircle, Map,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

interface SubjectStat {
  subject: string;
  totalTopics: number;
  coveredTopics: number;
  coverage: number;
  avgDepth: number;
  entries: number;
}

interface CoreStats {
  totalEntries: number;
  totalCoverage: number;
  subjects: SubjectStat[];
}

interface ChatMessage { role: "user" | "assistant"; content: string; }

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
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--color-accent)]" />
              <h1 className="text-lg font-bold">
                あなたのCore
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
          <div className="max-w-3xl mx-auto px-6 py-8">
            {loadingStats ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : !stats || stats.totalEntries === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                  <Brain className="w-10 h-10 text-[var(--color-accent)]" />
                </div>
                <h2 className="text-xl font-bold mb-2">Coreはまだ空です</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
                  教えてマスターで知識を教えると、検証済みの知識がCoreに蓄積されます。
                  Coreはあなたの知識の分身 — あなたが教えたことだけを知っています。
                </p>
                <Link href={`/study/teach?exam=${examId}`}
                  className="inline-block py-3 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors">
                  教えてマスターを始める
                </Link>
              </div>
            ) : (
              <>
                {/* 全体スコア */}
                <div className="text-center mb-10">
                  <div className="w-24 h-24 rounded-full border-4 border-[var(--color-border)] flex items-center justify-center mx-auto mb-4 relative">
                    <span className={`text-3xl font-black ${
                      stats.totalCoverage >= 70 ? "text-[var(--color-success)]" :
                      stats.totalCoverage >= 40 ? "text-[var(--color-warning)]" :
                      "text-[var(--color-danger)]"
                    }`}>{stats.totalCoverage}%</span>
                  </div>
                  <h2 className="text-lg font-bold mb-1">知識充足度</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {stats.totalEntries}項目の知識を蓄積済み
                  </p>
                </div>

                {/* 科目別マップ */}
                <div className="space-y-4">
                  {stats.subjects.map(s => (
                    <div key={s.subject} className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm">{s.subject}</h3>
                        <span className={`text-xs font-bold ${
                          s.coverage >= 70 ? "text-[var(--color-success)]" :
                          s.coverage >= 40 ? "text-[var(--color-warning)]" :
                          s.coverage > 0 ? "text-[var(--color-danger)]" :
                          "text-[var(--color-text-muted)]"
                        }`}>{s.coverage}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--color-bg-secondary)] mb-2">
                        <div className={`h-full rounded-full transition-all ${
                          s.coverage >= 70 ? "bg-[var(--color-success)]" :
                          s.coverage >= 40 ? "bg-[var(--color-warning)]" :
                          s.coverage > 0 ? "bg-[var(--color-danger)]" :
                          "bg-[var(--color-border)]"
                        }`} style={{ width: `${Math.max(s.coverage, 2)}%` }} />
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-muted)]">
                        <span>{s.coveredTopics}/{s.totalTopics}トピック</span>
                        <span>{s.entries}項目</span>
                        {s.avgDepth > 0 && <span>理解度Lv{s.avgDepth}</span>}
                        {s.coverage === 0 && <span className="text-[var(--color-danger)]">未学習</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-center text-xs text-[var(--color-text-muted)] mt-8">
                  Coreの穴 = あなたの知識の穴。0%の科目から教えてマスターで埋めていきましょう。
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
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
                    Coreはあなたが教えた知識だけで回答します。ChatGPTの知識は混ざりません。
                    知らないことは「まだ教わっていません」と正直に答えます。
                  </p>
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
