"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Loader2, Zap, CheckCircle2, XCircle, ChevronRight, RotateCcw,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  exam_tip?: string;
  topic?: string;
  subject?: string;
}

export default function WeaknessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>}>
      <WeaknessContent />
    </Suspense>
  );
}

function WeaknessContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [phase, setPhase] = useState<"loading" | "drill" | "result" | "complete">("loading");
  const [weakPoints, setWeakPoints] = useState<{ subject: string; topic: string; accuracyPct: number }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [currentWeakIndex, setCurrentWeakIndex] = useState(0);
  const [questionLoading, setQuestionLoading] = useState(false);

  // 弱点データ取得
  useEffect(() => {
    if (!examId) return;
    fetch(`/api/analytics?examId=${examId}`)
      .then(r => r.ok ? r.json() : { weakPoints: [] })
      .then(data => {
        const wps = data.weakPoints || [];
        if (wps.length === 0) {
          setPhase("complete");
        } else {
          setWeakPoints(wps);
          generateQuestion(wps[0].subject, wps[0].topic);
        }
      })
      .catch(() => setPhase("complete"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const generateQuestion = async (subject: string, topic?: string) => {
    setQuestionLoading(true);
    setPhase("loading");
    setSelectedAnswer("");
    setShowResult(false);

    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject,
          topic,
          difficulty: 3,
          questionType: "multiple_choice",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setCurrentQuestion({ question: `エラー: ${err.error}`, options: [], correct_answer: "", explanation: "", subject, topic });
        setPhase("drill");
        setQuestionLoading(false);
        return;
      }

      const data = await res.json();
      setCurrentQuestion({ ...data.question, subject, topic });
      setPhase("drill");
    } catch {
      setPhase("complete");
    }
    setQuestionLoading(false);
  };

  const handleAnswer = async (answer: string) => {
    if (showResult || !currentQuestion) return;
    setSelectedAnswer(answer);
    setShowResult(true);

    const isCorrect = answer === currentQuestion.correct_answer;
    setStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));

    // 結果を保存
    try {
      await fetch("/api/practice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject: currentQuestion.subject || weakPoints[currentWeakIndex]?.subject || "",
          topic: currentQuestion.topic || weakPoints[currentWeakIndex]?.topic || "",
          question: currentQuestion.question,
          questionType: "multiple_choice",
          userAnswer: answer,
          correctAnswer: currentQuestion.correct_answer,
          isCorrect,
          explanation: currentQuestion.explanation,
          difficulty: 3,
        }),
      });
    } catch { /* ignore */ }

    setPhase("result");
  };

  const nextQuestion = () => {
    // 3問連続正解で次の弱点に進む
    if (stats.total > 0 && stats.total % 3 === 0) {
      const nextIdx = currentWeakIndex + 1;
      if (nextIdx >= weakPoints.length) {
        setPhase("complete");
        return;
      }
      setCurrentWeakIndex(nextIdx);
      generateQuestion(weakPoints[nextIdx].subject, weakPoints[nextIdx].topic);
    } else {
      const wp = weakPoints[currentWeakIndex];
      if (wp) {
        generateQuestion(wp.subject, wp.topic);
      } else {
        setPhase("complete");
      }
    }
  };

  if (!exam) return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)] mb-4">試験が選択されていません</p>
        <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">ダッシュボードに戻る</Link>
      </div>
    </main>
  );

  // 完了画面
  if (phase === "complete") return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-400" />
            <h1 className="text-lg font-bold">Weakness Drill</h1>
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-orange-400/10 flex items-center justify-center mx-auto mb-6">
          <Zap className="w-10 h-10 text-orange-400" />
        </div>
        {stats.total === 0 ? (
          <>
            <h2 className="text-xl font-bold mb-2">弱点データがありません</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              まずPracticeを解いて弱点を蓄積しましょう。
            </p>
            <Link href={`/study/practice?exam=${examId}`}
              className="inline-block py-3 px-8 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors">
              Practiceを解く
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2">ドリル完了</h2>
            <p className="text-4xl font-black mb-2">
              <span className="text-green-400">{stats.correct}</span>
              <span className="text-[var(--color-text-muted)]"> / {stats.total}</span>
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              正答率 {Math.round((stats.correct / stats.total) * 100)}%
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStats({ total: 0, correct: 0 }); setCurrentWeakIndex(0); if (weakPoints[0]) generateQuestion(weakPoints[0].subject, weakPoints[0].topic); }}
                className="py-3 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />もう一度
              </button>
              <Link href="/dashboard" className="py-3 px-6 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] font-bold transition-colors">
                ダッシュボードへ
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );

  // ドリル画面
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              <h1 className="text-lg font-bold">Weakness Drill
                <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">{exam.shortName}</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {weakPoints[currentWeakIndex] && (
              <span className="px-2 py-1 rounded-lg bg-orange-400/10 text-orange-400 font-medium">
                {weakPoints[currentWeakIndex].subject} — 正答率{weakPoints[currentWeakIndex].accuracyPct}%
              </span>
            )}
            <span className="text-[var(--color-text-muted)]">
              {stats.correct}/{stats.total}問正解
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {(phase === "loading" || questionLoading) && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-400 mb-4" />
            <p className="text-sm text-[var(--color-text-muted)]">弱点問題を生成中...</p>
          </div>
        )}

        {(phase === "drill" || phase === "result") && currentQuestion && (
          <div>
            {/* 問題文 */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-6">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentQuestion.question}</ReactMarkdown>
              </div>
            </div>

            {/* 選択肢 */}
            <div className="space-y-3 mb-6">
              {(currentQuestion.options || []).map((option, i) => {
                const letter = String.fromCharCode(65 + i);
                const isSelected = selectedAnswer === option;
                const isCorrect = option === currentQuestion.correct_answer;

                let borderClass = "border-[var(--color-border)] hover:border-[var(--color-accent)]/30";
                if (showResult) {
                  if (isCorrect) borderClass = "border-green-500 bg-green-500/5";
                  else if (isSelected && !isCorrect) borderClass = "border-red-500 bg-red-500/5";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(option)}
                    disabled={showResult}
                    className={`w-full p-4 rounded-xl bg-[var(--color-bg-card)] border ${borderClass} text-left transition-colors flex items-start gap-3 disabled:cursor-default`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      showResult && isCorrect ? "bg-green-500 text-white" :
                      showResult && isSelected ? "bg-red-500 text-white" :
                      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                    }`}>
                      {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                       showResult && isSelected ? <XCircle className="w-4 h-4" /> : letter}
                    </span>
                    <span className="text-sm">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* 解説 */}
            {showResult && (
              <div className="mb-6">
                <div className="p-5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <h4 className="font-bold text-sm mb-2">解説</h4>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentQuestion.explanation}</ReactMarkdown>
                  </div>
                </div>
                <button
                  onClick={nextQuestion}
                  className="mt-4 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                >
                  次の問題 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
