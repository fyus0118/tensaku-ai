import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "添削AI",
  description: "小論文・志望理由書・レポートをAIが即座に添削。100点満点の多軸スコアリング。",
};

export default function StudyReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
