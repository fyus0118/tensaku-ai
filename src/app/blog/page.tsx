import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import { Calendar, Clock, ArrowRight, BookOpen, Sparkles, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "ブログ | 資格勉強を科学する",
  description:
    "認知科学・学習心理学に基づいた資格試験の勉強法を発信。テスト効果、分散学習、インターリービングなど、科学的に正しい学習法を具体的に解説。",
  openGraph: {
    title: "StudyEngines Blog | 資格勉強を科学する",
    description: "科学的に正しい勉強法で、資格試験に最短合格。",
  },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "勉強法": { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
  "メンタル": { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  "試験対策": { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  "データ": { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
};

function getCatColor(category: string) {
  return CATEGORY_COLORS[category] || { bg: "bg-neutral-50", text: "text-neutral-600", border: "border-neutral-200" };
}

export default function BlogIndex() {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pt-16">
        {/* ヒーロー */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 mesh-hero" />
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="relative max-w-5xl mx-auto px-6 py-20 sm:py-28">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold mb-6 animate-fade-in">
              <Sparkles className="w-3.5 h-3.5" />
              StudyEngines Blog
            </div>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.15] mb-5 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              資格勉強を、<br className="sm:hidden" />
              <span className="bg-gradient-to-r from-[var(--color-accent)] to-rose-400 bg-clip-text text-transparent">科学する</span>。
            </h1>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-xl leading-relaxed animate-fade-in" style={{ animationDelay: "0.2s" }}>
              認知科学・学習心理学に基づいた勉強法を発信。<br className="hidden sm:block" />
              エビデンスのある方法だけを、具体的に。
            </p>
            <div className="flex items-center gap-3 mt-8 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                <BookOpen className="w-4 h-4" />
                {posts.length}記事
              </div>
              <span className="text-[var(--color-border)]">·</span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                <TrendingUp className="w-4 h-4" />
                毎日更新
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
          {/* カテゴリフィルター */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-12">
              <span className="px-4 py-2 rounded-full bg-[var(--color-text)] text-white text-xs font-bold shadow-sm">
                すべて ({posts.length})
              </span>
              {categories.map((cat) => {
                const color = getCatColor(cat.name);
                return (
                  <span
                    key={cat.name}
                    className={`px-4 py-2 rounded-full ${color.bg} ${color.text} text-xs font-bold border ${color.border} cursor-default`}
                  >
                    {cat.name} ({cat.count})
                  </span>
                );
              })}
            </div>
          )}

          {posts.length === 0 && (
            <div className="text-center py-24">
              <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4 opacity-30" />
              <p className="text-[var(--color-text-muted)] text-lg">
                まだ記事がありません。近日公開予定です。
              </p>
            </div>
          )}

          {/* 最新記事（フィーチャード） */}
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="block group mb-14"
            >
              <article className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-accent)]/60 transition-all duration-500 hover:shadow-xl hover:shadow-[var(--color-accent)]/5">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-accent)] to-rose-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="p-8 sm:p-12">
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold">
                      <Sparkles className="w-3 h-3" />
                      最新記事
                    </span>
                    <span className={`px-3 py-1 rounded-full ${getCatColor(featured.category).bg} ${getCatColor(featured.category).text} text-xs font-bold`}>
                      {featured.category}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black mb-4 leading-snug group-hover:text-[var(--color-accent)] transition-colors duration-300">
                    {featured.title}
                  </h2>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6 max-w-2xl line-clamp-3">
                    {featured.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(featured.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {featured.readingTime}で読める
                      </span>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-sm text-[var(--color-accent)] font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-8px] group-hover:translate-x-0">
                      読む
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          )}

          {/* 記事一覧グリッド */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-6">
              {rest.map((post, i) => {
                const color = getCatColor(post.category);
                return (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="block group animate-fade-in"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <article className="h-full relative rounded-xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-accent)]/40 transition-all duration-400 hover:shadow-lg hover:shadow-neutral-200/50 hover:-translate-y-0.5">
                      <div className={`h-1 ${color.bg}`} />
                      <div className="p-6">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full ${color.bg} ${color.text} text-[11px] font-bold mb-4`}>
                          {post.category}
                        </span>
                        <h3 className="text-lg font-bold mb-2 leading-snug group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-5 line-clamp-2">
                          {post.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {post.readingTime}
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 mesh-hero" />
          <div className="relative max-w-3xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">
              科学的な勉強法を、<span className="text-[var(--color-accent)]">AIが実行する</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-8 max-w-lg mx-auto">
              この記事で紹介した勉強法を、StudyEnginesの3層AIが自動で実践。48試験対応。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-all shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 animate-pulse-glow"
            >
              無料で始める
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* フッター */}
        <footer className="border-t border-[var(--color-border)] py-8 text-center text-xs text-[var(--color-text-muted)]">
          <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
            <p>&copy; 2026 StudyEngines</p>
            <div className="flex gap-4">
              <Link href="/terms" className="hover:text-[var(--color-text)] transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-[var(--color-text)] transition-colors">プライバシー</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
