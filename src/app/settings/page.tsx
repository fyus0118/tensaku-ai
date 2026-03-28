"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Lock, Trash2 } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirm) {
      setError("新しいパスワードが一致しません");
      return;
    }

    if (newPassword.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 現在のパスワードで再認証（Secure password change対応）
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setError("現在のパスワードが正しくありません");
      setLoading(false);
      return;
    }

    // 再認証成功 → パスワード更新
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      if (updateError.message.includes("same as") || updateError.message.includes("different")) {
        setError("現在と同じパスワードは設定できません");
      } else {
        setError("パスワードの変更に失敗しました。しばらく待ってから再度お試しください");
      }
    } else {
      setSuccess("パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    }
    setLoading(false);
  };

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

        {/* パスワード変更 */}
        <section className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <h2 className="text-lg font-bold">パスワード変更</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium mb-2">
                現在のパスワード
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="現在のパスワード"
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium mb-2">
                新しいパスワード
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6文字以上"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
                新しいパスワード(確認)
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="もう一度入力"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors"
              />
            </div>

            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            {success && <p className="text-sm text-[var(--color-accent)]">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="py-3 px-6 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "変更中..." : "パスワードを変更"}
            </button>
          </form>
        </section>

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
