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
  PenTool,
  BookOpen,
  RotateCcw,
} from "lucide-react";

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "essay";
  const isEssay = mode === "essay";

  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  // Essay fields
  const [documentType, setDocumentType] = useState("小論文");
  const [targetUniversity, setTargetUniversity] = useState("");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [examType, setExamType] = useState("");
  const [theme, setTheme] = useState("");
  const [wordLimit, setWordLimit] = useState("");

  // Report fields
  const [grade, setGrade] = useState("");
  const [citationStyle, setCitationStyle] = useState("");
  const [reportType, setReportType] = useState("論証型");

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setResult("");
    setScore(null);
    setError("");

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewType: mode,
          content,
          documentType: isEssay ? documentType : reportType,
          targetUniversity: isEssay ? targetUniversity : undefined,
          targetDepartment,
          examType: isEssay ? examType : undefined,
          theme,
          wordLimit: wordLimit || undefined,
          grade: !isEssay ? grade : undefined,
          citationStyle: !isEssay ? citationStyle : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "エラーが発生しました");
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError("ストリーミングに対応していません");
        setLoading(false);
        return;
      }

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
                setResult((prev) => prev + data.text);
              }
              if (data.done && data.score) {
                setScore(data.score);
              }
              if (data.error) {
                setError(data.error);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch {
      setError("通信エラーが発生しました");
    }

    setLoading(false);
  };

  const handleReset = () => {
    setResult("");
    setScore(null);
    setError("");
  };

  const charCount = content.length;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              {isEssay ? (
                <PenTool className="w-5 h-5 text-[var(--color-accent)]" />
              ) : (
                <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
              )}
              <h1 className="text-lg font-bold">
                {isEssay ? "小論文・志望理由書添削" : "大学レポート添削"}
              </h1>
            </div>
          </div>
          {result && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-sm text-[var(--color-text-secondary)] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              新しい添削
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Input */}
        <div className="lg:w-1/2 border-r border-[var(--color-border)] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Settings */}
            <div className="p-6 border-b border-[var(--color-border)] space-y-4 overflow-y-auto shrink-0">
              {isEssay ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        文章の種類
                      </label>
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
                      >
                        <option>小論文</option>
                        <option>志望理由書</option>
                        <option>自己推薦書</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        入試形態
                      </label>
                      <select
                        value={examType}
                        onChange={(e) => setExamType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
                      >
                        <option value="">選択してください</option>
                        <option>一般入試</option>
                        <option>総合型選抜（AO）</option>
                        <option>学校推薦型</option>
                        <option>公募推薦</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        志望大学
                      </label>
                      <input
                        type="text"
                        value={targetUniversity}
                        onChange={(e) => setTargetUniversity(e.target.value)}
                        placeholder="例：慶應義塾大学"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        学部
                      </label>
                      <input
                        type="text"
                        value={targetDepartment}
                        onChange={(e) => setTargetDepartment(e.target.value)}
                        placeholder="例：総合政策学部"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        レポートの種類
                      </label>
                      <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
                      >
                        <option>論証型</option>
                        <option>実験レポート</option>
                        <option>文献レビュー</option>
                        <option>書評</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        学年
                      </label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
                      >
                        <option value="">選択してください</option>
                        <option>1年生</option>
                        <option>2年生</option>
                        <option>3年生</option>
                        <option>4年生</option>
                        <option>大学院</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        学部・学科
                      </label>
                      <input
                        type="text"
                        value={targetDepartment}
                        onChange={(e) => setTargetDepartment(e.target.value)}
                        placeholder="例：法学部"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        引用スタイル
                      </label>
                      <select
                        value={citationStyle}
                        onChange={(e) => setCitationStyle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm focus:border-[var(--color-accent)] focus:outline-none"
                      >
                        <option value="">指定なし</option>
                        <option>APA</option>
                        <option>MLA</option>
                        <option>SIST02</option>
                        <option>Chicago</option>
                        <option>IEEE</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    テーマ・設問
                  </label>
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder={
                      isEssay
                        ? "例：AIと教育の未来について"
                        : "例：日本の少子高齢化について論じよ"
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    指定文字数
                  </label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(e.target.value)}
                    placeholder="例：800"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex-1 relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    isEssay
                      ? "ここに小論文・志望理由書を貼り付けてください..."
                      : "ここにレポートを貼り付けてください..."
                  }
                  className="w-full h-full resize-none bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none text-sm leading-relaxed"
                  disabled={loading}
                />
              </div>

              {/* Bottom bar */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)] shrink-0">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {charCount}文字
                  {wordLimit && (
                    <span
                      className={
                        charCount > parseInt(wordLimit)
                          ? "text-[var(--color-danger)] font-bold"
                          : ""
                      }
                    >
                      {" "}
                      / {wordLimit}字
                    </span>
                  )}
                </span>
                <button
                  type="submit"
                  disabled={loading || !content.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      添削中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      添削する
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right: Result */}
        <div className="lg:w-1/2 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] shrink-0">
            <h2 className="text-sm font-bold text-[var(--color-text-secondary)]">
              添削結果
              {score !== null && (
                <span
                  className="ml-3 text-xl font-black"
                  style={{
                    color:
                      score >= 80
                        ? "var(--color-success)"
                        : score >= 60
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                  }}
                >
                  {score}点
                </span>
              )}
            </h2>
          </div>
          <div
            ref={resultRef}
            className="flex-1 overflow-y-auto p-6"
          >
            {error && (
              <div className="p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm">
                {error}
              </div>
            )}
            {result ? (
              <div className="review-result text-sm prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result}
                </ReactMarkdown>
              </div>
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center mb-4">
                  {isEssay ? (
                    <PenTool className="w-8 h-8 text-[var(--color-text-muted)]" />
                  ) : (
                    <BookOpen className="w-8 h-8 text-[var(--color-text-muted)]" />
                  )}
                </div>
                <p className="text-[var(--color-text-secondary)] mb-1">
                  左側に文章を貼り付けて「添削する」を押してください
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  採点官と同じ視点で、100点満点の添削結果が表示されます
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin mb-4" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  採点官の視点で分析中...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
