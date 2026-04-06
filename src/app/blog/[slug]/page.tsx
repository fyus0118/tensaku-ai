import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { Calendar, Clock, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "記事が見つかりません" };

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // 前後の記事
  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

  // 関連記事（同カテゴリ、最大3件）
  const related = allPosts
    .filter((p) => p.slug !== slug && p.category === post.category)
    .slice(0, 3);

  // JSON-LD構造化データ
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: "StudyEngines",
      url: "https://studyengines.com",
    },
    publisher: {
      "@type": "Organization",
      name: "StudyEngines",
    },
    keywords: post.keywords.join(", "),
  };

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen pt-20">
        {/* 記事ヘッダー */}
        <header className="border-b border-[var(--color-border)]">
          <div className="max-w-3xl mx-auto px-6 pt-8 pb-10">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              ブログに戻る
            </Link>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold">
                {post.category}
              </span>
              {post.exam && (
                <span className="px-2.5 py-1 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs font-bold">
                  {post.exam}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              {post.title}
            </h1>

            <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed mb-5">
              {post.description}
            </p>

            <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {post.readingTime}で読める
              </span>
            </div>
          </div>
        </header>

        {/* 記事本文 */}
        <article className="max-w-3xl mx-auto px-6 py-10">
          <div className="blog-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
        </article>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-6 pb-10">
          <div className="rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-8 text-center">
            <BookOpen className="w-8 h-8 text-[var(--color-accent)] mx-auto mb-3" />
            <h3 className="text-xl font-black mb-2">
              この記事の勉強法を、AIが自動で実践
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5 max-w-md mx-auto">
              StudyEnginesの3層AI（Mentor・Prism・Core）が、科学的に正しい学習法をあなたの試験勉強に組み込みます。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
            >
              無料で試してみる
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* 前後の記事 */}
        {(prevPost || nextPost) && (
          <nav className="max-w-3xl mx-auto px-6 pb-10">
            <div className="grid sm:grid-cols-2 gap-4">
              {prevPost && (
                <Link
                  href={`/blog/${prevPost.slug}`}
                  className="group rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-accent)]/50 transition-all"
                >
                  <span className="text-xs text-[var(--color-text-muted)]">← 前の記事</span>
                  <p className="text-sm font-bold mt-1 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                    {prevPost.title}
                  </p>
                </Link>
              )}
              {nextPost && (
                <Link
                  href={`/blog/${nextPost.slug}`}
                  className="group rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-accent)]/50 transition-all sm:text-right"
                >
                  <span className="text-xs text-[var(--color-text-muted)]">次の記事 →</span>
                  <p className="text-sm font-bold mt-1 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                    {nextPost.title}
                  </p>
                </Link>
              )}
            </div>
          </nav>
        )}

        {/* 関連記事 */}
        {related.length > 0 && (
          <section className="border-t border-[var(--color-border)]">
            <div className="max-w-3xl mx-auto px-6 py-10">
              <h3 className="text-lg font-black mb-5">関連記事</h3>
              <div className="space-y-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="flex items-start gap-4 group"
                  >
                    <span className="shrink-0 w-10 h-10 rounded-lg bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-text-muted)]">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-bold text-sm group-hover:text-[var(--color-accent)] transition-colors">
                        {r.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {formatDate(r.date)} · {r.readingTime}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

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
