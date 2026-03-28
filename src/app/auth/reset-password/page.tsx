"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // URLにcodeがある場合、exchangeCodeForSessionでセッションを確立
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError("リンクが無効または期限切れです。もう一度パスワードリセットをお試しください。");
        } else {
          setReady(true);
        }
      });
    } else {
      // codeがない場合、既にセッションがあるか確認（hash fragment flow）
      supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      });
      // 既にログイン済みの場合
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(
        error.message.includes("should be at least 6")
          ? "パスワー��は6文字以上で入力してください"
          : "エラーが発生しました。しばらく待ってから再度お試しください"
      );
    } else {
      setDone(true);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-[var(--color-accent)]" />
          </div>
          <h1 className="text-2xl font-black mb-2">パスワードを変更しました</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            新しいパスワードでログインできます。
          </p>
          <Link
            href="/dashboard"
            className="inline-block py-3 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
          >
            ダッシュボードへ
          </Link>
        </div>
      </main>
    );
  }

  if (error && !ready) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-black mb-4">リンクが無効です</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{error}</p>
          <Link
            href="/login"
            className="inline-block py-3 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
          >
            ログインに戻る
          </Link>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-[var(--color-text-muted)]">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black mb-2">
          Study<span className="text-[var(--color-accent)]">Engines</span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8">
          新しいパスワードを入力してください。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              新しいパスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-2">
              パスワード確認
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="もう一度入力"
              required
              minLength={6}
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
            {loading ? "変更中..." : "パスワードを変更"}
          </button>
        </form>
      </div>
    </main>
  );
}
