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
  ChevronRight,
  Layers,
  BarChart3,
  Flame,
  Settings,
  GraduationCap,
  HelpCircle,
  FileText,
  Zap,
} from "lucide-react";
import { EXAM_CATEGORIES, getExamById } from "@/lib/exams";
import { EXAM_ICON_MAP } from "@/components/ExamIcons";
import { getPrediction, generateStudyPath, type PassPrediction, type StudyPath } from "@/lib/adaptive-engine";
import ExamSwitcher from "@/components/ExamSwitcher";
import ExamCard from "@/components/ExamCard";

export const metadata: Metadata = {
  title: "ダッシュボード",
  description: "StudyEnginesの学習ダッシュボード。試験選択、学習モード、進捗確認。",
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
    } catch (err) {
      console.error("合格予測/学習パスの取得に失敗:", err);
    }
  }

  const EXAM_ICONS = EXAM_ICON_MAP;

  const examGroups = [
    { label: "法律系", desc: "弁護士・司法書士・行政書士など", ids: ["yobi-shihou", "shihou-shiken", "shihou-shoshi", "gyousei-shoshi", "sharoshi", "benri-shi", "business-law", "chizai", "kojin-joho"] },
    { label: "会計・財務系", desc: "会計士・税理士・簿記・FPなど", ids: ["kounin-kaikeishi", "zeirishi", "boki2", "boki3", "fp2", "gaimuin", "kashikin"] },
    { label: "経営・コンサルティング系", desc: "診断士・技術士・販売士など", ids: ["shindan-shi", "gijutsu-shi", "hanbaishi", "mental-health"] },
    { label: "不動産・建築系", desc: "宅建士・建築士・マンション管理など", ids: ["takken", "kenchiku-shi", "mankan", "chintai"] },
    { label: "IT・情報処理系", desc: "基本情報・応用情報・高度試験・クラウドなど", ids: ["it-passport", "sg", "kihon-jouhou", "ap", "st", "nw", "db", "aws", "python3"] },
    { label: "公務員系", desc: "国家一般職・地方上級など", ids: ["koumuin"] },
    { label: "医療・看護・福祉系", desc: "医師・看護師・保育士・登録販売者など", ids: ["ishi", "kangoshi", "touroku-hanbai", "hoiku-shi"] },
    { label: "安全・環境系", desc: "危険物取扱者など", ids: ["kikenbutsu"] },
    { label: "語学系", desc: "TOEIC・英語など", ids: ["toeic"] },
    { label: "大学・教育系", desc: "大学入試・レポートなど", ids: ["daigaku-nyushi", "daigaku-report"] },
  ];

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-black">
            Study<span className="text-[var(--color-accent)]">Engines</span>
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
            <Link
              href="/settings"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
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
            <div className="mb-6">
              <ExamSwitcher currentExamId={targetExam.id} currentExamName={targetExam.name} />
            </div>

            {/* ── インプット ── */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">インプット — 知識を入れる</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <Link href={`/study/chat?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">AIチューター <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">質問・解説・暗記法</p>
                  </div>
                </Link>
                <Link href={`/study/flashcards?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">暗記カード <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">間隔反復で定着</p>
                  </div>
                </Link>
                <Link href={`/study/practice?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">練習問題 <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">本番形式で無限生成</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* ── 深い理解 ── */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">深い理解 — 考えて身につける</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <Link href={`/study/teach?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border-2 border-amber-500/20 hover:border-amber-500/50 transition-colors group flex items-center gap-4 relative">
                  <div className="absolute top-2 right-3 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-bold">NEW</div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">教えてマスター <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-amber-600" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">AIに教えて理解を証明</p>
                  </div>
                </Link>
                <Link href={`/study/socratic?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-violet-500/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">ソクラテス式問答 <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-violet-500" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">問いで思考を深化</p>
                  </div>
                </Link>
                <Link href={`/study/case-study?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-emerald-500/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">ケーススタディ <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-emerald-500" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">事例で判断力を鍛える</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* ── 仕上げ ── */}
            <div className="mb-4">
              <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">仕上げ — 弱点を潰す</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <Link href={`/study/weakness?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-orange-500/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">弱点ドリル <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-orange-500" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">苦手を集中攻撃</p>
                  </div>
                </Link>
                <Link href={`/study/review?mode=essay&exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <PenTool className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">論述添削 <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">答案を即時採点</p>
                  </div>
                </Link>
                <Link href={`/study/analytics?exam=${targetExam.id}`}
                  className="p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors group flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm flex items-center gap-1">学習分析 <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" /></h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">弱点・正答率を可視化</p>
                  </div>
                </Link>
              </div>
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
                      {task.type === "practice" ? <Target className="w-5 h-5 text-[var(--color-accent)]" /> : task.type === "flashcard" ? <Layers className="w-5 h-5 text-[var(--color-accent)]" /> : task.type === "chat" ? <MessageCircle className="w-5 h-5 text-[var(--color-accent)]" /> : <PenTool className="w-5 h-5 text-[var(--color-accent)]" />}
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
          {examGroups.map((group) => {
            const exams = group.ids.map(id => EXAM_CATEGORIES.find(e => e.id === id)).filter(Boolean);
            if (exams.length === 0) return null;
            return (
              <div key={group.label} className="mb-6">
                <div className="mb-3">
                  <h3 className="text-sm font-bold">{group.label}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">{group.desc}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {exams.map((exam) => {
                    if (!exam) return null;
                    return (
                      <ExamCard
                        key={exam.id}
                        exam={exam}
                        isCurrent={targetExam?.id === exam.id}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
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
              <BarChart3 className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
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
