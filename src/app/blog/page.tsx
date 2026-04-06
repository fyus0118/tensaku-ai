import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import { BookOpen, Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import { BlogList } from "./blog-list";

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

  // Client Componentに渡すため、contentを除外した軽量版
  const postMetas = posts.map(({ content, ...rest }) => rest);

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

        {/* 記事一覧（検索・フィルター・月別付き） */}
        <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
          <BlogList posts={postMetas} categories={categories} />
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
