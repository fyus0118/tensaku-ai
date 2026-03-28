"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Mail } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"otp" | "password">("otp");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (mode === "password" && password) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signUpError) {
          setError(toJapaneseError(signUpError.message));
        } else {
          setSent(true);
        }
      } else {
        window.location.href = "/dashboard";
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(toJapaneseError(error.message));
      } else {
        setSent(true);
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

            {mode === "password" && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワード"
                  required={mode === "password"}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "送信中..." : mode === "password" ? "ログイン" : "ログインリンクを送信"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "otp" ? "password" : "otp")}
              className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {mode === "otp" ? "パスワードでログイン" : "メールリンクでログイン"}
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
