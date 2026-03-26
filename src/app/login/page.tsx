"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          トップに戻る
        </Link>

        <h1 className="text-3xl font-black mb-2">
          TENS<span className="text-[var(--color-accent)]">AKU</span>
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          メールアドレスでログイン・新規登録
        </p>

        {sent ? (
          <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-[var(--color-success)]" />
            </div>
            <h2 className="text-lg font-bold mb-2">メールを確認してください</h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <span className="text-[var(--color-text)] font-medium">{email}</span>
              にログインリンクを送信しました。
              メール内のリンクをクリックしてログインしてください。
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "送信中..." : "ログインリンクを送信"}
            </button>

            <p className="text-xs text-[var(--color-text-muted)] text-center">
              アカウントがない場合は自動的に作成されます
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
