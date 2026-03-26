import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "暗記カード",
  description: "AIが生成する暗記カードでスペースドリピティション学習。SM-2アルゴリズムで最適な復習タイミング。",
};

export default function FlashcardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
