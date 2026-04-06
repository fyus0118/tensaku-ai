"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Calendar, Clock, ArrowRight, Search, ChevronDown, Sparkles, X } from "lucide-react";

interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readingTime: string;
  keywords: string[];
}

interface CategoryInfo {
  name: string;
  count: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "勉強法": { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
  "メンタル": { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  "試験対策": { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  "データ": { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
};

function getCatColor(category: string) {
  return CATEGORY_COLORS[category] || { bg: "bg-neutral-50", text: "text-neutral-600", border: "border-neutral-200" };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function getYearMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function BlogList({ posts, categories }: { posts: PostMeta[]; categories: CategoryInfo[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  // 月別アーカイブ
  const monthlyArchive = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) {
      const ym = getYearMonth(p.date);
      map.set(ym, (map.get(ym) || 0) + 1);
    }
    return [...map.entries()].map(([month, count]) => ({ month, count }));
  }, [posts]);

  // フィルタリング
  const filtered = useMemo(() => {
    let result = posts;

    if (activeCategory) {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (activeMonth) {
      result = result.filter((p) => getYearMonth(p.date) === activeMonth);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    return result;
  }, [posts, query, activeCategory, activeMonth]);

  const featured = !query && !activeCategory && !activeMonth ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

  const hasActiveFilter = !!query || !!activeCategory || !!activeMonth;

  return (
    <>
      {/* 検索 + フィルター */}
      <div className="mb-10 space-y-4">
        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="記事を検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-[var(--color-border)] bg-white text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/10 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <X className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>

        {/* カテゴリ + 月別 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setActiveCategory(null); setActiveMonth(null); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              !activeCategory && !activeMonth
                ? "bg-[var(--color-text)] text-white shadow-sm"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            すべて ({posts.length})
          </button>
          {categories.map((cat) => {
            const color = getCatColor(cat.name);
            const active = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => { setActiveCategory(active ? null : cat.name); setActiveMonth(null); }}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                  active
                    ? `${color.bg} ${color.text} ${color.border} ring-2 ring-current/20`
                    : `${color.bg} ${color.text} ${color.border} opacity-70 hover:opacity-100`
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            );
          })}

          {/* 月別アーカイブトグル */}
          {monthlyArchive.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs font-bold hover:bg-[var(--color-bg-hover)] transition-all"
              >
                <Calendar className="w-3 h-3" />
                {activeMonth || "月別"}
                <ChevronDown className={`w-3 h-3 transition-transform ${showArchive ? "rotate-180" : ""}`} />
              </button>
              {showArchive && (
                <div className="absolute top-full mt-2 left-0 z-20 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-2 min-w-[160px]">
                  <button
                    onClick={() => { setActiveMonth(null); setShowArchive(false); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-[var(--color-bg-secondary)] transition-colors ${
                      !activeMonth ? "text-[var(--color-accent)] font-bold" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    すべての月
                  </button>
                  {monthlyArchive.map((a) => (
                    <button
                      key={a.month}
                      onClick={() => { setActiveMonth(a.month); setShowArchive(false); setActiveCategory(null); }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-[var(--color-bg-secondary)] transition-colors ${
                        activeMonth === a.month ? "text-[var(--color-accent)] font-bold" : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {a.month} ({a.count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* アクティブフィルター表示 */}
        {hasActiveFilter && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>{filtered.length}件の記事</span>
            {(activeCategory || activeMonth) && (
              <button
                onClick={() => { setActiveCategory(null); setActiveMonth(null); setQuery(""); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                フィルターをクリア
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 結果なし */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-[var(--color-text-muted)]">
            {query ? `「${query}」に一致する記事が見つかりません` : "該当する記事がありません"}
          </p>
        </div>
      )}

      {/* フィーチャード */}
      {featured && (
        <Link href={`/blog/${featured.slug}`} className="block group mb-14">
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
                  読む <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </article>
        </Link>
      )}

      {/* 記事グリッド */}
      {rest.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-6">
          {rest.map((post, i) => {
            const color = getCatColor(post.category);
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block group animate-fade-in"
                style={{ animationDelay: `${i * 0.05}s` }}
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
    </>
  );
}
