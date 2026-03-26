import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  Crown,
  MessageCircle,
  Target,
  PenTool,
  TrendingUp,
  ChevronRight,
  Layers,
  BarChart3,
  Flame,
} from "lucide-react";
import { EXAM_CATEGORIES, getExamById } from "@/lib/exams";
import { getPrediction, generateStudyPath, type PassPrediction, type StudyPath } from "@/lib/adaptive-engine";

export const metadata: Metadata = {
  title: "ダッシュボード",
  description: "TENSAKUの学習ダッシュボード。試験選択、学習モード、進捗確認。",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isPro = profile?.plan === "pro";
  const freeLeft =
    (profile?.free_reviews_limit ?? 3) - (profile?.free_reviews_used ?? 0);
  const targetExam = profile?.target_exam
    ? getExamById(profile.target_exam)
    : null;

  // 最近の学習履歴
  const { data: recentReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // 合格予測 + 学習パス
  let prediction: PassPrediction | null = null;
  let studyPath: StudyPath | null = null;
  if (profile?.target_exam) {
    try {
      [prediction, studyPath] = await Promise.all([
        getPrediction(supabase, user.id, profile.target_exam),
        generateStudyPath(supabase, user.id, profile.target_exam),
      ]);
    } catch {
      // DB未構築時はスキップ
    }
  }

  const nationalExams = EXAM_CATEGORIES.filter((e) => e.isNational);
  const otherExams = EXAM_CATEGORIES.filter((e) => !e.isNational);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-black">
            TENS<span className="text-[var(--color-accent)]">AKU</span>
          </Link>
          <div className="flex items-center gap-4">
            {isPro ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold">
                <Crown className="w-3 h-3" />
                PRO
              </span>
            ) : (
              <Link
                href="/api/stripe/checkout"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                <Crown className="w-3 h-3" />
                プロにアップグレード
              </Link>
            )}
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Status */}
        {!isPro && (
          <div className="mb-8 p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">
              無料プラン — 残り
              <span className="text-[var(--color-text)] font-bold mx-1">
                {freeLeft}
              </span>
              回
            </p>
            <Link
              href="/api/stripe/checkout"
              className="text-sm text-[var(--color-accent)] font-medium hover:underline"
            >
              無制限にする →
            </Link>
          </div>
        )}

        {/* Study Modes (shown when exam is selected) */}
        {targetExam && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <span className="text-3xl">{targetExam.icon}</span>
                {targetExam.shortName}
              </h2>
              <button
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                試験を変更
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* AI Tutor */}
              <Link
                href={`/study/chat?exam=${targetExam.id}`}
                className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  AIチューター
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  質問・解説・暗記法・学習計画
                </p>
              </Link>

              {/* Practice */}
              <Link
                href={`/study/practice?exam=${targetExam.id}`}
                className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  練習問題
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  本番形式の問題を無限に生成
                </p>
              </Link>

              {/* Review (Essay) */}
              {targetExam.hasEssay && (
                <Link
                  href={`/study/review?mode=essay&exam=${targetExam.id}`}
                  className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                    <PenTool className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                    論述添削
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    答案を即時採点・添削
                  </p>
                </Link>
              )}

              {/* Flashcards */}
              <Link
                href={`/study/flashcards?exam=${targetExam.id}`}
                className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                  <Layers className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  暗記カード
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  AI生成 + 間隔反復で定着
                </p>
              </Link>

              {/* Analytics */}
              <Link
                href={`/study/analytics?exam=${targetExam.id}`}
                className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  学習分析
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  弱点・正答率・進捗を可視化
                </p>
              </Link>
            </div>

            {/* Streak */}
            {(profile?.current_streak ?? 0) > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 flex items-center gap-3">
                <Flame className="w-6 h-6 text-[var(--color-warning)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-warning)]">
                    {profile?.current_streak}日連続学習中！
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    最長記録: {profile?.longest_streak || 0}日
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 合格予測 */}
        {prediction && prediction.subjectScores.length > 0 && targetExam && (
          <section className="mb-12">
            <h2 className="text-2xl font-black mb-6">合格予測</h2>

            {/* Overall Score */}
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">総合スコア</p>
                <p className="text-4xl font-black" style={{
                  color: prediction.overallScore >= 70 ? "var(--color-success)" : prediction.overallScore >= 50 ? "var(--color-warning)" : "var(--color-danger)"
                }}>
                  {prediction.overallScore}<span className="text-lg text-[var(--color-text-muted)]">%</span>
                </p>
              </div>
              <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">合格確率</p>
                <p className="text-4xl font-black" style={{
                  color: prediction.passProbability >= 70 ? "var(--color-success)" : prediction.passProbability >= 40 ? "var(--color-warning)" : "var(--color-danger)"
                }}>
                  {prediction.passProbability}<span className="text-lg text-[var(--color-text-muted)]">%</span>
                </p>
              </div>
              <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {studyPath?.daysUntilExam !== null ? "試験まで" : "追加演習目安"}
                </p>
                <p className="text-4xl font-black text-[var(--color-text)]">
                  {studyPath?.daysUntilExam != null ? (
                    <>{studyPath!.daysUntilExam}<span className="text-lg text-[var(--color-text-muted)]">日</span></>
                  ) : (
                    <>{prediction!.questionsNeeded}<span className="text-lg text-[var(--color-text-muted)]">問</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Recommendation */}
            <div className="p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 mb-6">
              <p className="text-sm text-[var(--color-text-secondary)]">
                <span className="font-bold text-[var(--color-accent)]">AI分析：</span>
                {prediction.recommendation}
              </p>
            </div>

            {/* Subject Scores */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {prediction.subjectScores.filter(s => s.questionsAnswered > 0).map((s) => (
                <div key={s.subject} className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{s.subject}</p>
                    <span className="text-xs text-[var(--color-text-muted)]">{s.questionsAnswered}問</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black" style={{
                      color: s.isAbovePassLine ? "var(--color-success)" : "var(--color-danger)"
                    }}>
                      {s.accuracy}%
                    </span>
                    <span className="text-xs mb-1" style={{
                      color: s.gapToPassLine >= 0 ? "var(--color-success)" : "var(--color-danger)"
                    }}>
                      {s.gapToPassLine >= 0 ? `+${s.gapToPassLine}` : s.gapToPassLine}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, s.accuracy)}%`,
                        backgroundColor: s.isAbovePassLine ? "var(--color-success)" : "var(--color-danger)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 今日のタスク */}
        {studyPath && studyPath.dailyTasks.length > 0 && targetExam && (
          <section className="mb-12">
            <h2 className="text-2xl font-black mb-6">今日やるべきこと</h2>
            <div className="space-y-3">
              {studyPath.dailyTasks.map((task, i) => (
                <Link
                  key={i}
                  href={
                    task.type === "practice" ? `/study/practice?exam=${targetExam.id}` :
                    task.type === "flashcard" ? `/study/flashcards?exam=${targetExam.id}` :
                    task.type === "chat" ? `/study/chat?exam=${targetExam.id}&subject=${encodeURIComponent(task.subject)}` :
                    `/study/review?exam=${targetExam.id}`
                  }
                  className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <span className="text-lg">
                      {task.type === "practice" ? "🎯" : task.type === "flashcard" ? "🃏" : task.type === "chat" ? "💬" : "✏️"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {task.type === "practice" ? "練習問題" : task.type === "flashcard" ? "暗記カード復習" : task.type === "chat" ? "AIに質問" : "添削"}
                      {task.subject !== "復習" && ` — ${task.subject}`}
                      {task.topic && ` > ${task.topic}`}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{task.reason}</p>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] shrink-0">
                    ~{task.estimatedMinutes}分
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              ))}
            </div>

            {/* 週間目標 */}
            {studyPath.weeklyGoals.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-[var(--color-text-muted)] mb-3">今週の目標</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {studyPath.weeklyGoals.map((goal) => (
                    <div key={goal.subject} className="p-3 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                      <p className="text-xs font-medium mb-1">{goal.subject}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {goal.currentAccuracy}% → {goal.targetAccuracy}%（あと{goal.questionsToSolve}問）
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Exam Selection */}
        <section className="mb-12">
          <h2 className="text-2xl font-black mb-6">
            {targetExam ? "他の試験も学習する" : "試験を選んで学習開始"}
          </h2>

          {/* National Exams */}
          <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            国家試験・資格試験
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {nationalExams.map((exam) => (
              <Link
                key={exam.id}
                href={`/study/chat?exam=${exam.id}`}
                className={`p-4 rounded-xl border transition-colors hover:border-[var(--color-accent)]/30 ${
                  targetExam?.id === exam.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                    : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
                }`}
              >
                <span className="text-2xl mb-2 block">{exam.icon}</span>
                <p className="text-sm font-bold">{exam.shortName}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {exam.subjects.length}科目
                  {exam.examMonth && ` / ${exam.examMonth}月試験`}
                </p>
              </Link>
            ))}
          </div>

          {/* University Exams */}
          <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            大学入試・レポート
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {otherExams.map((exam) => (
              <Link
                key={exam.id}
                href={
                  exam.id === "daigaku-nyushi"
                    ? "/study/review?mode=essay"
                    : "/study/review?mode=report"
                }
                className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors"
              >
                <span className="text-2xl mb-2 block">{exam.icon}</span>
                <p className="text-sm font-bold">{exam.shortName}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {exam.description.slice(0, 20)}...
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Account Settings */}
        <section className="mb-12">
          <h2 className="text-2xl font-black mb-6">アカウント</h2>
          <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  プラン: {isPro ? "プロ" : "無料"}
                </p>
              </div>
              {isPro && (
                <Link
                  href="/api/stripe/portal"
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  サブスクリプション管理
                </Link>
              )}
            </div>
            <div className="border-t border-[var(--color-border)] pt-4">
              <details className="group">
                <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-danger)] transition-colors">
                  アカウントを削除する
                </summary>
                <div className="mt-4 p-4 rounded-xl bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20">
                  <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                    アカウントを削除すると、全ての学習データ・会話履歴・添削結果が完全に削除されます。この操作は取り消せません。
                  </p>
                  <form action="/api/auth/delete-account" method="POST">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      アカウントを完全に削除する
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-2xl font-black mb-6">学習履歴</h2>
          {recentReviews && recentReviews.length > 0 ? (
            <div className="space-y-3">
              {recentReviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                      <PenTool className="w-5 h-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {review.document_type || "添削"}
                        {review.target_university &&
                          ` — ${review.target_university}`}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Date(review.created_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                  </div>
                  {review.score !== null && (
                    <span
                      className="text-xl font-black"
                      style={{
                        color:
                          review.score >= 80
                            ? "var(--color-success)"
                            : review.score >= 60
                              ? "var(--color-warning)"
                              : "var(--color-danger)",
                      }}
                    >
                      {review.score}
                      <span className="text-xs text-[var(--color-text-muted)]">
                        /100
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center">
              <TrendingUp className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
              <p className="text-[var(--color-text-secondary)] mb-2">
                まだ学習履歴がありません
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                上の試験を選んで、学習を始めましょう
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
