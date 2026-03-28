"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TENSAKU Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          予期しないエラーが発生しました。再度お試しください。
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          再試行
        </button>
      </div>
    </div>
  );
}
