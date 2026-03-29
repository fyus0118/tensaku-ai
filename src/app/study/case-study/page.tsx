"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Send, Loader2, FileText, Scale, ChevronRight,
} from "lucide-react";
import { getExamById, type ExamSubject } from "@/lib/exams";

interface ChatMessage { role: "user" | "assistant"; content: string; }

export default function CaseStudyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>}>
      <CaseStudyContent />
    </Suspense>
  );
}

function CaseStudyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("exam") || "";
  const subjectParam = searchParams.get("subject") || "";
  const topicParam = searchParams.get("topic") || "";
  const exam = getExamById(examId);

  const [phase, setPhase] = useState<"select" | "session">(subjectParam ? "session" : "select");
  const [selectedSubject, setSelectedSubject] = useState<ExamSubject | null>(
    exam?.subjects.find(s => s.name === subjectParam) || null
  );
  const [selectedTopic, setSelectedTopic] = useState(topicParam || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase === "session" && selectedSubject && !started) {
      setStarted(true);
      fetchResponse(`${selectedSubject.name}${selectedTopic ? `の${selectedTopic}` : ""}に関するケーススタディを1つ提示してください。`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedSubject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const startSession = (subject: ExamSubject, topic?: string) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic || "");
    setMessages([]);
    setStarted(false);
    setPhase("session");
    router.replace(`/study/case-study?exam=${examId}&subject=${encodeURIComponent(subject.name)}${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`);
  };

  const fetchResponse = async (userMessage: string) => {
    setLoading(true);
    setStreamingText("");

    try {
      const response = await fetch("/api/case-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject: selectedSubject?.name || subjectParam,
          topic: selectedTopic || undefined,
          message: userMessage,
          history: messages,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setMessages(prev => [...prev, { role: "assistant", content: `エラー: ${err.error}` }]);
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
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
      setMessages(prev => [...prev, { role: "assistant", content: "通信エラーが発生しました" }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    await fetchResponse(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  if (!exam) return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)] mb-4">試験が選択されていません</p>
        <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">ダッシュボードに戻る</Link>
      </div>
    </main>
  );

  if (phase === "select") return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-bold">ケーススタディ <span className="text-sm font-normal text-[var(--color-text-secondary)]">{exam.shortName}</span></h1>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">どの分野のケースに挑戦しますか？</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">実際の事例に基づくシナリオで、知識を「使える力」に変えます。</p>
        </div>
        <div className="space-y-4">
          {exam.subjects.map(subject => (
            <div key={subject.id} className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
              <button onClick={() => startSession(subject)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors">
                <div className="text-left"><h3 className="font-bold">{subject.name}</h3><p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subject.topics.length}トピック</p></div>
                <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
              {subject.topics.length > 0 && (
                <div className="px-6 pb-4 flex flex-wrap gap-2">
                  {subject.topics.map(topic => (
                    <button key={topic} onClick={() => startSession(subject, topic)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-emerald-500/10 hover:text-emerald-400 text-xs text-[var(--color-text-secondary)] transition-colors">{topic}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => setPhase("select")} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-bold">ケーススタディ
              <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">{selectedSubject?.name}{selectedTopic && ` / ${selectedTopic}`}</span>
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.length === 0 && !streamingText && !loading && (
            <div className="mb-8 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <span className="font-bold text-emerald-400">ケーススタディ</span> — 実際の事例をもとに判断を下してください。正解は1つとは限りません。
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`mb-6 ${msg.role === "user" ? "flex justify-end" : ""}`}>
              {msg.role === "user" ? (
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-[var(--color-accent)] text-white text-sm whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-1"><Scale className="w-4 h-4 text-emerald-400" /></div>
                  <div className="chat-result text-sm flex-1 min-w-0 prose prose-invert prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                </div>
              )}
            </div>
          ))}

          {streamingText && (
            <div className="mb-6 flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-1"><Scale className="w-4 h-4 text-emerald-400" /></div>
              <div className="chat-result text-sm flex-1 min-w-0 prose prose-invert prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown></div>
            </div>
          )}

          {loading && !streamingText && (
            <div className="mb-6 flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Loader2 className="w-4 h-4 text-emerald-400 animate-spin" /></div>
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
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="あなたの判断と理由を入力... (Shift+Enterで改行)" rows={1}
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-sm resize-none max-h-32"
              disabled={loading} />
            <button type="submit" disabled={loading || !input.trim()}
              className="px-4 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
