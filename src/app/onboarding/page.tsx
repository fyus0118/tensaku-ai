"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Loader2,
  CheckCircle,
  Calendar,
  Clock,
} from "lucide-react";
import { EXAM_CATEGORIES } from "@/lib/exams";
import { EXAM_ICON_MAP } from "@/components/ExamIcons";
import { createClient } from "@/lib/supabase/client";

type Step = 1 | 2 | 3 | "saving";

const SAVING_MESSAGES = [
  "あなたの情報を分析中...",
  "最適な学習プランを設計中...",
  "あなた専用の学習プランを作成中...",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedExam, setSelectedExam] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [error, setError] = useState("");
  const [savingMsg, setSavingMsg] = useState(0);

  const nationalExams = EXAM_CATEGORIES.filter((e) => e.isNational);
  const otherExams = EXAM_CATEGORIES.filter((e) => !e.isNational);

  useEffect(() => {
    if (step !== "saving") return;
    const interval = setInterval(() => {
      setSavingMsg((prev) => Math.min(prev + 1, SAVING_MESSAGES.length - 1));
    }, 800);
    return () => clearInterval(interval);
  }, [step]);

  const handleSave = async () => {
    setStep("saving");
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("ログインが必要です");
      setStep(3);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        target_exam: selectedExam || null,
        target_exam_date: examDate || null,
        daily_goal: dailyGoal,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("保存に失敗しました。再度お試しください。");
      setStep(3);
      return;
    }

    // 演出のため少し待つ
    await new Promise((r) => setTimeout(r, 2000));
    router.push("/dashboard");
  };

  const stepNumber = typeof step === "number" ? step : 3;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        {step !== "saving" && (
          <div className="flex items-center justify-center gap-3 mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    s < stepNumber
                      ? "bg-[var(--color-accent)] text-white"
                      : s === stepNumber
                        ? "border-2 border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {s < stepNumber ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-0.5 rounded-full transition-all ${
                      s < stepNumber ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm text-center">
            {error}
          </div>
        )}

        {/* Step 1: 試験選択 */}
        {step === 1 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-8 h-8 text-[var(--color-accent)]" />
              </div>
              <h1 className="text-3xl font-black mb-2">
                TENS<span className="text-[var(--color-accent)]">AKU</span>へようこそ
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                目標の試験を選んでください
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                国家試験・資格試験
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {nationalExams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => setSelectedExam(exam.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedExam === exam.id
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]"
                    }`}
                  >
                    {(() => { const IC = EXAM_ICON_MAP[exam.id]; return IC ? <IC className="w-6 h-6 text-[var(--color-accent)] mb-1" /> : null; })()}
                    <p className="text-sm font-bold">{exam.shortName}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {exam.subjects.length}科目
                    </p>
                    {selectedExam === exam.id && (
                      <CheckCircle className="w-4 h-4 text-[var(--color-accent)] mt-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                大学入試・レポート
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {otherExams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => setSelectedExam(exam.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedExam === exam.id
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]"
                    }`}
                  >
                    {(() => { const IC = EXAM_ICON_MAP[exam.id]; return IC ? <IC className="w-6 h-6 text-[var(--color-accent)] mb-1" /> : null; })()}
                    <p className="text-sm font-bold">{exam.shortName}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!selectedExam}
              className="w-full py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              次へ
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setSelectedExam("");
                handleSave();
              }}
              className="w-full text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              スキップしてダッシュボードへ
            </button>
          </div>
        )}

        {/* Step 2: 試験予定日 */}
        {step === 2 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-8 h-8 text-[var(--color-accent)]" />
              </div>
              <h1 className="text-2xl font-black mb-2">試験予定日</h1>
              <p className="text-[var(--color-text-secondary)]">
                試験日がわかっていれば入力してください（後からでも変更可能）
              </p>
            </div>

            <div className="max-w-sm mx-auto">
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] text-center text-lg transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)] font-medium transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {examDate ? "次へ" : "スキップ"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 学習目標 */}
        {step === 3 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-[var(--color-accent)]" />
              </div>
              <h1 className="text-2xl font-black mb-2">1日の学習目標</h1>
              <p className="text-[var(--color-text-secondary)]">
                無理のないペースを設定しましょう
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {[
                { min: 10, label: "10分", desc: "スキマ時間に" },
                { min: 20, label: "20分", desc: "通勤時間に" },
                { min: 30, label: "30分", desc: "毎日コツコツ" },
                { min: 60, label: "60分", desc: "本気モード" },
              ].map((opt) => (
                <button
                  key={opt.min}
                  onClick={() => setDailyGoal(opt.min)}
                  className={`p-5 rounded-xl border text-center transition-all ${
                    dailyGoal === opt.min
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]"
                  }`}
                >
                  <p className="text-2xl font-black">{opt.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{opt.desc}</p>
                  {dailyGoal === opt.min && (
                    <CheckCircle className="w-4 h-4 text-[var(--color-accent)] mx-auto mt-2" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)] font-medium transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                学習を始める
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Saving */}
        {step === "saving" && (
          <div className="text-center py-20 animate-fade-in">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--color-accent)] mx-auto mb-6" />
            <p className="text-lg text-[var(--color-text-secondary)]">
              {SAVING_MESSAGES[savingMsg]}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
