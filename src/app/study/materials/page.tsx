"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  Loader2,
  CheckCircle,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { getExamById, type ExamCategory } from "@/lib/exams";

interface Material {
  title: string;
  subject: string;
  topic: string | null;
  totalChunks: number;
  totalChars: number;
  createdAt: string;
}

function MaterialsContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // 入力フォーム
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const fetchMaterials = useCallback(async () => {
    if (!examId) return;
    try {
      const res = await fetch(`/api/materials?examId=${examId}`);
      const data = await res.json();
      setMaterials(data.materials || []);
    } catch {
      console.error("Failed to fetch materials");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // 科目が選択されたらトピックリセット
  useEffect(() => {
    setTopic("");
  }, [subject]);

  const selectedSubject = exam?.subjects.find((s) => s.name === subject);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !subject) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
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
        setError(data.error || "保存に失敗しました");
        return;
      }

      setSuccess(`「${data.title}」を登録しました（${data.chunks}チャンク / ${data.chars.toLocaleString()}文字）`);
      setContent("");
      setTitle("");
      fetchMaterials();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (materialTitle: string) => {
    if (!confirm(`「${materialTitle}」を削除しますか？`)) return;

    setDeleting(materialTitle);
    try {
      const res = await fetch("/api/materials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: materialTitle, examId }),
      });

      if (res.ok) {
        fetchMaterials();
      }
    } catch {
      console.error("Delete failed");
    } finally {
      setDeleting(null);
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg)] z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-teal-500" />
            </div>
            <div>
              <h1 className="font-bold text-sm">マイ教材</h1>
              <p className="text-xs text-[var(--color-text-muted)]">{exam.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* 説明 */}
        <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20">
          <p className="text-sm text-[var(--color-text-secondary)]">
            教材のテキストを貼り付けると、AIチューターや練習問題の精度が上がります。
            あなたの教材は<strong>あなただけ</strong>が使えます。他のユーザーには共有されません。
          </p>
        </div>

        {/* 登録フォーム */}
        <section>
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            教材を登録
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 科目選択 */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                科目 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {exam.subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubject(s.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      subject === s.name
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* トピック選択 */}
            {selectedSubject && selectedSubject.topics.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  トピック（任意）
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedSubject.topics.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(topic === t ? "" : t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        topic === t
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* タイトル */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                タイトル（任意）
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 民法総則テキスト第3章"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/50"
              />
            </div>

            {/* テキスト入力 */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                教材テキスト <span className="text-[var(--color-danger)]">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="教材のテキストをここに貼り付けてください。Kindleのハイライトやコピー、ノートの内容などをそのまま貼り付けられます。"
                rows={12}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/50 resize-y"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {content.length.toLocaleString()} 文字
                {content.length > 100000 && (
                  <span className="text-[var(--color-danger)] ml-2">（上限: 100,000文字）</span>
                )}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !subject || content.trim().length < 10}
              className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-bold text-sm hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  処理中...（embedding生成中）
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  登録する
                </>
              )}
            </button>
          </form>
        </section>

        {/* 登録済み教材一覧 */}
        <section>
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            登録済みの教材
            {materials.length > 0 && (
              <span className="text-xs text-[var(--color-text-muted)] font-normal">
                （{materials.length}件）
              </span>
            )}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">まだ教材が登録されていません</p>
              <p className="text-xs mt-1">上のフォームからテキストを貼り付けてください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((m) => (
                <div
                  key={`${m.title}-${m.createdAt}`}
                  className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{m.title}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {m.subject}
                      {m.topic ? ` > ${m.topic}` : ""} ・
                      {m.totalChars.toLocaleString()}文字 ・
                      {m.totalChunks}チャンク ・
                      {new Date(m.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(m.title)}
                    disabled={deleting === m.title}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors shrink-0"
                  >
                    {deleting === m.title ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function MaterialsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      }
    >
      <MaterialsContent />
    </Suspense>
  );
}
