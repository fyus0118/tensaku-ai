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

const EXAM_GROUPS = [
  { label: "法律系", ids: ["yobi-shihou", "shihou-shiken", "shihou-shoshi", "gyousei-shoshi", "sharoshi", "benri-shi", "business-law", "chizai", "kojin-joho"] },
  { label: "会計・財務系", ids: ["kounin-kaikeishi", "zeirishi", "boki2", "boki3", "fp2", "gaimuin", "kashikin"] },
  { label: "経営・コンサルティング系", ids: ["shindan-shi", "gijutsu-shi", "hanbaishi", "mental-health"] },
  { label: "不動産・建築系", ids: ["takken", "kenchiku-shi", "mankan", "chintai"] },
  { label: "IT・情報処理系", ids: ["it-passport", "sg", "kihon-jouhou", "ap", "st", "nw", "db", "aws", "python3"] },
  { label: "公務員系", ids: ["koumuin"] },
  { label: "医療・看護・福祉系", ids: ["ishi", "kangoshi", "touroku-hanbai", "hoiku-shi"] },
  { label: "安全・環境系", ids: ["kikenbutsu"] },
  { label: "語学系", ids: ["toeic"] },
  { label: "大学・教育系", ids: ["daigaku-nyushi", "daigaku-report"] },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [error, setError] = useState("");
  const [savingMsg, setSavingMsg] = useState(0);

  useEffect(() => {
    if (step !== "saving") return;
    const interval = setInterval(() => {
      setSavingMsg((prev) => Math.min(prev + 1, SAVING_MESSAGES.length - 1));
    }, 800);
    return () => clearInterval(interval);
  }, [step]);

  const toggleExam = (id: string) => {
    setSelectedExams(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

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
        target_exam: selectedExams[0] || null,
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
          <div className="space-y-8 animate-fade-in pb-24">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-8 h-8 text-[var(--color-accent)]" />
              </div>
              <h1 className="text-3xl font-black mb-2">
                Study<span className="text-[var(--color-accent)]">Engines</span>へようこそ
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                学習する試験を選んでください（複数選択可）
              </p>
            </div>

            {EXAM_GROUPS.map((group) => {
              const exams = group.ids.map(id => EXAM_CATEGORIES.find(e => e.id === id)).filter(Boolean);
              if (exams.length === 0) return null;
              return (
                <div key={group.label}>
                  <h3 className="text-sm font-bold mb-3">{group.label}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {exams.map((exam) => {
                      if (!exam) return null;
                      const IC = EXAM_ICON_MAP[exam.id];
                      const isSelected = selectedExams.includes(exam.id);
                      const selectIndex = selectedExams.indexOf(exam.id);
                      return (
                        <button
                          key={exam.id}
                          onClick={() => !exam.comingSoon && toggleExam(exam.id)}
                          disabled={exam.comingSoon}
                          className={`p-4 rounded-xl border text-left transition-all relative ${
                            exam.comingSoon
                              ? "border-[var(--color-border)] bg-[var(--color-bg-card)] opacity-50 cursor-not-allowed"
                              : isSelected
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]"
                                : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]"
                          }`}
                        >
                          {exam.comingSoon && (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[9px] font-bold text-[var(--color-text-muted)]">
                              Coming Soon
                            </div>
                          )}
                          {isSelected && !exam.comingSoon && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold flex items-center justify-center">
                              {selectIndex + 1}
                            </div>
                          )}
                          {IC && <IC className={`w-6 h-6 mb-1 ${exam.comingSoon ? "text-[var(--color-text-muted)]" : "text-[var(--color-accent)]"}`} />}
                          <p className="text-sm font-bold leading-tight">{exam.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {exam.subjects.length}科目
                            {exam.examMonth ? ` / ${exam.examMonth}月試験` : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* 選択中の資格の概要を展開表示 */}
                  {exams.map((exam) => {
                    if (!exam || !selectedExams.includes(exam.id)) return null;
                    return (
                      <div key={`detail-${exam.id}`} className="mt-3 p-5 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 animate-fade-in">
                        <p className="text-sm font-bold mb-1">{exam.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-3">{exam.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {exam.subjects.map((s) => (
                            <span key={s.id} className="px-2 py-0.5 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]">
                              {s.name}
                            </span>
                          ))}
                        </div>
                        {exam.hasEssay && (
                          <p className="text-[10px] text-[var(--color-accent)] mt-2 font-medium">論述式あり — 添削モード対応</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

          </div>
        )}

        {/* Step 1: 固定フッター */}
        {step === 1 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg)]/95 backdrop-blur-sm border-t border-[var(--color-border)] px-6 py-4 z-50">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedExams([]);
                  handleSave();
                }}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] shrink-0"
              >
                スキップ
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={selectedExams.length === 0}
                className="flex-1 py-3.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {selectedExams.length > 0 ? `${selectedExams.length}件選択中 — 次へ` : "試験を選択してください"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
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
