import type { Metadata, Viewport } from "next";
import { NativeInit } from "@/components/NativeInit";
import { AuthListener } from "@/components/AuthListener";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StudyEngines | 国家試験・資格試験のAI学習パートナー",
    template: "%s | StudyEngines",
  },
  description:
    "学びながら自分専用AIを育てる。Mentor・Prism・Coreが教え、検証し、あなただけの知識を蓄積。48試験対応。予備校の1/10以下。",
  openGraph: {
    title: "StudyEngines | 学びながら、自分専用AIを育てる",
    description:
      "「わかったつもり」を破壊する。教えるAI、検証するAI、あなたの知識の分身AI。48試験対応。",
    type: "website",
    siteName: "StudyEngines",
  },
  twitter: {
    card: "summary_large_image",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://studyengines.com"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NativeInit />
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
