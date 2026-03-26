import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | TENSAKU",
  description: "TENSAKUの特定商取引法に基づく表記",
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
                ["販売事業者", "TENSAKU"],
                ["運営責任者", "（氏名を記載）"],
                ["所在地", "（住所を記載）"],
                ["連絡先", "support@tensaku.ai"],
                ["販売価格", "プロプラン：月額9,800円（税込）"],
                ["支払方法", "クレジットカード（Stripe経由）"],
                ["支払時期", "申込時に初回決済、以降毎月自動更新"],
                ["サービス提供時期", "決済完了後、即時"],
                ["返品・キャンセル", "デジタルサービスのため返品不可。解約はいつでも可能で、解約月末まで利用可能。"],
                ["動作環境", "最新版の Chrome, Safari, Firefox, Edge。インターネット接続が必要。"],
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
        </div>
      </div>
    </main>
  );
}
