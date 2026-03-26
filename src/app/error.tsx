"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">!</span>
        </div>
        <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-8 max-w-md">
          予期しないエラーが発生しました。問題が続く場合はお問い合わせください。
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-sm transition-colors"
        >
          再試行
        </button>
      </div>
    </main>
  );
}
