"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  ChevronRight,
  ChevronDown,
  FileText,
} from "lucide-react";
import { getExamById } from "@/lib/exams";
import { groupMaterialsBySubject, type MaterialSummary } from "@/lib/materials";

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
  const sourceParam = searchParams.get("source") === "my" ? "my" : "official";
  const exam = getExamById(examId);

  const [subjects, setSubjects] = useState<SubjectGroup[]>([]);
  const [personalMaterials, setPersonalMaterials] = useState<MaterialSummary[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [topicContent, setTopicContent] = useState("");
  const [illustrations, setIllustrations] = useState<{ image_url: string; caption: string | null; position: string }[]>([]);
  const [currentTopic, setCurrentTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!examId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    if (sourceParam === "official") {
      fetch(`/api/textbook?examId=${examId}`)
        .then((response) => response.json())
        .then((data) => {
          setSubjects(data.subjects || []);
          if (data.subjects?.length > 0) {
            setExpandedSubject(data.subjects[0].name);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    fetch(`/api/materials?examId=${examId}`)
      .then((response) => response.json())
      .then((data) => {
        setPersonalMaterials(data.materials || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [examId, sourceParam]);

  useEffect(() => {
    if (sourceParam !== "official" || !topicParam || !examId) return;
    setLoadingContent(true);
    setCurrentTopic(topicParam);
    fetch(
      `/api/textbook?examId=${examId}&topic=${encodeURIComponent(topicParam)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setTopicContent(data.content || "");
        setIllustrations(data.illustrations || []);
      })
      .catch(() => { setTopicContent(""); setIllustrations([]); })
      .finally(() => setLoadingContent(false));
  }, [topicParam, examId, sourceParam]);

  const handleTopicClick = (topic: string) => {
    router.push(
      `/study/textbook?exam=${examId}&source=official&topic=${encodeURIComponent(topic)}`
    );
  };

  const handleSourceChange = (source: "official" | "my") => {
    router.push(`/study/textbook?exam=${examId}&source=${source}`);
  };

  const handleBack = () => {
    if (topicParam) {
      router.push(`/study/textbook?exam=${examId}&source=official`);
      setTopicContent("");
      setCurrentTopic("");
    }
  };

  const personalGroups = groupMaterialsBySubject(personalMaterials);

  function SourceTabs() {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-secondary)] p-1">
        <button
          type="button"
          onClick={() => handleSourceChange("official")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            sourceParam === "official"
              ? "bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          公式教材
        </button>
        <button
          type="button"
          onClick={() => handleSourceChange("my")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            sourceParam === "my"
              ? "bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          マイ教材
        </button>
      </div>
    );
  }

  if (sourceParam === "official" && topicParam && (topicContent || loadingContent)) {
    const allTopics = subjects.flatMap((s) => s.topics);
    const currentIndex = allTopics.indexOf(topicParam);
    const prevTopic = currentIndex > 0 ? allTopics[currentIndex - 1] : null;
    const nextTopic =
      currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : null;

    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-[var(--color-border)] shrink-0">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
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
            <SourceTabs />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loadingContent ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : (
            <article className="max-w-4xl mx-auto px-6 py-8">
              {illustrations.filter(i => i.position === "before_content").map((img, i) => (
                <figure key={`before-${i}`} className="mb-8">
                  <img src={img.image_url} alt={img.caption || ""} className="w-full rounded-2xl border border-[var(--color-border)]" loading="lazy" />
                  {img.caption && <figcaption className="mt-2 text-center text-sm text-[var(--color-text-muted)]">{img.caption}</figcaption>}
                </figure>
              ))}

              {illustrations.filter(i => i.position === "after_heading").map((img, i) => (
                <figure key={`heading-${i}`} className="mb-8">
                  <img src={img.image_url} alt={img.caption || ""} className="w-full rounded-2xl border border-[var(--color-border)]" loading="lazy" />
                  {img.caption && <figcaption className="mt-2 text-center text-sm text-[var(--color-text-muted)]">{img.caption}</figcaption>}
                </figure>
              ))}

              <div className="textbook-content prose prose-neutral max-w-none">
                <MarkdownRenderer>
                  {topicContent}
                </MarkdownRenderer>
              </div>

              {illustrations.filter(i => i.position === "after_content").map((img, i) => (
                <figure key={`after-${i}`} className="mt-8">
                  <img src={img.image_url} alt={img.caption || ""} className="w-full rounded-2xl border border-[var(--color-border)]" loading="lazy" />
                  {img.caption && <figcaption className="mt-2 text-center text-sm text-[var(--color-text-muted)]">{img.caption}</figcaption>}
                </figure>
              ))}

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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              {sourceParam === "official" ? (
                <BookOpen className="w-5 h-5 text-sky-500" />
              ) : (
                <FileText className="w-5 h-5 text-teal-500" />
              )}
              <h1 className="text-lg font-bold">
                {sourceParam === "official" ? "テキスト" : "マイ教材"}
                <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                  {exam?.name}
                </span>
              </h1>
            </div>
          </div>
          <SourceTabs />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : sourceParam === "official" ? (
            subjects.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
                <p className="text-[var(--color-text-secondary)] mb-2">
                  この試験のテキスト教材はまだありません
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Mentorで学習を始めましょう
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
            )
          ) : personalGroups.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
              <p className="text-[var(--color-text-secondary)] mb-2">
                まだマイ教材が登録されていません
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                教材を登録すると、この画面からそのまま読めます
              </p>
              <Link
                href={`/study/materials?exam=${examId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white"
              >
                マイ教材を登録する
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {personalGroups.map((group) => (
                <section key={group.subject}>
                  <div className="mb-3">
                    <h2 className="text-base font-black">{group.subject}</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {group.materials.length}件の教材
                    </p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.materials.map((material) => (
                      <Link
                        key={material.id}
                        href={`/study/materials/${encodeURIComponent(material.id)}?exam=${examId}`}
                        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 transition-colors hover:border-[var(--color-accent)]/30"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-[11px] font-bold text-teal-600">
                            {material.subject}
                          </span>
                          {material.topic && (
                            <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                              {material.topic}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold">{material.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                          {material.excerpt}
                        </p>
                        <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                          <span>{material.totalChars.toLocaleString()}文字</span>
                          <span>{material.readMinutes}分</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
