"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  BarChart3,
  TrendingUp,
  Target,
  Flame,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { SubjectAccuracyChart, ScoreHistoryChart } from "./charts";
import { getExamById } from "@/lib/exams";

interface AnalyticsData {
  overview: {
    totalQuestions: number;
    totalCorrect: number;
    overallAccuracy: number;
    currentStreak: number;
    longestStreak: number;
    dailyGoal: number;
  };
  subjectAccuracy: { subject: string; total: number; correct: number; accuracy: number }[];
  weakPoints: { subject: string; topic: string; totalAttempts: number; accuracyPct: number }[];
  scoreHistory: { date: string; total: number; accuracy: number }[];
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId) return;
    fetch(`/api/analytics?examId=${examId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (!data || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">
        データがありません。まず問題を解いてください。
      </div>
    );
  }

  const { overview, subjectAccuracy, weakPoints, scoreHistory } = data;

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
            <h1 className="text-lg font-bold">
              Analytics
              <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                {exam.shortName}
              </span>
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Target} label="総問題数" value={String(overview.totalQuestions)} />
          <StatCard
            icon={TrendingUp}
            label="正答率"
            value={`${overview.overallAccuracy}%`}
            color={overview.overallAccuracy >= 70 ? "var(--color-success)" : overview.overallAccuracy >= 50 ? "var(--color-warning)" : "var(--color-danger)"}
          />
          <StatCard icon={Flame} label="連続学習" value={`${overview.currentStreak}日`} color="var(--color-warning)" />
          <StatCard icon={Trophy} label="最長記録" value={`${overview.longestStreak}日`} color="var(--color-accent)" />
        </div>

        {/* Subject Accuracy Chart */}
        <section>
          <h2 className="text-xl font-bold mb-4">科目別正答率</h2>
          <SubjectAccuracyChart data={subjectAccuracy} />
        </section>

        {/* Weak Points */}
        {weakPoints.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
              弱点分野（重点対策が必要）
            </h2>
            <div className="space-y-2">
              {weakPoints.slice(0, 8).map((wp, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{wp.subject}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{wp.topic}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-lg font-bold"
                      style={{ color: wp.accuracyPct < 50 ? "var(--color-danger)" : "var(--color-warning)" }}
                    >
                      {wp.accuracyPct}%
                    </span>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {wp.totalAttempts}問中
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Score History Chart */}
        {scoreHistory.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">正答率の推移</h2>
            <ScoreHistoryChart data={scoreHistory} />
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
      <Icon className="w-5 h-5 text-[var(--color-text-muted)] mb-2" />
      <p className="text-2xl font-black" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}
