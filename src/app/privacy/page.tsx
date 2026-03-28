import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | StudyEngines",
  description: "StudyEnginesのプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8 inline-block"
        >
          &larr; トップに戻る
        </Link>
        <h1 className="text-3xl font-black mb-8">プライバシーポリシー</h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <p>最終更新日：2026年3月26日</p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">1. 収集する情報</h2>
          <p>当サービスは以下の情報を収集します。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>アカウント情報</strong>：メールアドレス</li>
            <li><strong>学習データ</strong>：チャット履歴、練習問題の回答結果、添削内容、暗記カードデータ</li>
            <li><strong>決済情報</strong>：Stripeを通じて処理（クレジットカード番号は当サービスでは保持しません）</li>
            <li><strong>利用状況</strong>：アクセスログ、利用頻度</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">2. 情報の利用目的</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>サービスの提供・運営・改善</li>
            <li>個人に最適化された学習体験の提供（弱点分析、難易度調整等）</li>
            <li>利用料金の請求・決済処理</li>
            <li>お問い合わせへの対応</li>
            <li>不正利用の防止</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">3. AI処理について</h2>
          <p>
            ユーザーが入力した質問・文章は、AI（Claude by Anthropic）に送信されて処理されます。
            Anthropicのデータポリシーに基づき、API経由のデータはモデルの学習には使用されません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">4. 第三者提供</h2>
          <p>
            以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません。
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>サービス提供に必要な業務委託先（Supabase, Stripe, Anthropic, Voyage AI）</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">5. データの保管</h2>
          <p>
            データはSupabase（AWS上のPostgreSQL）に暗号化して保管されます。
            データの保管場所はAWSの東京リージョン（ap-northeast-1）です。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">6. データの削除</h2>
          <p>
            ユーザーはいつでもアカウントの削除を要求できます。
            削除要求を受けた場合、30日以内に全ての個人データを削除します。
            お問い合わせは support@studyengines.com までご連絡ください。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">7. Cookie</h2>
          <p>
            当サービスは認証のためにCookieを使用します。
            トラッキング目的のCookieは使用しません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">8. お問い合わせ</h2>
          <p>
            プライバシーに関するお問い合わせは support@studyengines.com までご連絡ください。
          </p>
        </div>
      </div>
    </main>
  );
}
