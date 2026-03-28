import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 | StudyEngines",
  description: "StudyEnginesの利用規約",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8 inline-block"
        >
          &larr; トップに戻る
        </Link>
        <h1 className="text-3xl font-black mb-8">利用規約</h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <p>最終更新日：2026年3月26日</p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第1条（適用）</h2>
          <p>
            本規約は、StudyEngines（以下「当サービス」）の利用に関する条件を定めるものです。
            ユーザーは本規約に同意の上、当サービスを利用するものとします。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第2条（アカウント）</h2>
          <p>
            ユーザーは正確な情報を提供してアカウントを登録するものとします。
            アカウントの管理責任はユーザーにあり、第三者への貸与・譲渡はできません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第3条（サービス内容）</h2>
          <p>
            当サービスはAIを活用した学習支援ツールであり、以下の機能を提供します。
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>AIチューターによる質問応答</li>
            <li>AIによる練習問題の生成</li>
            <li>小論文・レポートのAI添削</li>
            <li>暗記カードの生成と間隔反復学習</li>
            <li>学習分析機能</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第4条（AI生成コンテンツの免責）</h2>
          <p>
            当サービスが提供するAI生成コンテンツ（回答、問題、添削結果等）は参考情報であり、
            その正確性・完全性を保証するものではありません。
            試験結果や学習成果について当サービスは一切の責任を負いません。
            重要な法的・医学的知識については、必ず公式の教材や専門家にご確認ください。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第5条（料金・支払い）</h2>
          <p>
            プロプランの料金は月額9,800円（税込）です。
            決済はStripeを通じて処理され、毎月自動更新されます。
            解約はいつでも可能で、解約後は当月末まで利用できます。
            日割り返金は行いません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第6条（禁止事項）</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>当サービスの逆コンパイル・リバースエンジニアリング</li>
            <li>不正アクセスまたはAPIの不正利用</li>
            <li>他のユーザーのアカウントの使用</li>
            <li>当サービスを利用した商業目的の二次コンテンツ生成</li>
            <li>試験会場での不正使用</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第7条（サービスの変更・終了）</h2>
          <p>
            当サービスは、事前に通知することなくサービス内容の変更・追加・廃止を行う場合があります。
            これによりユーザーに生じた損害について、当サービスは一切の責任を負いません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第8条（準拠法・管轄）</h2>
          <p>
            本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </div>
      </div>
    </main>
  );
}
