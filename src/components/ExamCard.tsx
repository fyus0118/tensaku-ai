"use client";

import { useState } from "react";
import { ArrowRight, X, Target, Calendar, Clock, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExamCategory } from "@/lib/exams";
import { EXAM_ICON_MAP } from "@/components/ExamIcons";

export default function ExamCard({ exam, isCurrent }: { exam: ExamCategory; isCurrent: boolean }) {
  const [showDetail, setShowDetail] = useState(false);
  const [step, setStep] = useState<"overview" | "plan">("overview");
  const [examDate, setExamDate] = useState("");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const Icon = EXAM_ICON_MAP[exam.id] || Target;

  const handleConfirm = async () => {
    if (isCurrent) { setShowDetail(false); return; }
    setSwitching(true);
    await fetch(`/api/select-exam?exam=${exam.id}&date=${examDate || ""}&goal=${dailyGoal}`, {
      headers: { accept: "application/json" },
    });
    setSwitching(false);
    setShowDetail(false);
    setStep("overview");
    router.refresh();
  };

  const handleClose = () => {
    setShowDetail(false);
    setStep("overview");
    setExamDate("");
    setDailyGoal(20);
  };

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className={`p-4 rounded-xl border transition-colors hover:border-[var(--color-accent)]/30 text-left ${
          isCurrent
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
            : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center mb-2">
          <Icon className="w-4 h-4 text-[var(--color-accent)]" />
        </div>
        <p className="text-sm font-bold leading-tight">{exam.name}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          {exam.subjects.length}科目
          {exam.examMonth ? ` / ${exam.examMonth}月` : ""}
        </p>
      </button>

      {showDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6" onClick={handleClose}>
          <div className="w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-black">{exam.name}</h3>
              <button onClick={handleClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {step === "overview" && (
              <>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">{exam.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {exam.subjects.map(s => (
                    <span key={s.id} className="px-2 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
                      {s.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-5">
                  <span>{exam.subjects.length}科目</span>
                  {exam.examMonth && <span>{exam.examMonth}月試験</span>}
                  {exam.hasEssay && <span className="text-[var(--color-accent)]">論述式あり</span>}
                  {exam.isNational && <span>国家資格</span>}
                </div>
                {isCurrent ? (
                  <p className="text-center text-sm text-[var(--color-accent)] font-medium py-2">現在学習中の試験です</p>
                ) : (
                  <button
                    onClick={() => setStep("plan")}
                    className="w-full py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    この試験を学習する <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {step === "plan" && (
              <>
                {/* 試験日 */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <label className="text-sm font-medium">試験予定日</label>
                    <span className="text-[10px] text-[var(--color-text-muted)]">（任意）</span>
                  </div>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-sm transition-colors"
                  />
                </div>

                {/* 学習目標 */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <label className="text-sm font-medium">1日の学習目標</label>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 20, 30, 60].map((min) => (
                      <button
                        key={min}
                        onClick={() => setDailyGoal(min)}
                        className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                          dailyGoal === min
                            ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] border text-[var(--color-accent)]"
                            : "bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {min}分
                        {dailyGoal === min && <CheckCircle className="w-3 h-3 inline ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={switching}
                  className="w-full py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {switching ? "設定中..." : (<>学習を開始する <ArrowRight className="w-4 h-4" /></>)}
                </button>
                <button
                  onClick={() => setStep("overview")}
                  className="w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mt-3"
                >
                  戻る
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
