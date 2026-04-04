"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

interface SubjectGroup {
  name: string;
  topics: string[];
}

export default function TextbookPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <TextbookContent />
    </Suspense>
  );
}

function TextbookContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("exam") || "";
  const topicParam = searchParams.get("topic") || "";
  const exam = getExamById(examId);

  const [subjects, setSubjects] = useState<SubjectGroup[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [topicContent, setTopicContent] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // Load subject/topic list
  useEffect(() => {
    if (!examId) {
      setLoading(false);
      return;
    }
    fetch(`/api/textbook?examId=${examId}`)
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
        // Auto-expand first subject
        if (data.subjects?.length > 0) {
          setExpandedSubject(data.subjects[0].name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [examId]);

  // Load topic content when topic param changes
  useEffect(() => {
    if (!topicParam || !examId) return;
    setLoadingContent(true);
    setCurrentTopic(topicParam);
    fetch(
      `/api/textbook?examId=${examId}&topic=${encodeURIComponent(topicParam)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setTopicContent(data.content || "");
      })
      .catch(() => setTopicContent(""))
      .finally(() => setLoadingContent(false));
  }, [topicParam, examId]);

  const handleTopicClick = (topic: string) => {
    router.push(
      `/study/textbook?exam=${examId}&topic=${encodeURIComponent(topic)}`
    );
  };

  const handleBack = () => {
    if (topicParam) {
      router.push(`/study/textbook?exam=${examId}`);
      setTopicContent("");
      setCurrentTopic("");
    }
  };

  // Topic reading view
  if (topicParam && (topicContent || loadingContent)) {
    // Find current topic index for prev/next navigation
    const allTopics = subjects.flatMap((s) => s.topics);
    const currentIndex = allTopics.indexOf(topicParam);
    const prevTopic = currentIndex > 0 ? allTopics[currentIndex - 1] : null;
    const nextTopic =
      currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : null;

    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-[var(--color-border)] shrink-0">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-5 h-5 text-sky-500 shrink-0" />
              <h1 className="text-lg font-bold truncate">
                テキスト
                <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                  {exam?.name}
                </span>
              </h1>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loadingContent ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : (
            <article className="max-w-4xl mx-auto px-6 py-8">
              <div className="textbook-content prose prose-neutral max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {topicContent}
                </ReactMarkdown>
              </div>

              {/* Prev/Next navigation */}
              <div className="mt-12 pt-6 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
                {prevTopic ? (
                  <button
                    onClick={() => handleTopicClick(prevTopic)}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{prevTopic}</span>
                  </button>
                ) : (
                  <div />
                )}
                {nextTopic ? (
                  <button
                    onClick={() => handleTopicClick(nextTopic)}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                  >
                    <span className="truncate max-w-[200px]">{nextTopic}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div />
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    );
  }

  // Topic list view
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-500" />
            <h1 className="text-lg font-bold">
              テキスト
              <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                {exam?.name}
              </span>
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
              <p className="text-[var(--color-text-secondary)] mb-2">
                この試験のテキスト教材はまだありません
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                AIチューターで学習を始めましょう
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div
                  key={subject.name}
                  className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedSubject(
                        expandedSubject === subject.name
                          ? null
                          : subject.name
                      )
                    }
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-sky-500" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-sm">{subject.name}</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {subject.topics.length}トピック
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${
                        expandedSubject === subject.name ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedSubject === subject.name && (
                    <div className="border-t border-[var(--color-border)]">
                      {subject.topics.map((topic, i) => (
                        <button
                          key={topic}
                          onClick={() => handleTopicClick(topic)}
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-[var(--color-text-muted)] w-6 text-right shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-sm truncate">{topic}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
