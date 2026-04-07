import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  ExternalLink,
  FileText,
  Layers3,
  MessageCircle,
  Pencil,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMaterialDetailForUser } from "@/lib/materials-store";
import { getExamById } from "@/lib/exams";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MaterialReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const material = await getMaterialDetailForUser(supabase, user.id, decodeURIComponent(id));
  if (!material) {
    notFound();
  }

  const exam = getExamById(material.examId);

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={`/study/materials?exam=${material.examId}`}
              className="rounded-lg p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-[11px] font-bold text-teal-600">
                  マイ教材
                </span>
                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                  {material.subject}
                </span>
                {material.topic && (
                  <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                    {material.topic}
                  </span>
                )}
              </div>
              <h1 className="truncate text-lg font-black">{material.title}</h1>
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                {exam?.name || material.examId}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href={`/study/materials?exam=${material.examId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
            >
              <Pencil className="h-4 w-4" />
              ライブラリで編集
            </Link>
            <Link
              href={`/study/chat?exam=${material.examId}&subject=${encodeURIComponent(material.subject)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <MessageCircle className="h-4 w-4" />
              AIに質問
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <h2 className="text-sm font-bold">教材情報</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between gap-3">
                <span>文字数</span>
                <span className="font-medium text-[var(--color-text)]">
                  {material.totalChars.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>読了目安</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-text)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  約{material.readMinutes}分
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>チャンク数</span>
                <span className="font-medium text-[var(--color-text)]">{material.totalChunks}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>更新日</span>
                <span className="font-medium text-[var(--color-text)]">{formatDate(material.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-bold">セクション</h2>
            </div>
            <div className="mt-4 space-y-3">
              {material.sections.map((section) => (
                <div key={section.id} className="rounded-2xl bg-[var(--color-bg-secondary)] p-3">
                  <p className="text-sm font-medium">{section.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {section.preview}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <h2 className="text-sm font-bold">この教材でできること</h2>
            <div className="mt-4 grid gap-2">
              <Link
                href={`/study/chat?exam=${material.examId}&subject=${encodeURIComponent(material.subject)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
              >
                <MessageCircle className="h-4 w-4" />
                Mentorで質問
              </Link>
              <Link
                href={`/study/practice?exam=${material.examId}&subject=${encodeURIComponent(material.subject)}${material.topic ? `&topic=${encodeURIComponent(material.topic)}` : ""}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
              >
                <Target className="h-4 w-4" />
                この範囲で問題を作る
              </Link>
              <Link
                href={`/study/textbook?exam=${material.examId}&source=my`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
              >
                <ExternalLink className="h-4 w-4" />
                教材ビュー一覧へ戻る
              </Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 sm:p-8">
            <div className="mb-8 border-b border-[var(--color-border)] pb-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-600">
                <FileText className="h-3.5 w-3.5" />
                あなた専用の教材本文
              </div>
              <h2 className="text-2xl font-black leading-tight sm:text-3xl">{material.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
                登録した教材はこの画面で読み返せるだけでなく、MentorやPractice生成時の参考資料としても使われます。
              </p>
            </div>

            <article className="textbook-content prose prose-neutral max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{material.content}</ReactMarkdown>
            </article>

            <div className="mt-10 flex flex-col gap-3 border-t border-[var(--color-border)] pt-6 sm:flex-row">
              <Link
                href={`/study/chat?exam=${material.examId}&subject=${encodeURIComponent(material.subject)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                <MessageCircle className="h-4 w-4" />
                この教材について質問する
              </Link>
              <Link
                href={`/study/practice?exam=${material.examId}&subject=${encodeURIComponent(material.subject)}${material.topic ? `&topic=${encodeURIComponent(material.topic)}` : ""}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
              >
                <Target className="h-4 w-4" />
                この教材から問題を作る
              </Link>
              <Link
                href={`/study/materials?exam=${material.examId}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
              >
                <BookOpen className="h-4 w-4" />
                ライブラリに戻る
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
