"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ArrowRight, X } from "lucide-react";
import { EXAM_CATEGORIES, type ExamCategory } from "@/lib/exams";
import { useRouter } from "next/navigation";

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
];

export default function ExamSwitcher({ currentExamId, currentExamName }: { currentExamId: string; currentExamName: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ExamCategory | null>(null);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPreview(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleConfirm = async () => {
    if (!preview || preview.id === currentExamId) return;
    setSwitching(true);
    await fetch(`/api/select-exam?exam=${preview.id}`, { headers: { accept: "application/json" } });
    setOpen(false);
    setPreview(null);
    setSwitching(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setPreview(null); }}
        className="flex items-center gap-2 text-2xl font-black hover:text-[var(--color-accent)] transition-colors"
      >
        {currentExamName}
        <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-96 max-h-[80vh] overflow-y-auto rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-lg z-50">
          {/* 概要プレビュー */}
          {preview && (
            <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-sm">{preview.name}</h3>
                <button onClick={() => setPreview(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">{preview.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {preview.subjects.map(s => (
                  <span key={s.id} className="px-2 py-0.5 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]">
                    {s.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] mb-3">
                <span>{preview.subjects.length}科目</span>
                {preview.examMonth && <span>/ {preview.examMonth}月試験</span>}
                {preview.hasEssay && <span>/ 論述式あり</span>}
              </div>
              {preview.id === currentExamId ? (
                <p className="text-xs text-[var(--color-accent)] font-medium">現在選択中の試験です</p>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={switching}
                  className="w-full py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {switching ? "切替中..." : (
                    <>この試験に変更 <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              )}
            </div>
          )}

          {/* 試験一覧 */}
          {EXAM_GROUPS.map((group) => {
            const exams = group.ids.map(id => EXAM_CATEGORIES.find(e => e.id === id)).filter(Boolean);
            if (exams.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{group.label}</p>
                </div>
                {exams.map((exam) => {
                  if (!exam) return null;
                  const isCurrent = exam.id === currentExamId;
                  const isPreviewing = preview?.id === exam.id;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => !exam.comingSoon && setPreview(isPreviewing ? null : exam)}
                      disabled={exam.comingSoon}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                        exam.comingSoon ? "text-[var(--color-text-muted)] cursor-not-allowed opacity-60" :
                        isPreviewing ? "bg-[var(--color-accent)]/5 text-[var(--color-accent)] font-bold" :
                        isCurrent ? "text-[var(--color-accent)] font-bold" :
                        "text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]"
                      }`}
                    >
                      {exam.name}
                      {exam.comingSoon && <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[9px] font-bold text-[var(--color-text-muted)]">Coming Soon</span>}
                      {isCurrent && !isPreviewing && !exam.comingSoon && <span className="text-[10px] text-[var(--color-accent)]">選択中</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
