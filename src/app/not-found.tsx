import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="text-7xl font-black text-[var(--color-accent)] mb-4">404</h1>
        <h2 className="text-xl font-bold mb-2">ページが見つかりません</h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-8 max-w-md">
          お探しのページは移動または削除された可能性があります。
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-sm transition-colors"
        >
          トップページに戻る
        </Link>
      </div>
    </main>
  );
}
