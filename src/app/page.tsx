import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ChevronDown } from "lucide-react";
import {
  ArrowRight,
  MessageCircle,
  Target,
  PenTool,
  Brain,
  Clock,
  CheckCircle,
  BarChart3,
  Sparkles,
  BookOpen,
  GraduationCap,
  Lightbulb,
  Eye,
  TrendingUp,
  Layers,
  Network,
  FlaskConical,
  Swords,
  HelpCircle,
} from "lucide-react";
import { EXAM_CATEGORIES } from "@/lib/exams";

/* ─────────────── 共通コンポーネント ─────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-accent)]/8 border border-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-bold tracking-wider uppercase mb-6">
      {children}
    </div>
  );
}

function LayerCard({
  number,
  name,
  nameEn,
  tagline,
  description,
  details,
  color,
  borderColor,
}: {
  number: string;
  name: string;
  nameEn: string;
  tagline: string;
  description: string;
  details: string[];
  color: string;
  borderColor: string;
}) {
  return (
    <div className={`relative p-8 rounded-2xl bg-[var(--color-bg-card)] border-2 ${borderColor} transition-all duration-300 hover:-translate-y-1 group overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${color}`} />
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${color} text-white`}>
          LAYER {number}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] font-medium">{nameEn}</span>
      </div>
      <h3 className="text-2xl font-black mb-2">{name}</h3>
      <p className="text-[var(--color-accent)] font-bold text-sm mb-3">{tagline}</p>
      <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-5">
        {description}
      </p>
      <ul className="space-y-2">
        {details.map((d) => (
          <li key={d} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
            <CheckCircle className="w-4 h-4 text-[var(--color-success)] mt-0.5 shrink-0" />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors">
      <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[var(--color-accent)]" />
      </div>
      <div>
        <h4 className="text-sm font-bold mb-1">{title}</h4>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-black text-[var(--color-accent)]">{value}</div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1">{label}</div>
    </div>
  );
}

function ComparisonRow({
  feature,
  yobiko,
  chatgpt,
  studyengines,
}: {
  feature: string;
  yobiko: string;
  chatgpt: string;
  studyengines: string;
}) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      <td className="py-4 px-4 text-sm font-medium">{feature}</td>
      <td className="py-4 px-4 text-sm text-[var(--color-text-secondary)] text-center">{yobiko}</td>
      <td className="py-4 px-4 text-sm text-[var(--color-text-secondary)] text-center">{chatgpt}</td>
      <td className="py-4 px-4 text-sm text-[var(--color-accent)] font-bold text-center">{studyengines}</td>
    </tr>
  );
}

/* ─────────────── メイン ─────────────── */

