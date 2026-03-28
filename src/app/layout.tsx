import type { Metadata, Viewport } from "next";
import { NativeInit } from "@/components/NativeInit";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TENSAKU | 国家試験・資格試験のAI学習パートナー",
    template: "%s | TENSAKU",
  },
  description:
    "司法試験・予備試験・中小企業診断士・公認会計士・行政書士・宅建——AIチューター、練習問題生成、論述添削。あなた専用の講師が24時間対応。",
  openGraph: {
    title: "TENSAKU | 国家試験・資格試験のAI学習パートナー",
    description:
      "AIチューター・練習問題生成・論述添削の3モード。予備校の1/10の費用で、24時間いつでも学習。",
    type: "website",
    siteName: "TENSAKU",
  },
  twitter: {
    card: "summary_large_image",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tensaku.ai"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
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
        {children}
      </body>
    </html>
  );
}
