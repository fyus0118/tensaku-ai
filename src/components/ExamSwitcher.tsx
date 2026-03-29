"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { EXAM_CATEGORIES } from "@/lib/exams";
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
  { label: "大学・教育系", ids: ["daigaku-nyushi", "daigaku-report"] },
];

export default function ExamSwitcher({ currentExamId, currentExamName }: { currentExamId: string; currentExamName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (examId: string) => {
    setOpen(false);
    if (examId === currentExamId) return;
    await fetch(`/api/select-exam?exam=${examId}`, { headers: { accept: "application/json" } });
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-2xl font-black hover:text-[var(--color-accent)] transition-colors"
      >
        {currentExamName}
        <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-lg z-50">
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
                  return (
                    <button
                      key={exam.id}
                      onClick={() => handleSelect(exam.id)}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center justify-between ${
                        isCurrent ? "text-[var(--color-accent)] font-bold" : "text-[var(--color-text)]"
                      }`}
                    >
                      {exam.name}
                      {isCurrent && <span className="text-[10px] text-[var(--color-accent)]">選択中</span>}
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
