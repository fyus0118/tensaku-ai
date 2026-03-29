"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Send,
  Loader2,
  GraduationCap,
  UserRound,
  ChevronRight,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { getExamById, type ExamSubject } from "@/lib/exams";
import { buildTeachFirstMessage } from "@/lib/prompts/teach";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionResult {
  turns: number;
  caught: number;
  missed: number;
  errors: number;
  correct: number;
  score: number;
}

export default function TeachPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <TeachContent />
    </Suspense>
  );
}

function TeachContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("exam") || "";
  const subjectParam = searchParams.get("subject") || "";
  const topicParam = searchParams.get("topic") || "";
  const exam = getExamById(examId);

  // フェーズ: select → teaching → summary
  const [phase, setPhase] = useState<"select" | "teaching" | "summary">(
    subjectParam ? "teaching" : "select"
  );
  const [selectedSubject, setSelectedSubject] = useState<ExamSubject | null>(
    exam?.subjects.find(s => s.name === subjectParam) || null
  );
  const [selectedTopic, setSelectedTopic] = useState(topicParam || "");

  // チャット
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [turns, setTurns] = useState(0);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 診断カウンター
  const caughtRef = useRef(0);
  const missedRef = useRef(0);
  const errorsRef = useRef(0);
  const correctRef = useRef(0);

  // teaching開始時にAI後輩の最初の質問を表示
  useEffect(() => {
    if (phase === "teaching" && selectedSubject && messages.length === 0) {
      const firstMsg = buildTeachFirstMessage(
        selectedSubject.name,
        selectedTopic || undefined
      );
      setMessages([{ role: "assistant", content: firstMsg }]);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [phase, selectedSubject, selectedTopic, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const startSession = (subject: ExamSubject, topic?: string) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic || "");
    setMessages([]);
    setTurns(0);
    caughtRef.current = 0;
    missedRef.current = 0;
    errorsRef.current = 0;
    correctRef.current = 0;
    setSessionResult(null);
    setPhase("teaching");

    // URLを更新
    const params = new URLSearchParams({
      exam: examId,
      subject: subject.name,
      ...(topic ? { topic } : {}),
    });
    router.replace(`/study/teach?${params.toString()}`);
  };

  const endSession = () => {
    const total = caughtRef.current + missedRef.current + errorsRef.current + correctRef.current;
    const positive = caughtRef.current + correctRef.current;
    const score = total > 0 ? Math.round((positive / total) * 100) : turns > 3 ? 70 : 50;

    setSessionResult({
      turns,
      caught: caughtRef.current,
      missed: missedRef.current,
      errors: errorsRef.current,
      correct: correctRef.current,
      score,
    });
    setPhase("summary");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !selectedSubject) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setStreamingText("");

    try {
      const response = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject: selectedSubject.name,
          topic: selectedTopic || undefined,
          message: userMessage,
          history: messages,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `エラー: ${err.error}` },
        ]);
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
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullText += data.text;
                  setStreamingText(fullText);
                }
                if (data.done) {
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: fullText },
                  ]);
                  setStreamingText("");
                  setTurns((prev) => prev + 1);
                }
                if (data.diagnostics) {
                  const d = data.diagnostics;
                  caughtRef.current += d.caught || 0;
                  missedRef.current += d.missed || 0;
                  errorsRef.current += d.errors || 0;
                  correctRef.current += d.correct || 0;
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "通信エラーが発生しました" },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!exam) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[var(--color-text-secondary)] mb-4">試験が選択されていません</p>
          <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </main>
    );
  }

  // ── 科目/トピック選択画面 ──
  if (phase === "select") {
    return (
      <main className="min-h-screen">
        <header className="border-b border-[var(--color-border)]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-amber-500" />
              <h1 className="text-lg font-bold">教えてマスター</h1>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {exam.shortName}
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-2">何を教えますか？</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              科目を選んでAI後輩に教えてみましょう。教えることで理解の穴が見つかります。
            </p>
          </div>

          <div className="space-y-4">
            {exam.subjects.map((subject) => (
              <div
                key={subject.id}
                className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden"
              >
                {/* 科目全体で教える */}
                <button
                  onClick={() => startSession(subject)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <div className="text-left">
                    <h3 className="font-bold">{subject.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {subject.topics.length}トピック
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </button>

                {/* トピック個別 */}
                {subject.topics.length > 0 && (
                  <div className="px-6 pb-4 flex flex-wrap gap-2">
                    {subject.topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => startSession(subject, topic)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-amber-500/10 hover:text-amber-500 text-xs text-[var(--color-text-secondary)] transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── セッション結果サマリー ──
  if (phase === "summary" && sessionResult) {
    const scoreColor =
      sessionResult.score >= 80
        ? "text-green-400"
        : sessionResult.score >= 50
        ? "text-amber-400"
        : "text-red-400";

    const scoreLabel =
      sessionResult.score >= 80
        ? "教えられるレベル"
        : sessionResult.score >= 50
        ? "もう少し深掘りが必要"
        : "基礎の復習を推奨";

    return (
      <main className="min-h-screen">
        <header className="border-b border-[var(--color-border)]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-amber-500" />
              <h1 className="text-lg font-bold">セッション結果</h1>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* スコア */}
          <div className="text-center mb-10">
            <div className="w-24 h-24 rounded-full border-4 border-[var(--color-border)] flex items-center justify-center mx-auto mb-4 relative">
              <span className={`text-3xl font-black ${scoreColor}`}>
                {sessionResult.score}
              </span>
              <Trophy className={`w-5 h-5 absolute -top-1 -right-1 ${scoreColor}`} />
            </div>
            <h2 className="text-xl font-bold mb-1">{scoreLabel}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {selectedSubject?.name}{selectedTopic && ` / ${selectedTopic}`} — {sessionResult.turns}ターン
            </p>
          </div>

          {/* 詳細 */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium">正確に説明</span>
              </div>
              <p className="text-2xl font-black text-green-400">{sessionResult.correct}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">間違い指摘</span>
              </div>
              <p className="text-2xl font-black text-blue-400">{sessionResult.caught}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium">見逃した間違い</span>
              </div>
              <p className="text-2xl font-black text-red-400">{sessionResult.missed}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">説明の誤り</span>
              </div>
              <p className="text-2xl font-black text-amber-400">{sessionResult.errors}</p>
            </div>
          </div>

          {/* アクション */}
          <div className="flex gap-3">
            <button
              onClick={() => startSession(selectedSubject!, selectedTopic || undefined)}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              もう一度教える
            </button>
            <button
              onClick={() => setPhase("select")}
              className="flex-1 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 font-bold transition-colors"
            >
              別のトピックを教える
            </button>
          </div>
          <Link
            href="/dashboard"
            className="block text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mt-4 transition-colors"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </main>
    );
  }

  // ── 教えるセッション（メイン） ──
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (turns >= 3) {
                  endSession();
                } else {
                  setPhase("select");
                }
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-amber-500" />
              <h1 className="text-lg font-bold">
                教えてマスター
                <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                  {selectedSubject?.name}
                  {selectedTopic && ` / ${selectedTopic}`}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-muted)]">
              {turns}ターン
            </span>
            {turns >= 3 && (
              <button
                onClick={endSession}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-bold hover:bg-amber-500/20 transition-colors"
              >
                終了してスコアを見る
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.length <= 1 && !streamingText && (
            <div className="mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <span className="font-bold text-amber-500">逆転授業モード</span>
                {" "}— あなたが先生、AIが生徒です。後輩に教えることで、自分の理解の穴が見つかります。
                専門用語を使わず、わかりやすく教えてみてください。3ターン以上でスコアが表示されます。
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-6 ${msg.role === "user" ? "flex justify-end" : ""}`}
            >
              {msg.role === "user" ? (
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-[var(--color-accent)] text-white text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-1">
                    <UserRound className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="chat-result text-sm flex-1 min-w-0 prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {streamingText && (
            <div className="mb-6 flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-1">
                <UserRound className="w-4 h-4 text-amber-500" />
              </div>
              <div className="chat-result text-sm flex-1 min-w-0 prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {loading && !streamingText && (
            <div className="mb-6 flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
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

      {/* Input */}
      <div className="border-t border-[var(--color-border)] shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto px-6 py-4"
        >
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="後輩に教えるように説明してみよう... (Shift+Enterで改行)"
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-sm resize-none max-h-32"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
