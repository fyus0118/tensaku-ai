import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約",
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
        <div className="prose prose-sm max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
          <p>最終更新日：2026年3月31日</p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第1条（適用）</h2>
          <p>
            本規約は、StudyEngines（以下「当サービス」）の利用に関する条件を定めるものです。
            ユーザーは本規約に同意の上、当サービスを利用するものとします。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第2条（定義）</h2>
          <p>本規約において、以下の用語は以下の意味で使用します。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>「Mentor」</strong>：教材データベースに基づいてユーザーに知識を提供するAI機能</li>
            <li><strong>「Prism」</strong>：ユーザーの理解度を検証し、修正を促すAI機能</li>
            <li><strong>「Core」</strong>：ユーザーの検証済み知識を蓄積するAI機能</li>
            <li><strong>「Core知識データ」</strong>：Coreに蓄積されたユーザー固有の知識データ</li>
            <li><strong>「3層AI」</strong>：Mentor、Prism、Coreの総称</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第3条（アカウント）</h2>
          <p>
            ユーザーは正確な情報を提供してアカウントを登録するものとします。
            アカウントの管理責任はユーザーにあり、第三者への貸与・譲渡はできません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第4条（サービス内容）</h2>
          <p>当サービスはAIを活用した学習支援ツールであり、以下の機能を提供します。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Mentorによる質問応答・知識のインプット（AIチューター、暗記カード、練習問題）</li>
            <li>Prismによる理解度の検証（教えてマスター、ソクラテス式問答、ケーススタディ）</li>
            <li>Coreへの検証済み知識の蓄積・知識マップの可視化</li>
            <li>弱点ドリル、論述添削、学習分析</li>
            <li>適応学習エンジンによる弱点検出・難易度調整・合格予測</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第5条（AI生成コンテンツの免責）</h2>
          <p>
            当サービスが提供するAI生成コンテンツ（回答、問題、添削結果、検証結果等）は参考情報であり、
            その正確性・完全性を保証するものではありません。
            Mentorは教材データベースに基づいて回答しますが、100%の正確性を保証するものではありません。
            試験結果や学習成果について当サービスは一切の責任を負いません。
            重要な法的・医学的・会計的知識については、必ず公式の教材や専門家にご確認ください。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第6条（Core知識データの取り扱い）</h2>
          <p>
            Coreに蓄積されたCore知識データの知的財産権はユーザーに帰属します。
            当サービスは、サービスの提供・改善のためにCore知識データを匿名化・統計化した形で利用する場合があります。
            ユーザーは、アカウント削除時にCore知識データのエクスポートを要求できます。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第7条（料金・支払い）</h2>
          <p>
            プロプランの料金は月額9,800円（税込）です。
            決済はStripeを通じて処理され、毎月自動更新されます。
            解約はいつでも可能で、解約後は当月末まで利用できます。
            日割り返金は行いません。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第8条（禁止事項）</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>当サービスの逆コンパイル・リバースエンジニアリング</li>
            <li>不正アクセスまたはAPIの不正利用</li>
            <li>他のユーザーのアカウントの使用</li>
            <li>当サービスを利用した商業目的の二次コンテンツ生成</li>
            <li>試験会場での不正使用</li>
            <li>自動化ツール（bot等）を使用した大量リクエスト</li>
          </ul>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第9条（サービスの変更・終了）</h2>
          <p>
            当サービスは、事前に通知することなくサービス内容の変更・追加・廃止を行う場合があります。
            サービスを終了する場合は、30日前までにユーザーに通知し、Core知識データのエクスポート期間を設けます。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第10条（損害賠償の制限）</h2>
          <p>
            当サービスに起因してユーザーに損害が生じた場合、当サービスの賠償責任は、
            ユーザーが直近1ヶ月間に当サービスに支払った利用料金の額を上限とします。
          </p>

          <h2 className="text-lg font-bold text-[var(--color-text)] mt-8">第11条（準拠法・管轄）</h2>
          <p>
            本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </div>
      </div>
    </main>
  );
}
