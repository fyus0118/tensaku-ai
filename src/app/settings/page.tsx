"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const res = await fetch("/api/auth/delete-account", { method: "POST" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("アカウント削除に失敗しました");
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          ダッシュボードに戻る
        </Link>

        <h1 className="text-3xl font-black mb-8">設定</h1>

        {/* アカウント削除 */}
        <section className="p-6 rounded-2xl border border-[var(--color-danger)]/20 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-danger)]/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
            </div>
            <h2 className="text-lg font-bold">アカウント削除</h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            アカウントを削除すると、全ての学習データが完全に削除されます。この操作は取り消せません。
          </p>
          {error && <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>}
          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="py-2 px-4 rounded-lg border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm font-medium hover:bg-[var(--color-danger)]/5 transition-colors"
            >
              アカウントを削除する
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="py-2 px-4 rounded-lg bg-[var(--color-danger)] text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? "削除中..." : "本当に削除する"}
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="py-2 px-4 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                キャンセル
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
