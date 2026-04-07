"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  PlusCircle,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { getExamById } from "@/lib/exams";
import {
  groupMaterialsBySubject,
  type MaterialDetail,
  type MaterialSummary,
} from "@/lib/materials";

type TabKey = "library" | "editor";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-accent)] text-white"
          : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function MaterialsContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("library");
  const [search, setSearch] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const selectedSubject = exam?.subjects.find((candidate) => candidate.name === subject);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setSubject("");
    setTopic("");
    setTitle("");
    setContent("");
  }, []);

  const fetchMaterials = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/materials?examId=${examId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "教材一覧の取得に失敗しました");
      }
      setMaterials(data.materials || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "教材一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    if (!selectedSubject?.topics.some((candidate) => candidate === topic)) {
      setTopic("");
    }
  }, [selectedSubject, topic]);

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return materials;
    const normalized = search.trim().toLowerCase();
    return materials.filter((material) => {
      const haystack = [
        material.title,
        material.subject,
        material.topic || "",
        material.excerpt,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [materials, search]);

  const groupedMaterials = useMemo(
    () => groupMaterialsBySubject(filteredMaterials),
    [filteredMaterials]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject || content.trim().length < 10) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = editingId ? `/api/materials/${editingId}` : "/api/materials";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject,
          topic: topic || undefined,
          title: title || undefined,
          content: content.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存に失敗しました");
      }

      const savedMaterial: MaterialDetail | undefined = data.material;
      setSuccess(
        editingId
          ? `「${data.material?.title || title || "教材"}」を更新しました。`
          : `「${data.title}」を登録しました（${data.chunks}チャンク / ${data.chars.toLocaleString()}文字）`
      );
      resetForm();
      setTab("library");
      await fetchMaterials();
      if (savedMaterial?.id) {
        setEditingId(null);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (material: MaterialSummary) => {
    if (!confirm(`「${material.title}」を削除しますか？`)) return;

    setDeleting(material.id);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/materials/${material.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "削除に失敗しました");
      }

      if (editingId === material.id) {
        resetForm();
      }

      setSuccess(`「${material.title}」を削除しました。`);
      await fetchMaterials();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = async (materialId: string) => {
    setLoadingDetailId(materialId);
    setError("");
    try {
      const res = await fetch(`/api/materials/${materialId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "教材の読み込みに失敗しました");
      }

      const material = data.material as MaterialDetail;
      setEditingId(material.id);
      setSubject(material.subject);
      setTopic(material.topic || "");
      setTitle(material.title);
      setContent(material.content);
      setTab("editor");
      setSuccess(`「${material.title}」を編集しています。`);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "教材の読み込みに失敗しました");
    } finally {
      setLoadingDetailId(null);
    }
  };

  if (!exam) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">試験が選択されていません</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <BookOpen className="h-5 w-5 text-teal-500" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold">マイ教材ライブラリ</h1>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{exam.name}</p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href={`/study/textbook?exam=${examId}&source=my`}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
            >
              <ExternalLink className="h-4 w-4" />
              読むビューで開く
            </Link>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setTab("editor");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <PlusCircle className="h-4 w-4" />
              新規登録
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/8 via-white to-sky-500/8 p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-600">
                <Sparkles className="h-3.5 w-3.5" />
                RAGだけで終わらない、読める教材ライブラリ
              </div>
              <h2 className="text-2xl font-black leading-tight sm:text-3xl">
                自分の教材を保存して、
                <br className="hidden sm:block" />
                そのまま読む・質問する・問題化する。
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                登録した教材はあなた専用のライブラリとして保存され、MentorやPractice生成の参考資料としても利用されます。
                他のユーザーには共有されません。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
                <div className="text-xs text-[var(--color-text-muted)]">教材数</div>
                <div className="mt-1 text-2xl font-black">{materials.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
                <div className="text-xs text-[var(--color-text-muted)]">合計文字数</div>
                <div className="mt-1 text-2xl font-black">
                  {materials.reduce((sum, material) => sum + material.totalChars, 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
                <div className="text-xs text-[var(--color-text-muted)]">科目数</div>
                <div className="mt-1 text-2xl font-black">
                  {new Set(materials.map((material) => material.subject)).size}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3">
                <div className="text-xs text-[var(--color-text-muted)]">推定読了</div>
                <div className="mt-1 text-2xl font-black">
                  {materials.reduce((sum, material) => sum + material.readMinutes, 0)}分
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <TabButton active={tab === "library"} onClick={() => setTab("library")} icon={FileText}>
            ライブラリ
          </TabButton>
          <TabButton active={tab === "editor"} onClick={() => setTab("editor")} icon={Upload}>
            {editingId ? "教材を編集" : "教材を登録"}
          </TabButton>
        </div>

        {error && (
          <div className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {tab === "library" ? (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="タイトル・科目・トピックで検索"
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] py-3 pl-11 pr-4 text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]/40 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/study/textbook?exam=${examId}&source=my`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)] sm:hidden"
                >
                  <ExternalLink className="h-4 w-4" />
                  読むビュー
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setTab("editor");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  <PlusCircle className="h-4 w-4" />
                  新しい教材を追加
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : groupedMaterials.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-16 text-center">
                <BookOpen className="mx-auto mb-4 h-10 w-10 text-[var(--color-text-muted)]" />
                <h3 className="text-lg font-bold">
                  {materials.length === 0 ? "まだ教材が登録されていません" : "条件に一致する教材がありません"}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {materials.length === 0
                    ? "教材テキストを登録すると、あとから読み返しつつAIにも活用できます。"
                    : "検索条件を変えるか、新しい教材を登録してください。"}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedMaterials.map((group) => (
                  <section key={group.subject}>
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black">{group.subject}</h2>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {group.materials.length}件の教材
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {group.materials.map((material) => (
                        <article
                          key={material.id}
                          className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-[11px] font-bold text-teal-600">
                                  {material.subject}
                                </span>
                                {material.topic && (
                                  <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                                    {material.topic}
                                  </span>
                                )}
                                {material.isLegacy && (
                                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                                    旧データ
                                  </span>
                                )}
                              </div>
                              <h3 className="truncate text-lg font-bold">{material.title}</h3>
                              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                                {material.excerpt || "本文プレビューは教材詳細で確認できます。"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(material.id)}
                                disabled={loadingDetailId === material.id}
                                className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
                                aria-label="教材を編集"
                              >
                                {loadingDetailId === material.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Pencil className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(material)}
                                disabled={deleting === material.id}
                                className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)]/30 hover:text-[var(--color-danger)]"
                                aria-label="教材を削除"
                              >
                                {deleting === material.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              約{material.readMinutes}分
                            </span>
                            <span>{material.totalChars.toLocaleString()}文字</span>
                            <span>{material.totalChunks}チャンク</span>
                            <span>更新 {formatDate(material.updatedAt)}</span>
                          </div>

                          <div className="mt-5 grid gap-2 sm:grid-cols-3">
                            <Link
                              href={`/study/materials/${encodeURIComponent(material.id)}?exam=${examId}`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                            >
                              <BookOpen className="h-4 w-4" />
                              読む
                            </Link>
                            <Link
                              href={`/study/chat?exam=${examId}&subject=${encodeURIComponent(material.subject)}`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
                            >
                              <MessageCircle className="h-4 w-4" />
                              AIに質問
                            </Link>
                            <Link
                              href={`/study/practice?exam=${examId}&subject=${encodeURIComponent(material.subject)}${material.topic ? `&topic=${encodeURIComponent(material.topic)}` : ""}`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
                            >
                              <Target className="h-4 w-4" />
                              問題化する
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    {editingId ? "教材を編集" : "教材を登録"}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    プレーンテキストでもMarkdownでも登録できます。保存後はそのまま教材として読めて、AIの参照ソースにもなります。
                  </p>
                </div>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setSuccess("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                  >
                    <X className="h-4 w-4" />
                    編集をやめる
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                    科目 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {exam.subjects.map((examSubject) => (
                      <button
                        key={examSubject.id}
                        type="button"
                        onClick={() => setSubject(examSubject.name)}
                        className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                          subject === examSubject.name
                            ? "bg-[var(--color-accent)] text-white"
                            : "border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30"
                        }`}
                      >
                        {examSubject.name}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedSubject && selectedSubject.topics.length > 0 && (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                      トピック（任意）
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedSubject.topics.map((candidate) => (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => setTopic(topic === candidate ? "" : candidate)}
                          className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                            topic === candidate
                              ? "bg-[var(--color-accent)] text-white"
                              : "border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30"
                          }`}
                        >
                          {candidate}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                    タイトル（任意）
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="例: 民法総則テキスト第3章"
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                    教材テキスト <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="教材本文、ノート、ハイライト、Markdownメモなどを貼り付けてください。"
                    rows={18}
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 text-sm leading-7 placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]/40 focus:outline-none resize-y"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>{content.length.toLocaleString()} / 100,000文字</span>
                    <span>見出しがあると読みやすい教材ビューになります</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving || !subject || content.trim().length < 10 || content.length > 100000}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      処理中...（教材保存とembedding生成）
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {editingId ? "教材を更新する" : "教材を登録する"}
                    </>
                  )}
                </button>
              </form>
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                <h3 className="text-sm font-bold">保存後にできること</h3>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
                    <p className="text-sm font-bold">読む</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      教材をそのままリーダー表示し、セクションごとに見返せます。
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
                    <p className="text-sm font-bold">AIに質問する</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      MentorやPracticeの生成時に、あなたの教材も参考資料として検索されます。
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-bg-secondary)] p-4">
                    <p className="text-sm font-bold">問題化する</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      科目やトピックを軸に、教材内容に寄せたPracticeを作りやすくなります。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                <h3 className="text-sm font-bold">登録のコツ</h3>
                <ul className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
                  <li>章タイトルや見出しを残すと、教材リーダーで目次化しやすくなります。</li>
                  <li>1教材は1テーマに寄せると、AIが参照しやすくなります。</li>
                  <li>Markdownの `# 見出し` や箇条書きもそのまま使えます。</li>
                </ul>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

export default function MaterialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      }
    >
      <MaterialsContent />
    </Suspense>
  );
}
