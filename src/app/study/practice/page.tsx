"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Target,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  Zap,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

interface Question {
  question: string;
  type: "multiple_choice" | "essay";
  options?: string[];
  correct_index?: number;
  model_answer?: string;
  scoring_criteria?: string[];
  explanation: string;
  topic: string;
  difficulty: number;
  exam_tip: string;
}

type Phase = "select" | "loading" | "question" | "result";

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}

function PracticeContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [phase, setPhase] = useState<Phase>("select");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [essayAnswer, setEssayAnswer] = useState("");
  const [error, setError] = useState("");

  // 統計
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);

  const generateQuestion = async () => {
    setPhase("loading");
    setError("");
    setSelectedAnswer(null);
    setEssayAnswer("");

    try {
      const response = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          subject: selectedSubject,
          topic: selectedTopic || undefined,
          difficulty,
          questionType: "multiple_choice",
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "問題の生成に失敗しました");
        setPhase("select");
        return;
      }

      const data = await response.json();
      setCurrentQuestion(data.question);
      setPhase("question");
    } catch {
      setError("通信エラーが発生しました");
      setPhase("select");
    }
  };

  const submitAnswer = async (answerIndex: number) => {
    if (!currentQuestion || selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
    setPhase("result");

    const isCorrect = answerIndex === currentQuestion.correct_index;
    setTotalAnswered((p) => p + 1);
    if (isCorrect) setTotalCorrect((p) => p + 1);

    // 結果を保存
    await fetch("/api/practice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId,
        subject: selectedSubject,
        topic: currentQuestion.topic,
        question: currentQuestion.question,
        questionType: "multiple_choice",
        userAnswer: currentQuestion.options?.[answerIndex],
        correctAnswer: currentQuestion.options?.[currentQuestion.correct_index ?? 0],
        isCorrect,
        explanation: currentQuestion.explanation,
        difficulty: currentQuestion.difficulty,
      }),
    });
  };

  const selectedSubjectData = exam?.subjects.find((s) => s.name === selectedSubject);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--color-accent)]" />
              <h1 className="text-lg font-bold">
                練習問題
                {exam && (
                  <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
                    {exam.icon} {exam.shortName}
                  </span>
                )}
              </h1>
            </div>
          </div>
          {totalAnswered > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">
                {totalCorrect}/{totalAnswered}問正解
              </span>
              <span
                className="font-bold"
                style={{
                  color:
                    totalCorrect / totalAnswered >= 0.8
                      ? "var(--color-success)"
                      : totalCorrect / totalAnswered >= 0.6
                        ? "var(--color-warning)"
                        : "var(--color-danger)",
                }}
              >
                {Math.round((totalCorrect / totalAnswered) * 100)}%
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm">
            {error}
          </div>
        )}

        {/* Subject Selection */}
        {phase === "select" && exam && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4">科目を選択</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {exam.subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSubject(s.name);
                      setSelectedTopic("");
                    }}
                    className={`p-4 rounded-xl border text-left transition-colors ${
                      selectedSubject === s.name
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]"
                    }`}
                  >
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {s.topics.length}分野
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selectedSubjectData && (
              <div>
                <h2 className="text-lg font-bold mb-4">
                  分野を選択
                  <span className="text-sm font-normal text-[var(--color-text-muted)] ml-2">
                    （任意）
                  </span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedTopic("")}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      !selectedTopic
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                    }`}
                  >
                    ランダム
                  </button>
                  {selectedSubjectData.topics.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTopic(t)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        selectedTopic === t
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSubject && (
              <div>
                <h2 className="text-lg font-bold mb-4">難易度</h2>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`w-12 h-12 rounded-xl font-bold transition-colors ${
                        difficulty === d
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  1=基礎 / 3=本番レベル / 5=超難問
                </p>
              </div>
            )}

            {selectedSubject && (
              <button
                onClick={generateQuestion}
                className="w-full py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                問題を生成
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-[var(--color-accent)] animate-spin mb-4" />
            <p className="text-[var(--color-text-secondary)]">
              {exam?.shortName}の問題を生成中...
            </p>
          </div>
        )}

        {/* Question */}
        {(phase === "question" || phase === "result") && currentQuestion && (
          <div className="space-y-6">
            {/* Question text */}
            <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs px-2 py-1 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium">
                  {currentQuestion.topic}
                </span>
                <span className="text-xs px-2 py-1 rounded-md bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                  難易度 {currentQuestion.difficulty}/5
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {currentQuestion.question}
              </p>
            </div>

            {/* Options */}
            {currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, i) => {
                  const isSelected = selectedAnswer === i;
                  const isCorrect = i === currentQuestion.correct_index;
                  const showResult = phase === "result";

                  let borderColor = "border-[var(--color-border)]";
                  let bgColor = "bg-[var(--color-bg-card)]";

                  if (showResult) {
                    if (isCorrect) {
                      borderColor = "border-[var(--color-success)]";
                      bgColor = "bg-[var(--color-success)]/10";
                    } else if (isSelected && !isCorrect) {
                      borderColor = "border-[var(--color-danger)]";
                      bgColor = "bg-[var(--color-danger)]/10";
                    }
                  } else if (isSelected) {
                    borderColor = "border-[var(--color-accent)]";
                    bgColor = "bg-[var(--color-accent)]/10";
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => submitAnswer(i)}
                      disabled={phase === "result"}
                      className={`w-full p-4 rounded-xl border ${borderColor} ${bgColor} text-left transition-colors ${
                        phase !== "result"
                          ? "hover:border-[var(--color-accent)]/50 cursor-pointer"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[var(--color-bg)] flex items-center justify-center text-sm font-bold shrink-0">
                          {showResult ? (
                            isCorrect ? (
                              <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                            ) : isSelected ? (
                              <XCircle className="w-5 h-5 text-[var(--color-danger)]" />
                            ) : (
                              String.fromCharCode(65 + i)
                            )
                          ) : (
                            String.fromCharCode(65 + i)
                          )}
                        </span>
                        <p className="text-sm leading-relaxed pt-1">{option}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Explanation */}
            {phase === "result" && (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    {selectedAnswer === currentQuestion.correct_index ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                        <span className="text-[var(--color-success)]">正解！</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-[var(--color-danger)]" />
                        <span className="text-[var(--color-danger)]">不正解</span>
                      </>
                    )}
                  </h3>
                  <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.explanation}
                  </div>
                </div>

                {currentQuestion.exam_tip && (
                  <div className="p-4 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
                    <p className="text-sm font-medium text-[var(--color-warning)] mb-1">
                      試験のポイント
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {currentQuestion.exam_tip}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={generateQuestion}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    次の問題
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setPhase("select");
                      setCurrentQuestion(null);
                      setSelectedAnswer(null);
                    }}
                    className="py-3 px-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)] font-medium transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    科目変更
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
