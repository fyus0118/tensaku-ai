"use client";

import { useState } from "react";
import { ArrowRight, X, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExamCategory } from "@/lib/exams";
import { EXAM_ICON_MAP } from "@/components/ExamIcons";

export default function ExamCard({ exam, isCurrent }: { exam: ExamCategory; isCurrent: boolean }) {
  const [showDetail, setShowDetail] = useState(false);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const Icon = EXAM_ICON_MAP[exam.id] || Target;

  const handleConfirm = async () => {
    if (isCurrent) return;
    setSwitching(true);
    await fetch(`/api/select-exam?exam=${exam.id}`, { headers: { accept: "application/json" } });
    setSwitching(false);
    setShowDetail(false);
    router.refresh();
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6" onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-black">{exam.name}</h3>
              <button onClick={() => setShowDetail(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
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
                onClick={handleConfirm}
                disabled={switching}
                className="w-full py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {switching ? "切替中..." : (<>この試験に変更する <ArrowRight className="w-4 h-4" /></>)}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
