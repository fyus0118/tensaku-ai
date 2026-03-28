"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Layers,
  RotateCcw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Brain,
} from "lucide-react";
import { getExamById } from "@/lib/exams";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject: string;
  topic: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

type Phase = "loading" | "empty" | "generate" | "review" | "done";

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>}>
      <FlashcardsContent />
    </Suspense>
  );
}

function FlashcardsContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("exam") || "";
  const exam = getExamById(examId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // 復習対象カードを読み込み
  useEffect(() => {
    if (!examId) return;
    fetch(`/api/flashcards?examId=${examId}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.cards && data.cards.length > 0) {
          setCards(data.cards);
          setPhase("review");
        } else {
          setPhase("empty");
        }
      })
      .catch(() => setPhase("empty"));
  }, [examId]);

  const generateCards = async () => {
    if (!selectedSubject) return;
    setGenerating(true);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, subject: selectedSubject, count: 10 }),
      });
      const data = await res.json();
      if (data.cards) {
        setCards(data.cards);
        setCurrentIndex(0);
        setPhase("review");
      }
    } catch (err) {
      console.error("カード生成エラー:", err);
    }
    setGenerating(false);
  };

  const reviewCard = async (quality: number) => {
    const card = cards[currentIndex];
    if (!card) return;

    // SM-2結果を保存
    await fetch("/api/flashcards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quality }),
    });

    setReviewedCount((p) => p + 1);
    if (quality >= 3) setCorrectCount((p) => p + 1);
    setFlipped(false);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((p) => p + 1);
    } else {
      setPhase("done");
    }
  };

  const currentCard = cards[currentIndex];

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--color-accent)]" />
              <h1 className="text-lg font-bold">
                暗記カード
                {exam && <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-2">{exam.icon} {exam.shortName}</span>}
              </h1>
            </div>
          </div>
          {phase === "review" && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {currentIndex + 1} / {cards.length}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Loading */}
        {phase === "loading" && (
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        )}

        {/* Empty - Generate new cards */}
        {(phase === "empty" || phase === "generate") && exam && (
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto">
              <Brain className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">暗記カードを生成</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                AIが試験に出る重要知識を暗記カードにします。
                <br />
                SM-2アルゴリズムで最適なタイミングで復習できます。
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-3 text-left">科目を選択</p>
              <div className="flex flex-wrap gap-2">
                {exam.subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubject(s.name)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      selectedSubject === s.name
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedSubject && (
              <button
                onClick={generateCards}
                disabled={generating}
                className="w-full py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> 生成中...</>
                ) : (
                  <><Plus className="w-5 h-5" /> 10枚生成する</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Review Mode */}
        {phase === "review" && currentCard && (
          <div className="w-full max-w-lg space-y-6">
            {/* Card - 3D Flip */}
            <div
              className="flashcard-perspective w-full cursor-pointer"
              onClick={() => setFlipped(!flipped)}
            >
              <div className={`flashcard-inner ${flipped ? "flipped" : ""}`}>
                <div className="flashcard-face flashcard-front text-left">
                  <p className="text-xs text-[var(--color-text-muted)] mb-4 uppercase tracking-wider">
                    {currentCard.subject} {currentCard.topic && `/ ${currentCard.topic}`}
                  </p>
                  <p className="text-lg leading-relaxed">{currentCard.front}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-6">
                    タップして解答を表示
                  </p>
                </div>
                <div className="flashcard-face flashcard-back text-left">
                  <p className="text-xs text-[var(--color-accent)] mb-4 uppercase tracking-wider font-bold">
                    解答
                  </p>
                  <p className="text-base leading-relaxed whitespace-pre-wrap">
                    {currentCard.back}
                  </p>
                </div>
              </div>
            </div>

            {/* Review Buttons (shown after flip) */}
            {flipped && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)] text-center">
                  どのくらい覚えていましたか？
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => reviewCard(1)}
                    className="py-3 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    忘れた
                  </button>
                  <button
                    onClick={() => reviewCard(3)}
                    className="py-3 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 text-[var(--color-warning)] font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    曖昧
                  </button>
                  <button
                    onClick={() => reviewCard(5)}
                    className="py-3 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    完璧
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-success)]/10 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-[var(--color-success)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">復習完了！</h2>
              <p className="text-[var(--color-text-secondary)]">
                {reviewedCount}枚中 {correctCount}枚を覚えていました（{reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0}%）
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setPhase("empty");
                  setCards([]);
                  setCurrentIndex(0);
                  setFlipped(false);
                  setReviewedCount(0);
                  setCorrectCount(0);
                }}
                className="px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新しいカードを生成
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium transition-colors"
              >
                ダッシュボードへ
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
