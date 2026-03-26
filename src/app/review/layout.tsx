import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "添削",
  description: "小論文・レポートをAIが採点官の視点で100点満点で添削。",
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
