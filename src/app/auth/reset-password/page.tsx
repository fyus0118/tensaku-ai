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
  const [initError, setInitError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      // ハッシュフラグメントからトークンを手動パース
      // Supabaseはimplicit flowで #access_token=xxx&refresh_token=xxx&type=recovery を付ける
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (accessToken && refreshToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setInitError("リンクが無効または期限切れです。もう一度パスワードリセットをお試しください。");
            return;
          }
          // ハッシュをURLから消す
          window.history.replaceState(null, "", window.location.pathname);
          setReady(true);
          return;
        }
      }

      // ハッシュがない場合、既存セッションを確認（設定ページからの遷移等）
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      } else {
        setInitError("セッションがありません。ログインページからパスワードリセットをお試しください。");
      }
    }

    init();
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
      if (error.message.includes("should be at least 6")) {
        setError("パスワードは6文字以上で入力してください");
      } else if (error.message.includes("same as") || error.message.includes("different")) {
        setError("以前と同じパスワードは使用できません。別のパスワードを入力してください");
      } else if (error.message.includes("session") || error.message.includes("token")) {
        setError("セッションが切れました。ログインページからもう一度パスワードリセットをお試しください");
      } else {
        setError("エラーが発生しました。しばらく待ってから再度お試しください");
      }
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

  if (initError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-black mb-4">エラー</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{initError}</p>
          <Link
            href="/login"
            className="inline-block py-3 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
          >
            ログインページへ
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
