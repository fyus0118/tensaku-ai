import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
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
        <div className="prose prose-sm max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <p>最終更新日：2026年3月31日</p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">1. 収集する情報</h2>
          <p>当サービスは以下の情報を収集します。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>アカウント情報</strong>：メールアドレス</li>
            <li><strong>学習データ</strong>：チャット履歴、練習問題の回答結果、添削内容、暗記カードデータ、学習ストリーク</li>
            <li><strong>Core知識データ</strong>：Prismで検証済みとなった知識の説明文、理解度スコア、修正履歴</li>
            <li><strong>決済情報</strong>：Stripeを通じて処理（クレジットカード番号は当サービスでは保持しません）</li>
            <li><strong>利用状況</strong>：アクセスログ、利用頻度</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">2. 情報の利用目的</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>サービスの提供・運営・改善</li>
            <li>3層AI（Mentor/Prism/Core）による個別最適化された学習体験の提供</li>
            <li>適応学習エンジンによる弱点分析・難易度調整・合格予測</li>
            <li>Core知識データの蓄積・知識マップの生成</li>
            <li>利用料金の請求・決済処理</li>
            <li>お問い合わせへの対応</li>
            <li>不正利用の防止</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">3. AI処理について</h2>
          <p>
            ユーザーが入力した質問・文章は、以下の外部AIサービスに送信されて処理されます。
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Anthropic（Claude）</strong>：全学習モードにおけるAI応答の生成。Anthropicのデータポリシーに基づき、API経由のデータはモデルの学習には使用されません。</li>
            <li><strong>Amazon Web Services（Bedrock Titan）</strong>：教材の検索に使用するベクトル変換（embedding）。入力テキストの意味的な数値表現を生成します。</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">4. Core知識データについて</h2>
          <p>
            Coreに蓄積されるCore知識データは、ユーザーの学習過程で生成された固有のデータです。
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Core知識データの知的財産権はユーザーに帰属します</li>
            <li>当サービスは、サービス改善のためにCore知識データを匿名化・統計化して利用する場合があります</li>
            <li>匿名化・統計化されたデータから個人を特定することはできません</li>
            <li>ユーザーはいつでもCore知識データのエクスポートを要求できます</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">5. 第三者提供</h2>
          <p>
            以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません。
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>サービス提供に必要な業務委託先（Supabase, Stripe, Anthropic, Amazon Web Services）</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">6. データの保管</h2>
          <p>
            データはSupabase（AWS上のPostgreSQL）に保管されます。
            通信はTLS 1.2以上で暗号化されます。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">7. データの削除</h2>
          <p>
            ユーザーはいつでもアカウントの削除を要求できます。
            削除要求を受けた場合、30日以内に全ての個人データ（Core知識データを含む）を削除します。
            削除前にCore知識データのエクスポートを希望する場合は、削除要求時にお申し出ください。
            お問い合わせは support@studyengines.com までご連絡ください。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">8. Cookie</h2>
          <p>
            当サービスは認証のためにCookieを使用します。
            トラッキング目的のCookieは使用しません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">9. ポリシーの変更</h2>
          <p>
            本ポリシーを変更する場合は、当サービス上で通知します。
            重要な変更がある場合は、登録メールアドレスに通知します。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">10. お問い合わせ</h2>
          <p>
            プライバシーに関するお問い合わせは support@studyengines.com までご連絡ください。
          </p>
        </div>
      </div>
    </main>
  );
}
