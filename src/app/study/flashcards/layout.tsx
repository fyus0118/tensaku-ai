import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flashcards",
  description: "AIが生成するFlashcardsでスペースドリピティション学習。SM-2アルゴリズムで最適な復習タイミング。",
};

export default function FlashcardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
