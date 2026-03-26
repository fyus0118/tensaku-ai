"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { EXAM_CATEGORIES } from "@/lib/exams";
import { createClient } from "@/lib/supabase/client";

type Step = "exam" | "saving";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("exam");
  const [selectedExam, setSelectedExam] = useState("");

  const nationalExams = EXAM_CATEGORIES.filter((e) => e.isNational);
  const otherExams = EXAM_CATEGORIES.filter((e) => !e.isNational);

  const handleContinue = async () => {
    if (!selectedExam) return;
    setStep("saving");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({
          target_exam: selectedExam,
          onboarding_completed: true,
        })
        .eq("id", user.id);
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        {step === "exam" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-8 h-8 text-[var(--color-accent)]" />
              </div>
              <h1 className="text-3xl font-black mb-2">
                TENS<span className="text-[var(--color-accent)]">AKU</span>へようこそ
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                目標の試験を選んでください。あなたに合った学習を始めます。
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
                    <span className="text-2xl block mb-1">{exam.icon}</span>
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
                    <span className="text-2xl block mb-1">{exam.icon}</span>
                    <p className="text-sm font-bold">{exam.shortName}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleContinue}
              disabled={!selectedExam}
              className="w-full py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              学習を始める
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              スキップしてダッシュボードへ
            </button>
          </div>
        )}

        {step === "saving" && (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mx-auto mb-4" />
            <p className="text-[var(--color-text-secondary)]">準備中...</p>
          </div>
        )}
      </div>
    </main>
  );
}
