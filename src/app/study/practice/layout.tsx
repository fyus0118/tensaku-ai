import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice",
  description: "本番形式のオリジナル問題をAIが無限に生成。科目・難易度を指定して集中特訓。",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
