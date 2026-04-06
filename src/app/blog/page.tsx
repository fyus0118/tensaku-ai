import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import { Calendar, Clock, ArrowRight, BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "ブログ | 資格勉強を科学する",
  description:
    "認知科学・学習心理学に基づいた資格試験の勉強法を発信。テスト効果、分散学習、インターリービングなど、科学的に正しい学習法を具体的に解説。",
  openGraph: {
    title: "StudyEngines Blog | 資格勉強を科学する",
    description: "科学的に正しい勉強法で、資格試験に最短合格。",
  },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pt-20">
        {/* ヒーロー */}
        <section className="border-b border-[var(--color-border)]">
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
            <div className="flex items-center gap-2 text-[var(--color-accent)] text-sm font-bold mb-4">
              <BookOpen className="w-4 h-4" />
              StudyEngines Blog
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              資格勉強を、<span className="text-[var(--color-accent)]">科学する</span>。
            </h1>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl">
              認知科学・学習心理学に基づいた勉強法を発信。
              テスト効果、分散学習、精緻化 —— 科学的に正しい方法で、最短合格を目指す。
            </p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-12">
          {/* カテゴリフィルター */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              <span className="px-3 py-1.5 rounded-full bg-[var(--color-text)] text-white text-xs font-bold">
                すべて ({posts.length})
              </span>
              {categories.map((cat) => (
                <span
                  key={cat.name}
                  className="px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs font-bold hover:bg-[var(--color-bg-hover)] transition-colors cursor-default"
                >
                  {cat.name} ({cat.count})
                </span>
              ))}
            </div>
          )}

          {posts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[var(--color-text-muted)] text-lg">
                まだ記事がありません。近日公開予定です。
              </p>
            </div>
          )}

          {/* 最新記事（大きく） */}
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="block group mb-12"
            >
              <article className="rounded-2xl border border-[var(--color-border)] p-8 sm:p-10 hover:border-[var(--color-accent)] transition-all duration-300 hover:shadow-lg">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="px-2.5 py-1 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold">
                    最新記事
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs font-bold">
                    {featured.category}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-3 group-hover:text-[var(--color-accent)] transition-colors">
                  {featured.title}
                </h2>
                <p className="text-[var(--color-text-secondary)] leading-relaxed mb-5 line-clamp-3">
                  {featured.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(featured.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {featured.readingTime}で読める
                  </span>
                </div>
              </article>
            </Link>
          )}

          {/* 記事一覧 */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-6">
              {rest.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block group"
                >
                  <article className="h-full rounded-xl border border-[var(--color-border)] p-6 hover:border-[var(--color-accent)]/50 transition-all duration-300 hover:shadow-md">
                    <span className="inline-block px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-[11px] font-bold mb-3">
                      {post.category}
                    </span>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4 line-clamp-2">
                      {post.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(post.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readingTime}
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-black mb-3">
              科学的な勉強法を、AIが実行する
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              この記事で紹介した勉強法を、StudyEnginesの3層AIが自動で実践します。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
            >
              無料で始める
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* フッター */}
        <footer className="border-t border-[var(--color-border)] py-8 text-center text-xs text-[var(--color-text-muted)]">
          <p>&copy; 2026 StudyEngines</p>
        </footer>
      </main>
    </>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
