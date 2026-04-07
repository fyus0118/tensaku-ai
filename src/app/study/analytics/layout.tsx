import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  description: "科目別正答率、弱点分析、学習ストリーク。データで学習を最適化。",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
