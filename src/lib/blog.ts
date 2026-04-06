/**
 * ブログ記事のロード・管理
 * content/blog/ ディレクトリのMarkdownファイルを読み込む
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

const BLOG_DIR = join(process.cwd(), "content/blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  keywords: string[];
  category: string;
  exam?: string;
  published: boolean;
  content: string;
  readingTime: string;
}

export function getAllPosts(): BlogPost[] {
  try {
    const files = readdirSync(BLOG_DIR).filter(f => f.endsWith(".md"));
    return files
      .map(file => getPostBySlug(file.replace(/\.md$/, "")))
      .filter((p): p is BlogPost => p !== null && p.published)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const filePath = join(BLOG_DIR, `${slug}.md`);
    const raw = readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const rt = readingTime(content);

    return {
      slug,
      title: data.title || slug,
      description: data.description || "",
      date: data.date || new Date().toISOString().split("T")[0],
      keywords: data.keywords || [],
      category: data.category || "勉強法",
      exam: data.exam,
      published: data.published !== false,
      content,
      readingTime: `${Math.ceil(rt.minutes)}分`,
    };
  } catch {
    return null;
  }
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter(p => p.category === category);
}

export function getAllCategories(): { name: string; count: number }[] {
  const posts = getAllPosts();
  const map = new Map<string, number>();
  for (const p of posts) {
    map.set(p.category, (map.get(p.category) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
