import Link from "next/link";
import {
  Zap,
  ArrowRight,
  MessageCircle,
  Target,
  PenTool,
  Brain,
  Clock,
  TrendingUp,
  CheckCircle,
  Shield,
  BarChart3,
} from "lucide-react";
import { EXAM_CATEGORIES } from "@/lib/exams";

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors">
      <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[var(--color-accent)]" />
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function ComparisonRow({
  feature,
  yobiko,
  chatgpt,
  tensaku,
}: {
  feature: string;
  yobiko: string;
  chatgpt: string;
  tensaku: string;
}) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      <td className="py-4 px-4 text-sm font-medium">{feature}</td>
      <td className="py-4 px-4 text-sm text-[var(--color-text-secondary)] text-center">
        {yobiko}
      </td>
      <td className="py-4 px-4 text-sm text-[var(--color-text-secondary)] text-center">
        {chatgpt}
      </td>
      <td className="py-4 px-4 text-sm text-[var(--color-accent)] font-bold text-center">
        {tensaku}
      </td>
    </tr>
  );
}

export default function Home() {
  const nationalExams = EXAM_CATEGORIES.filter((e) => e.isNational);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-accent)]/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              無料で3回試せる
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-6">
              TENS<span className="text-[var(--color-accent)]">AKU</span>
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--color-text-secondary)] mb-4 max-w-2xl mx-auto leading-relaxed">
              国家試験・資格試験の
              <br className="sm:hidden" />
              <span className="text-[var(--color-text)] font-bold">
                AI学習パートナー
              </span>
            </p>
            <p className="text-[var(--color-text-muted)] mb-10 max-w-xl mx-auto">
              AIチューター、練習問題生成、論述添削。
              <br />
              あなた専用の講師が、24時間いつでも対応します。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors animate-pulse-glow"
              >
                無料で始める
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)] font-medium transition-colors"
              >
                詳しく見る
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Modes */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-center mb-4">
          3つの学習モード
        </h2>
        <p className="text-[var(--color-text-secondary)] text-center mb-12 max-w-xl mx-auto">
          予備校の講義・問題集・添削を、AIが1つのツールに凝縮。
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-6">
              <MessageCircle className="w-7 h-7 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-xl font-bold mb-3">AIチューター</h3>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-4">
              わからない論点をその場で質問。条文・判例・公式を正確に引用しながら、試験に直結する解説をします。
            </p>
            <ul className="space-y-2">
              {[
                "概念の解説・解き方のコツ",
                "語呂合わせ・暗記法の提案",
                "試験の傾向分析・学習計画",
                "弱点に合わせた個別指導",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-6">
              <Target className="w-7 h-7 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-xl font-bold mb-3">練習問題AI</h3>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-4">
              本番に限りなく近いオリジナル問題をAIが無限に生成。科目・分野・難易度を指定して集中特訓。
            </p>
            <ul className="space-y-2">
              {[
                "本番形式の4択問題を即座に生成",
                "全選択肢の詳細解説つき",
                "難易度5段階で調整可能",
                "弱点分野を重点的に出題",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-6">
              <PenTool className="w-7 h-7 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-xl font-bold mb-3">論述添削AI</h3>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-4">
              論文式試験の答案・小論文を、採点官と同じ視点で100点満点で添削。数十秒で結果を返却。
            </p>
            <ul className="space-y-2">
              {[
                "100点満点の多軸スコアリング",
                "段落ごとの詳細フィードバック",
                "具体的な書き直し例つき",
                "致命的ミスの優先警告",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Supported Exams */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-center mb-4">
          対応試験
        </h2>
        <p className="text-[var(--color-text-secondary)] text-center mb-12">
          主要な国家試験・資格試験をカバー。
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {nationalExams.map((exam) => (
            <div
              key={exam.id}
              className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors"
            >
              <span className="text-2xl mb-2 block">{exam.icon}</span>
              <p className="text-sm font-bold">{exam.shortName}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {exam.subjects.length}科目対応
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-center mb-4">
          ChatGPTに聞くのとは何が違う？
        </h2>
        <p className="text-[var(--color-text-secondary)] text-center mb-12 max-w-2xl mx-auto">
          ChatGPTは汎用AI。TENSAKUは試験合格のためだけに設計されたAI。
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={Brain}
            title="試験特化の知識"
            description="各試験の出題傾向・採点基準・頻出論点を深く理解。「試験でどう問われるか」の視点で全て回答。"
          />
          <FeatureCard
            icon={Target}
            title="無限の練習問題"
            description="本番と同じ形式・難易度のオリジナル問題をAIが生成。過去問を解き尽くしても、練習を止める必要がない。"
          />
          <FeatureCard
            icon={BarChart3}
            title="弱点の可視化"
            description="練習結果を自動分析。どの科目・分野が弱いか一目でわかり、効率的な学習ができる。"
          />
          <FeatureCard
            icon={PenTool}
            title="論述の即時添削"
            description="予備校は返却まで1〜2週間。TENSAKUは数十秒。深夜でも早朝でも、何度でも添削。"
          />
          <FeatureCard
            icon={Clock}
            title="24時間いつでも"
            description="深夜3時の追い込みでも、通勤電車の中でも。質問したい時にすぐ聞ける。予約不要。"
          />
          <FeatureCard
            icon={Shield}
            title="正確な引用"
            description="条文番号・判例名・会計基準を正確に引用。不確実な場合は正直に伝える。嘘の知識を教えない。"
          />
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-center mb-12">
          他の学習方法との比較
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
                <th className="py-4 px-4 text-left text-sm font-medium text-[var(--color-text-muted)]" />
                <th className="py-4 px-4 text-center text-sm font-medium text-[var(--color-text-muted)]">
                  予備校
                </th>
                <th className="py-4 px-4 text-center text-sm font-medium text-[var(--color-text-muted)]">
                  ChatGPT
                </th>
                <th className="py-4 px-4 text-center text-sm font-medium text-[var(--color-accent)]">
                  TENSAKU
                </th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow feature="月額料金" yobiko="3〜10万円" chatgpt="$20/月" tensaku="9,800円/月" />
              <ComparisonRow feature="質問対応" yobiko="講義後のみ" chatgpt="即座" tensaku="即座" />
              <ComparisonRow feature="試験特化度" yobiko="高い" chatgpt="低い" tensaku="高い" />
              <ComparisonRow feature="練習問題生成" yobiko="なし" chatgpt="不安定" tensaku="本番形式で無限" />
              <ComparisonRow feature="論述添削" yobiko="1〜2週間" chatgpt="曖昧" tensaku="数十秒" />
              <ComparisonRow feature="弱点分析" yobiko="模試のみ" chatgpt="なし" tensaku="自動分析" />
              <ComparisonRow feature="利用時間" yobiko="講義時間のみ" chatgpt="24時間" tensaku="24時間" />
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-center mb-12">料金</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
            <h3 className="text-lg font-bold mb-2">無料プラン</h3>
            <div className="text-3xl font-black mb-4">¥0</div>
            <ul className="space-y-3 mb-8">
              {[
                "3回まで利用可能",
                "全試験・全モード対応",
                "AIチューター・練習問題・添削",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-secondary)] font-medium transition-colors"
            >
              無料で始める
            </Link>
          </div>

          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border-2 border-[var(--color-accent)] relative">
            <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold">
              おすすめ
            </div>
            <h3 className="text-lg font-bold mb-2">プロプラン</h3>
            <div className="text-3xl font-black mb-1">
              ¥9,800
              <span className="text-sm font-normal text-[var(--color-text-secondary)]">
                /月
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              予備校の1/10以下の費用
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "全モード無制限",
                "全試験・全科目対応",
                "AIチューター会話履歴",
                "弱点分析・学習進捗",
                "練習問題の結果記録",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-colors"
            >
              プロプランで始める
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-center mb-12">
          よくある質問
        </h2>
        <div className="space-y-6">
          {[
            {
              q: "ChatGPTで十分では？",
              a: "ChatGPTは汎用AIです。試験ごとの採点基準・出題傾向・頻出論点を理解していません。TENSAKUは各試験のプロとして回答するため、的外れな学習を防げます。",
            },
            {
              q: "どの試験に対応していますか？",
              a: "司法試験・予備試験、中小企業診断士、公認会計士、行政書士、社労士、宅建士、FP、公務員試験、医師・看護師国家試験、大学入試小論文に対応。順次追加中。",
            },
            {
              q: "AIが間違った知識を教えることはありませんか？",
              a: "100%正確とは保証できませんが、不確実な場合は正直に「要確認」と伝えます。条文・判例は番号まで引用するため、自分で検証もしやすい設計です。",
            },
            {
              q: "練習問題のレベルは本番に近いですか？",
              a: "各試験の過去の出題傾向を学習したAIが生成するため、本番に近い形式・難易度です。難易度は5段階で調整可能。",
            },
            {
              q: "無料プランで何ができますか？",
              a: "3回まで全機能が使えます。AIチューター、練習問題、添削の全モードを試せます。",
            },
            {
              q: "解約はいつでもできますか？",
              a: "はい。いつでも解約可能。解約後も月末まで利用できます。",
            },
          ].map((faq) => (
            <div
              key={faq.q}
              className="p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
            >
              <h3 className="font-bold mb-2">{faq.q}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center p-12 rounded-3xl bg-gradient-to-b from-[var(--color-accent)]/10 to-transparent border border-[var(--color-accent)]/20">
          <h2 className="text-3xl font-black mb-4">
            合格への最短ルートを、AIと。
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8 max-w-lg mx-auto">
            無料で3回試せます。まずはあなたの試験で質問してみてください。
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-colors"
          >
            無料で始める
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            &copy; 2026 TENSAKU
          </p>
          <div className="flex gap-6 text-sm text-[var(--color-text-muted)]">
            <Link href="/terms" className="hover:text-[var(--color-text-secondary)]">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:text-[var(--color-text-secondary)]">
              プライバシーポリシー
            </Link>
            <Link href="/legal" className="hover:text-[var(--color-text-secondary)]">
              特定商取引法に基づく表記
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
