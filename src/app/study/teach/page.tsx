"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Send,
  Loader2,
  GraduationCap,
  UserRound,
} from "lucide-react";
import { getExamById } from "@/lib/exams";
import { buildTeachFirstMessage } from "@/lib/prompts/teach";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const examId = searchParams.get("exam") || "";
  const subjectParam = searchParams.get("subject") || "";
  const topicParam = searchParams.get("topic") || "";
  const exam = getExamById(examId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [stats, setStats] = useState({ turns: 0, caught: 0, missed: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初回: AI後輩の最初の質問を表示
  useEffect(() => {
    if (examId && subjectParam && messages.length === 0) {
      const firstMsg = buildTeachFirstMessage(subjectParam, topicParam || undefined);
      setMessages([{ role: "assistant", content: firstMsg }]);
    }
  }, [examId, subjectParam, topicParam, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

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
          subject: subjectParam,
          topic: topicParam || undefined,
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
                  setStats((prev) => ({ ...prev, turns: prev.turns + 1 }));
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

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[var(--color-accent)]" />
              <h1 className="text-lg font-bold">
                教えてマスター
                {exam && (
                  <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                    {exam.shortName}
                    {subjectParam && ` / ${subjectParam}`}
                    {topicParam && ` / ${topicParam}`}
                  </span>
                )}
              </h1>
            </div>
          </div>
          {stats.turns > 0 && (
            <div className="text-xs text-[var(--color-text-muted)]">
              {stats.turns}ターン
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.length <= 1 && !streamingText && (
            <div className="mb-8 p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <span className="font-bold text-[var(--color-accent)]">逆転授業モード</span>
                {" "}— あなたが先生、AIが生徒です。後輩に教えることで、自分の理解の穴が見つかります。
                専門用語を使わず、わかりやすく教えてみてください。
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
                  <div className="chat-result text-sm flex-1 min-w-0 prose prose-invert prose-sm max-w-none">
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
              <div className="chat-result text-sm flex-1 min-w-0 prose prose-invert prose-sm max-w-none">
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
