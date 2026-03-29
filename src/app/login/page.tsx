"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

function toJapaneseError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "メールアドレスまたはパスワードが正しくありません",
    "User already registered": "このメールアドレスは既に登録されています",
    "Email not confirmed": "メールアドレスが確認されていません。受信箱を確認してください",
    "Signup requires a valid password": "パスワードを入力してください",
    "Password should be at least 6 characters": "パスワードは6文字以上で入力してください",
    "Email rate limit exceeded": "送信回数の上限に達しました。しばらく待ってから再度お試しください",
    "For security purposes, you can only request this after": "セキュリティのため、しばらく待ってから再度お試しください",
  };
  for (const [en, ja] of Object.entries(map)) {
    if (msg.includes(en)) return ja;
  }
  return "エラーが発生しました。しばらく待ってから再度お試しください";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"login" | "signup" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (tab === "reset") {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      console.log("[reset] API response:", data);
      if (data.error) {
        setError(data.error + (data.debug ? ` (${data.debug})` : ""));
      } else if (data.fallback && data.action_link) {
        // レート制限時はリンクに直接遷移
        window.location.href = data.action_link;
        return;
      } else {
        setResetSent(true);
      }
    } else if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(toJapaneseError(error.message));
      } else {
        window.location.href = "/dashboard";
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://studyengines.com"}/auth/callback` },
      });
      if (error) {
        setError(toJapaneseError(error.message));
      } else if (data.session) {
        // メール確認不要の場合（Confirm emailがOFFの場合）
        window.location.href = "/dashboard";
        return;
      } else {
        // メール確認が必要
        setSignupSent(true);
      }
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

        <h1 className="text-3xl font-black mb-8">
          Study<span className="text-[var(--color-accent)]">Engines</span>
        </h1>

        {/* タブ切り替え */}
        <div className="flex rounded-xl bg-[var(--color-bg-secondary)] p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "login"
                ? "bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <LogIn className="w-4 h-4" />
            ログイン
          </button>
          <button
            type="button"
            onClick={() => { setTab("signup"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "signup"
                ? "bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            新規登録
          </button>
        </div>

        {signupSent ? (
          <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
            <h2 className="text-lg font-bold mb-2">確認メールを送信しました</h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
              <span className="text-[var(--color-text)] font-medium">{email}</span>
              に確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。
            </p>
            <button
              type="button"
              onClick={() => { setTab("login"); setSignupSent(false); setError(""); }}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              ログインに戻る
            </button>
          </div>
        ) : tab === "reset" ? (
          resetSent ? (
            <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <h2 className="text-lg font-bold mb-2">メールを送信しました</h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
                <span className="text-[var(--color-text)] font-medium">{email}</span>
                にパスワードリセットのリンクを送信しました。メールを確認してください。
              </p>
              <button
                type="button"
                onClick={() => { setTab("login"); setResetSent(false); setError(""); }}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                ログインに戻る
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                登録したメールアドレスを入力してください。パスワードリセットのリンクを送信します。
              </p>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
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
                {loading ? "送信中..." : "リセットリンクを送信"}
              </button>
              <button
                type="button"
                onClick={() => { setTab("login"); setError(""); }}
                className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                ログインに戻る
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "6文字以上" : "パスワード"}
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
              {loading ? "処理中..." : tab === "login" ? "ログイン" : "新規登録"}
            </button>

            {tab === "login" && (
              <button
                type="button"
                onClick={() => { setTab("reset"); setError(""); }}
                className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                パスワードを忘れた方はこちら
              </button>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
