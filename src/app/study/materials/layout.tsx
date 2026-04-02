import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "マイ教材",
  description: "自分の教材をアップロードして、AIチューターの精度を高める。",
};

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
