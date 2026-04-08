import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { Calendar, Clock, ArrowLeft, ArrowRight, BookOpen, Share2, Sparkles } from "lucide-react";
import { ReadingProgress } from "./reading-progress";
import { TableOfContents } from "./table-of-contents";

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

  const url = `https://studyengines.com/blog/${slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      url,
      images: [`/api/og?title=${encodeURIComponent(post.title)}`],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`/api/og?title=${encodeURIComponent(post.title)}`],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

  const related = allPosts
    .filter((p) => p.slug !== slug && p.category === post.category)
    .slice(0, 3);

  // 目次用の見出し抽出
  const headings = extractHeadings(post.content);

  const articleUrl = `https://studyengines.com/blog/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    image: `https://studyengines.com/api/og?title=${encodeURIComponent(post.title)}`,
    author: { "@type": "Organization", name: "StudyEngines", url: "https://studyengines.com" },
    publisher: {
      "@type": "Organization",
      name: "StudyEngines",
      url: "https://studyengines.com",
      logo: { "@type": "ImageObject", url: "https://studyengines.com/icon-192.png" },
    },
    keywords: post.keywords.join(", "),
    wordCount: post.content.length,
    inLanguage: "ja",
  };

  const shareUrl = `https://studyengines.com/blog/${slug}`;
  const shareText = `${post.title} | StudyEngines Blog`;

  return (
    <>
      <SiteHeader />
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen pt-16">
        {/* 記事ヘッダー */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 mesh-hero opacity-50" />
          <div className="relative max-w-3xl mx-auto px-6 pt-12 pb-12">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              ブログに戻る
            </Link>

            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="px-3 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold">
                {post.category}
              </span>
              {post.exam && (
                <span className="px-3 py-1 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs font-bold">
                  {post.exam}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black leading-[1.2] mb-5">
              {post.title}
            </h1>

            <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed mb-6">
              {post.description}
            </p>

            <div className="flex items-center justify-between">
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
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/30 transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                シェア
              </a>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
        </header>

        {/* 本文エリア */}
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="lg:flex lg:gap-10">
            {/* 記事本文 */}
            <article className="flex-1 min-w-0">
              {/* 目次 */}
              {headings.length > 2 && (
                <TableOfContents headings={headings} />
              )}

              <div className="blog-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => {
                      const text = String(children);
                      const id = text.toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-").replace(/^-|-$/g, "");
                      return <h2 id={id}>{children}</h2>;
                    },
                    h3: ({ children }) => {
                      const text = String(children);
                      const id = text.toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-").replace(/^-|-$/g, "");
                      return <h3 id={id}>{children}</h3>;
                    },
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>

              {/* タグ */}
              {post.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-[var(--color-border)]">
                  {post.keywords.map((kw) => (
                    <span key={kw} className="px-3 py-1 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-xs">
                      #{kw}
                    </span>
                  ))}
                </div>
              )}

              {/* シェアバー */}
              <div className="flex items-center gap-3 mt-6 p-4 rounded-xl bg-[var(--color-bg-secondary)]">
                <span className="text-sm text-[var(--color-text-muted)]">この記事が参考になったら</span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
                >
                  <XIcon />
                  ポスト
                </a>
              </div>
            </article>
          </div>
        </div>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-6 pb-12">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] to-rose-500" />
            <div className="absolute inset-0 grid-pattern opacity-10" />
            <div className="relative p-8 sm:p-10 text-center text-white">
              <Sparkles className="w-8 h-8 mx-auto mb-4 opacity-80" />
              <h3 className="text-xl sm:text-2xl font-black mb-3">
                この勉強法を、AIが自動で実践
              </h3>
              <p className="text-sm opacity-90 mb-6 max-w-md mx-auto">
                StudyEnginesの3層AI（Mentor・Prism・Core）が、科学的に正しい学習法をあなたの試験勉強に組み込みます。48試験対応。
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-[var(--color-accent)] font-bold hover:bg-neutral-50 transition-colors shadow-lg"
              >
                無料で試してみる
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* 前後の記事 */}
        {(prevPost || nextPost) && (
          <nav className="max-w-3xl mx-auto px-6 pb-12">
            <div className="grid sm:grid-cols-2 gap-4">
              {prevPost && (
                <Link
                  href={`/blog/${prevPost.slug}`}
                  className="group rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-accent)]/40 hover:shadow-md transition-all"
                >
                  <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    前の記事
                  </span>
                  <p className="text-sm font-bold mt-2 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                    {prevPost.title}
                  </p>
                </Link>
              )}
              {nextPost && (
                <Link
                  href={`/blog/${nextPost.slug}`}
                  className="group rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-accent)]/40 hover:shadow-md transition-all sm:text-right"
                >
                  <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 sm:justify-end">
                    次の記事
                    <ArrowRight className="w-3 h-3" />
                  </span>
                  <p className="text-sm font-bold mt-2 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                    {nextPost.title}
                  </p>
                </Link>
              )}
            </div>
          </nav>
        )}

        {/* 関連記事 */}
        {related.length > 0 && (
          <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div className="max-w-3xl mx-auto px-6 py-12">
              <h3 className="text-lg font-black mb-6">関連記事</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group rounded-xl bg-white border border-[var(--color-border)] p-5 hover:border-[var(--color-accent)]/30 hover:shadow-md transition-all"
                  >
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {r.category}
                    </span>
                    <p className="font-bold text-sm mt-2 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                      {r.title}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {r.readingTime}で読める
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

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

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function extractHeadings(content: string): { id: string; text: string; level: number }[] {
  const matches = content.matchAll(/^(#{2,3})\s+(.+)$/gm);
  return [...matches].map((m) => ({
    id: m[2].toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-").replace(/^-|-$/g, ""),
    text: m[2],
    level: m[1].length,
  }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
