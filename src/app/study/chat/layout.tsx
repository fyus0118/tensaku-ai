import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIチューター",
  description: "試験対策に特化したAIチューターに何でも質問。24時間対応。",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
