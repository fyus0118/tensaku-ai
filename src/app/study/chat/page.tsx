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
  MessageCircle,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const subjectParam = searchParams.get("subject") || "";
  const exam = getExamById(examId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // DB から会話履歴を復元
  useEffect(() => {
    if (!examId) { setLoadingHistory(false); return; }
    fetch(`/api/chat?examId=${examId}&subject=${encodeURIComponent(subjectParam)}`)
      .then((r) => r.ok ? r.json() : { messages: [] })
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [examId, subjectParam]);

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject: subjectParam,
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

  const quickQuestions = exam
    ? [
        `${exam.shortName}の頻出論点トップ5を教えて`,
        `${subjectParam || exam.subjects[0]?.name}の効率的な覚え方は？`,
        `試験まであと3ヶ月。おすすめの学習計画は？`,
      ]
    : [];

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[var(--color-accent)]" />
            <h1 className="text-lg font-bold">
              AIチューター
              {exam && (
                <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                  {exam.icon} {exam.shortName}
                  {subjectParam && ` / ${subjectParam}`}
                </span>
              )}
            </h1>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {loadingHistory && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
            </div>
          )}

          {!loadingHistory && messages.length === 0 && !streamingText && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                <Lightbulb className="w-10 h-10 text-[var(--color-accent)]" />
              </div>
              <h2 className="text-xl font-bold mb-2">何でも聞いてください</h2>
              <p className="text-[var(--color-text-secondary)] text-sm mb-8 max-w-md mx-auto">
                {exam
                  ? `${exam.name}に関する質問に、試験対策の視点で回答します。概念の解説、解き方のコツ、暗記法、なんでもOK。`
                  : "試験に関する質問に回答します。"}
              </p>

              {quickQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="px-4 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 text-sm text-[var(--color-text-secondary)] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
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
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0 mt-1">
                    <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
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
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0 mt-1">
                <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
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
              placeholder="質問を入力... (Shift+Enterで改行)"
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
