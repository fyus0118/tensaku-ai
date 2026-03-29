"use client";

import { useState, useEffect } from "react";
import { ArrowRight, X, Target, Calendar, Clock, CheckCircle, RotateCcw, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExamCategory } from "@/lib/exams";
import { EXAM_ICON_MAP } from "@/components/ExamIcons";

interface ExamStatus {
  hasData: boolean;
  totalQuestions?: number;
  accuracy?: number;
  weakPoints?: { subject: string; accuracy: number; total: number }[];
  lastStudiedAt?: string;
  currentStreak?: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7) return `${diff}日前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ExamCard({ exam, isCurrent }: { exam: ExamCategory; isCurrent: boolean }) {
  const [showDetail, setShowDetail] = useState(false);
  const [step, setStep] = useState<"loading" | "overview" | "resume" | "plan">("loading");
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [examDate, setExamDate] = useState("");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const Icon = EXAM_ICON_MAP[exam.id] || Target;

  useEffect(() => {
    if (!showDetail) return;
    setStep("loading");
    fetch(`/api/exam-status?exam=${exam.id}`)
      .then(r => r.json())
      .then((data: ExamStatus) => {
        setStatus(data);
        if (isCurrent) {
          setStep("overview");
        } else if (data.hasData) {
          setStep("resume");
        } else {
          setStep("overview");
        }
      })
      .catch(() => {
        setStatus({ hasData: false });
        setStep("overview");
      });
  }, [showDetail, exam.id, isCurrent]);

  const handleConfirm = async () => {
    if (isCurrent) { handleClose(); return; }
    setSwitching(true);
    await fetch(`/api/select-exam?exam=${exam.id}&date=${examDate || ""}&goal=${dailyGoal}`, {
      headers: { accept: "application/json" },
    });
    setSwitching(false);
    handleClose();
    router.refresh();
  };

  const handleResume = async () => {
    if (isCurrent) { handleClose(); return; }
    setSwitching(true);
    await fetch(`/api/select-exam?exam=${exam.id}`, {
      headers: { accept: "application/json" },
    });
    setSwitching(false);
    handleClose();
    router.refresh();
  };

  const handleClose = () => {
    setShowDetail(false);
    setStep("loading");
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

            {/* ローディング */}
            {step === "loading" && (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}

            {/* 再開画面 */}
            {step === "resume" && status?.hasData && (
              <>
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="text-sm font-bold">前回の学習データ</span>
                    {status.lastStudiedAt && (
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                        最終: {formatDate(status.lastStudiedAt)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">解いた問題数</p>
                      <p className="text-xl font-black">{status.totalQuestions}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">正答率</p>
                      <p className={`text-xl font-black ${
                        (status.accuracy || 0) >= 70 ? "text-[var(--color-success)]" :
                        (status.accuracy || 0) >= 50 ? "text-[var(--color-warning)]" :
                        "text-[var(--color-danger)]"
                      }`}>{status.accuracy}%</p>
                    </div>
                  </div>
                  {status.weakPoints && status.weakPoints.length > 0 && (
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)] mb-1">弱点科目</p>
                      <div className="flex flex-wrap gap-1.5">
                        {status.weakPoints.map(w => (
                          <span key={w.subject} className="px-2 py-0.5 rounded-md bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[10px] font-medium">
                            {w.subject} ({w.accuracy}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleResume}
                  disabled={switching}
                  className="w-full py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
                >
                  {switching ? "切替中..." : (<><RotateCcw className="w-4 h-4" /> 続きから学習する</>)}
                </button>
                <button
                  onClick={() => setStep("plan")}
                  className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  学習プランを変更する
                </button>
              </>
            )}

            {/* 概要（初めての試験 or 現在選択中） */}
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

            {/* 学習プラン設定 */}
            {step === "plan" && (
              <>
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
                  onClick={() => setStep(status?.hasData ? "resume" : "overview")}
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
