import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "StudyEnginesの特定商取引法に基づく表記",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8 inline-block"
        >
          &larr; トップに戻る
        </Link>
        <h1 className="text-3xl font-black mb-8">特定商取引法に基づく表記</h1>
        <div className="space-y-6">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                ["販売事業者", "[要記入]"],
                ["運営責任者", "[要記入]"],
                ["所在地", "[要記入]"],
                ["電話番号", "[要記入]（お問い合わせはメールにて受け付けております）"],
                ["メールアドレス", "support@studyengines.com"],
                ["販売URL", "https://studyengines.com"],
                ["販売価格", "プロプラン：月額9,800円（税込）"],
                ["追加手数料", "なし（決済手数料は当サービスが負担します）"],
                ["支払方法", "クレジットカード（Stripe経由）"],
                ["支払時期", "申込時に初回決済、以降毎月同日に自動更新"],
                ["サービス提供時期", "決済完了後、即時利用可能"],
                ["返品・キャンセル", "デジタルサービスのため返品不可。解約はいつでも可能で、解約月末まで利用可能。日割り返金は行いません。"],
                ["動作環境", "最新版の Chrome, Safari, Firefox, Edge。インターネット接続が必要。iOS / Android対応。"],
                ["特記事項", "当サービスはAIによる学習支援ツールであり、試験合格を保証するものではありません。"],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="py-4 pr-6 font-medium text-[var(--color-text)] whitespace-nowrap align-top w-40">
                    {label}
                  </td>
                  <td className="py-4 text-[var(--color-text-secondary)]">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-[var(--color-text-muted)] mt-8">
            最終更新日：2026年3月31日
          </p>
        </div>
      </div>
    </main>
  );
}