export default function Home() {
  const examCount = EXAM_CATEGORIES.length;

  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* ━━━ Hero ━━━ */}
      <section className="relative overflow-hidden mesh-hero">
        <div className="absolute inset-0 grid-pattern" />
        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-sm font-medium mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4" />
              3層AIで、勉強した時間がゼロにならない
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 animate-fade-in">
              学びながら、
              <br />
              <span className="text-[var(--color-accent)]">自分専用AI</span>を育てる。
            </h1>

            <p className="text-lg sm:text-xl text-[var(--color-text-secondary)] mb-5 max-w-2xl mx-auto leading-relaxed animate-fade-in">
              AIが教え、AIが検証し、あなたの知識だけで構築されるAIが育つ。
              <br className="hidden sm:block" />
              合格した後も、知識が<span className="font-bold text-[var(--color-text)]">資産</span>として残り続ける。
            </p>

            <p className="text-sm text-[var(--color-text-muted)] mb-10 animate-fade-in">
              {examCount}試験対応 / 9つの学習モード / 無料で試せる
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-all duration-300 animate-pulse-glow hover:scale-105"
              >
                無料で始める
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#three-layers"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] font-medium transition-all duration-300"
              >
                3層AIとは？
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ 数字で見る ━━━ */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-4xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <StatCard value={`${examCount}`} label="対応試験" />
          <StatCard value="9" label="学習モード" />
          <StatCard value="3層" label="AI構造" />
          <StatCard value="24h" label="いつでも対応" />
        </div>
      </section>

      {/* ━━━ 問題提起 ━━━ */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <SectionLabel>問題</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-black mb-6 leading-tight">
          勉強した時間、<br className="sm:hidden" />本当に身についていますか？
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 mt-12 text-left">
          <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="text-2xl mb-3">😰</div>
            <h3 className="font-bold mb-2 text-sm">有能感の錯覚</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              テキストを読んで「わかった気」になる。練習問題で正解しても、説明を求められると答えられない。学習者は自分のスコアを実際より15-20%高く見積もる。
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="text-2xl mb-3">🗑️</div>
            <h3 className="font-bold mb-2 text-sm">合格したら終わり</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              予備校もChatGPTも「合格」がゴール。合格した瞬間、勉強した知識は散逸していく。何百時間もかけた知識が、資産として残らない。
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="font-bold mb-2 text-sm">AIの知識は平均値</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              ChatGPTに聞けば何でも答える。でもそれはインターネットの平均値。あなた固有の理解、経験、間違いのパターンは一切反映されない。
            </p>
          </div>
        </div>
      </section>

      {/* ━━━ 3層AI構造 ━━━ */}
      <section id="three-layers" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <SectionLabel>核心技術</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">
            3層AI構造
          </h2>
          <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            教えるAI、検証するAI、あなたの知識の分身AI。<br />
            3つのAIが連携して、「わかったつもり」を構造的に破壊する。
          </p>
        </div>

        {/* フロー図 */}
        <div className="flex flex-col items-center gap-3 mb-16">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-600 bg-rose-50 px-4 py-2 rounded-full border border-rose-200">
            <BookOpen className="w-4 h-4" /> Mentor が教える
          </div>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <div className="text-xs text-[var(--color-text-muted)]">知識をインプット</div>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm font-bold text-violet-600 bg-violet-50 px-4 py-2 rounded-full border border-violet-200">
            <FlaskConical className="w-4 h-4" /> Prism が検証する
          </div>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <div className="text-xs text-[var(--color-text-muted)]">検証済みの知識だけが通過</div>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
            <Network className="w-4 h-4" /> Core に蓄積される
          </div>
        </div>

        {/* 3カード */}
        <div className="grid md:grid-cols-3 gap-6">
          <LayerCard
            number="1"
            name="Mentor"
            nameEn="メンター"
            tagline="教えるAI"
            description="RAG教材に基づく正確な知識をインプット。条文番号・判例名を引用し、不確実な情報は「要確認」と明記。ハルシネーションをここで止める。"
            details={[
              "条文・判例・会計基準を正確に引用",
              "試験ごとの出題傾向を理解",
              "語呂合わせ・暗記法も提案",
              "わからない論点を即座に質問",
            ]}
            color="bg-rose-500"
            borderColor="border-rose-200 hover:border-rose-400"
          />
          <LayerCard
            number="2"
            name="Prism"
            nameEn="プリズム"
            tagline="検証するAI — 門番"
            description="ユーザーの知識を分解・検証する門番。間違いを検知しても正解を教えず、自力で修正させる。「暗記」を「理解」に変換するプロセス。"
            details={[
              "6段階の質問で理解度を測定",
              "戦略的に間違えて弱点を暴く",
              "正解を教えない — 自力修正が核心",
              "検証済みの知識だけをCoreに渡す",
            ]}
            color="bg-violet-500"
            borderColor="border-violet-200 hover:border-violet-400"
          />
          <LayerCard
            number="3"
            name="Core"
            nameEn="コア"
            tagline="あなたの知識の分身"
            description="まっさらなAIに、あなたが教えた知識だけが蓄積される。ChatGPTは百科事典。Coreはあなたの脳のクローン。世界に1つだけ。"
            details={[
              "Coreの穴 = あなたの知識の穴",
              "知識マップとして可視化",
              "時間が経つほど価値が上がる",
              "将来、知識資産として収益化可能",
            ]}
            color="bg-emerald-500"
            borderColor="border-emerald-200 hover:border-emerald-400"
          />
        </div>
      </section>

      {/* ━━━ Prism 修正ループ詳細 ━━━ */}
      <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <SectionLabel>最重要プロセス</SectionLabel>
            <h2 className="text-3xl font-black mb-4">
              Prismの修正ループ
            </h2>
            <p className="text-[var(--color-text-secondary)] max-w-xl mx-auto">
              間違えた時こそ、最も学べる瞬間。<br />
              AIが正解を言わないことが、このシステムの核心です。
            </p>
          </div>

          <div className="max-w-lg mx-auto space-y-0">
            {[
              { step: "1", text: "あなたが間違える", sub: "Prismが誤りを検知" },
              { step: "2", text: "「なぜそう思った？」", sub: "AIが原因を掘る（正解は教えない）" },
              { step: "3", text: "自分の誤解の原因に気づく", sub: "思考の癖が見える" },
              { step: "4", text: "「正しくはどうなると思う？」", sub: "自力で修正させる" },
              { step: "5", text: "自分の言葉で正しく説明し直す", sub: "暗記ではなく理解に変換" },
              { step: "6", text: "検証済みの知識がCoreに蓄積", sub: "二度と同じ間違いをしない" },
            ].map((item, i) => (
              <div key={item.step} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {item.step}
                  </div>
                  {i < 5 && <div className="w-px h-10 bg-[var(--color-border)]" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-bold">{item.text}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-accent)]/20 text-center">
            <p className="text-sm font-bold text-[var(--color-accent)] mb-1">科学的根拠</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-lg mx-auto">
              教えることで学ぶ「プロテジェ効果」は定着率90%（講義を聞くだけの18倍）。
              ファインマン・テクニックの研究では平均パフォーマンスが2倍に向上。
              Prismはこの科学的知見をAIで自動化したシステムです。
            </p>
          </div>
        </div>
      </section>

      {/* ━━━ 9つの学習モード ━━━ */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>学習モード</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">9つのモードで、あらゆる角度から学ぶ</h2>
          <p className="text-[var(--color-text-secondary)] max-w-xl mx-auto">
            インプットから仕上げまで。3層AIが全モードを貫通する。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* インプット */}
          <div>
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-rose-200">
              <div className="w-6 h-6 rounded bg-rose-500 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-black text-rose-600">インプット</span>
              <span className="text-xs text-[var(--color-text-muted)]">Mentor層</span>
            </div>
            <div className="space-y-1">
              <ModeItem icon={MessageCircle} title="AIチューター" description="わからない論点をその場で質問。条文・判例を引用しながら、試験に直結する解説。" />
              <ModeItem icon={Layers} title="暗記カード" description="AI自動生成 + 間隔反復。科学的に最適なタイミングで復習を提示。" />
              <ModeItem icon={Target} title="練習問題" description="本番形式の問題をAIが無限に生成。弱点を自動検出して重点出題。" />
            </div>
          </div>

          {/* 深い理解 */}
          <div>
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-violet-200">
              <div className="w-6 h-6 rounded bg-violet-500 flex items-center justify-center">
                <FlaskConical className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-black text-violet-600">深い理解</span>
              <span className="text-xs text-[var(--color-text-muted)]">Prism層</span>
            </div>
            <div className="space-y-1">
              <ModeItem icon={GraduationCap} title="教えてマスター" description="逆転授業。あなたが先生、AIが生徒。6段階質問と戦略的間違いで理解度を暴く。" />
              <ModeItem icon={HelpCircle} title="ソクラテス式問答" description="AIが答えを教えず、問いだけ投げて自力到達させる。思考力を鍛える。" />
              <ModeItem icon={Lightbulb} title="ケーススタディ" description="実際の事例シナリオで判断を迫る。知識を実務に接続する。" />
            </div>
          </div>

          {/* 仕上げ */}
          <div>
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-emerald-200">
              <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
                <Network className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-black text-emerald-600">仕上げ</span>
              <span className="text-xs text-[var(--color-text-muted)]">Core蓄積</span>
            </div>
            <div className="space-y-1">
              <ModeItem icon={Swords} title="弱点ドリル" description="弱点を自動抽出して連続出題。穴を埋めるまで止まらない。" />
              <ModeItem icon={PenTool} title="論述添削" description="100点満点で多軸採点。構成・論理・正確性・表現の4軸で即時フィードバック。" />
              <ModeItem icon={BarChart3} title="学習分析" description="弱点・正答率・ストリーク・合格予測をリアルタイムで可視化。" />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ ChatGPTとの違い ━━━ */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>比較</SectionLabel>
          <h2 className="text-3xl font-black mb-4">ChatGPTに聞くのとは何が違う？</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-14">
          <div className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="text-sm font-bold text-[var(--color-text-muted)] mb-4">ChatGPT / Claude</div>
            <ul className="space-y-3">
              {[
                "インターネットの平均値で回答",
                "試験の採点基準を知らない",
                "間違いを指摘しても正解を教えてしまう",
                "あなたの弱点を覚えていない",
                "使い終わったら何も残らない",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)] mt-0.5">-</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-8 rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-bg-card)]">
            <div className="text-sm font-bold text-[var(--color-accent)] mb-4">StudyEngines</div>
            <ul className="space-y-3">
              {[
                "試験ごとの教材・条文・判例に基づいて回答",
                "採点基準・出題傾向を理解して指導",
                "正解を教えず、自力で修正させる（Prism）",
                "弱点を自動検出して重点的に強化",
                "Coreにあなただけの知識資産が蓄積される",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)] mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="py-4 px-4 text-left text-sm font-medium text-[var(--color-text-muted)]" />
                <th className="py-4 px-4 text-center text-sm font-medium text-[var(--color-text-muted)]">予備校</th>
                <th className="py-4 px-4 text-center text-sm font-medium text-[var(--color-text-muted)]">ChatGPT</th>
                <th className="py-4 px-4 text-center text-sm font-medium">
                  <span className="text-[var(--color-accent)] font-bold">StudyEngines</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow feature="月額料金" yobiko="3〜10万円" chatgpt="$20/月" studyengines="9,800円/月" />
              <ComparisonRow feature="質問対応" yobiko="講義後のみ" chatgpt="即座" studyengines="即座" />
              <ComparisonRow feature="試験特化度" yobiko="高い" chatgpt="低い" studyengines="高い" />
              <ComparisonRow feature="理解度の検証" yobiko="模試のみ" chatgpt="なし" studyengines="Prismが常時検証" />
              <ComparisonRow feature="知識の蓄積" yobiko="なし" chatgpt="なし" studyengines="Coreに自動蓄積" />
              <ComparisonRow feature="弱点分析" yobiko="模試のみ" chatgpt="なし" studyengines="自動分析" />
              <ComparisonRow feature="合格後の価値" yobiko="なし" chatgpt="なし" studyengines="知識資産として残る" />
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━━ 対応試験 ━━━ */}
      <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <SectionLabel>対応試験</SectionLabel>
            <h2 className="text-3xl font-black mb-4">{examCount}の試験に対応</h2>
            <p className="text-[var(--color-text-secondary)]">国家試験から資格試験まで幅広くカバー。順次追加中。</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {EXAM_CATEGORIES.map((exam) => (
              <div
                key={exam.id}
                className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors"
              >
                <p className="text-sm font-bold">{exam.shortName}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {exam.subjects.length}科目{exam.hasEssay ? " / 論述あり" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 学習中の体験価値 ━━━ */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>体験価値</SectionLabel>
          <h2 className="text-3xl font-black mb-4">学習中に起きること</h2>
          <p className="text-[var(--color-text-secondary)] max-w-xl mx-auto">
            「将来知識が資産になる」だけじゃない。学んでいる今この瞬間に価値がある。
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { icon: Eye, title: "知識の穴の発見", text: "教えようとして「説明できない」。練習問題で正解していたのに教えられない = 本当は理解していなかった。" },
            { icon: Network, title: "知識の再構築", text: "バラバラだった知識が教える過程で繋がる。「あ、これとこれ関係あったのか」。" },
            { icon: TrendingUp, title: "Coreの成長を見る", text: "先週5項目が今週15項目に。学習の積み重ねが目に見える。モチベーションが続く。" },
            { icon: Brain, title: "思考の言語化", text: "なんとなくの理解を言葉にする訓練。論述・面接・口述試験に直結するスキル。" },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-1">{item.title}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ 料金 ━━━ */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>料金</SectionLabel>
          <h2 className="text-3xl font-black mb-4">予備校の1/10以下</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
            <h3 className="text-lg font-bold mb-2">無料プラン</h3>
            <div className="text-4xl font-black mb-6">¥0</div>
            <ul className="space-y-3 mb-8">
              {["3回まで利用可能", "全試験・全モード対応", "3層AI体験"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] font-medium transition-all duration-300"
            >
              無料で始める
            </Link>
          </div>

          {/* Pro */}
          <div className="p-8 rounded-2xl bg-[var(--color-bg-card)] border-2 border-[var(--color-accent)] relative">
            <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold">
              おすすめ
            </div>
            <h3 className="text-lg font-bold mb-2">プロプラン</h3>
            <div className="text-4xl font-black mb-1">
              ¥9,800
              <span className="text-sm font-normal text-[var(--color-text-secondary)]">/月</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">予備校の1/10以下の費用</p>
            <ul className="space-y-3 mb-8">
              {[
                "9モード全て無制限",
                "3層AI（Mentor/Prism/Core）",
                "合格予測・学習パス",
                "弱点分析・知識マップ",
                "Core知識蓄積",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold transition-all duration-300 hover:scale-[1.02]"
            >
              プロプランで始める
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ FAQ ━━━ */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="text-3xl font-black">よくある質問</h2>
        </div>
        <div className="space-y-4">
          {[
            {
              q: "3層AIとは何ですか？",
              a: "Mentor（教えるAI）、Prism（検証するAI）、Core（あなたの知識の分身AI）の3つが連携するシステムです。Mentorで知識を入れ、Prismが本当に理解しているか検証し、検証済みの知識だけがCoreに蓄積されます。",
            },
            {
              q: "ChatGPTで十分では？",
              a: "ChatGPTは汎用AIです。試験ごとの採点基準・出題傾向を理解していません。また、間違いを指摘すると正解を教えてしまいます。StudyEnginesのPrismは正解を教えず自力修正させることで、暗記ではなく理解を促します。",
            },
            {
              q: "Coreは具体的に何をするのですか？",
              a: "あなたが学習する過程で検証された知識だけを蓄積する、まっさらなAIです。ChatGPTの知識は世界共通ですが、Coreの中身はあなただけのもの。Coreの穴 = あなたの知識の穴として可視化されます。",
            },
            {
              q: "AIが間違った知識を教えることはありませんか？",
              a: "100%正確とは保証できませんが、Mentorは教材データベースに基づいて回答し、不確実な場合は「要確認」と明記します。条文番号・判例名を引用するため自分で検証しやすい設計です。",
            },
            {
              q: "どの試験に対応していますか？",
              a: `${examCount}試験に対応しています。司法試験・予備試験、行政書士、宅建士、公認会計士、中小企業診断士、社労士、FP、公務員試験、医師・看護師国家試験、ITパスポートなど。順次追加中です。`,
            },
            {
              q: "無料プランで何ができますか？",
              a: "3回まで全機能が使えます。9つの学習モード全て、3層AI全てを体験できます。まずは自分の試験で試してみてください。",
            },
            {
              q: "解約はいつでもできますか？",
              a: "はい。いつでも解約可能で、解約後も月末まで利用できます。Coreに蓄積された知識データはエクスポート可能です。",
            },
          ].map((faq) => (
            <details
              key={faq.q}
              className="faq-item p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] group"
            >
              <summary className="font-bold flex items-center justify-between cursor-pointer">
                {faq.q}
                <ChevronDown className="faq-chevron w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
              </summary>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-3">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ━━━ CTA ━━━ */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="relative text-center p-14 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 mesh-hero" />
          <div className="absolute inset-0 border border-[var(--color-accent)]/20 rounded-3xl" />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              勉強した時間を、ゼロにしない。
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-8 max-w-lg mx-auto">
              無料で3回試せます。まずはあなたの試験で、3層AIを体験してください。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg transition-all duration-300 hover:scale-105"
            >
              無料で始める
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ Footer ━━━ */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">&copy; 2026 StudyEngines</p>
          <div className="flex gap-6 text-sm text-[var(--color-text-muted)]">
            <Link href="/terms" className="hover:text-[var(--color-text-secondary)]">利用規約</Link>
            <Link href="/privacy" className="hover:text-[var(--color-text-secondary)]">プライバシーポリシー</Link>
            <Link href="/legal" className="hover:text-[var(--color-text-secondary)]">特定商取引法に基づく表記</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
