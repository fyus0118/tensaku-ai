import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "試験選択",
  description: "受験する試験を選択して、StudyEnginesをカスタマイズ。",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
