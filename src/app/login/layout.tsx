import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン",
  description: "StudyEnginesにログイン。メールアドレスでワンタイムパスワード認証。",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
