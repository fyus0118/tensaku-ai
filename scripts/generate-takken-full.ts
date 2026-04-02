/**
 * 宅建試験 完全教材生成スクリプト
 *
 * 157トピック × 5,000-10,000字 = 約80万-150万字の教材を生成
 *
 * 設計思想:
 *   - 各トピックに必要な条文を正確にマッピング
 *   - 条文がある場合: 条文を根拠にClaude生成（ハルシネーション最小化）
 *   - 条文がない場合: Claude知識ベース + 厳格な不確実性表記
 *   - 全トピック進捗管理付き（中断→再開可能）
 *
 * 使い方:
 *   source .env.local && bun run scripts/generate-takken-full.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const OUTPUT_DIR = "./scripts/materials-v3";
const LAWS_DIR = "./scripts/laws";
const OUTPUT_FILE = `${OUTPUT_DIR}/takken-full.json`;
const PROGRESS_FILE = `${OUTPUT_DIR}/_takken_progress.json`;

// ========== 法令データ =============================================

interface LawArticle {
  article: string;
  content: string;
  articleNum?: number; // 正規化された条番号
}

function loadLaw(name: string): LawArticle[] {
  const file = `${LAWS_DIR}/${name}.json`;
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, "utf-8"));
  const articles: LawArticle[] = data.articles || [];
  // 条番号を正規化
  for (const a of articles) {
    const m = a.article.match(/第(\d+)/);
    if (m) a.articleNum = parseInt(m[1]);
  }
  return articles;
}

function getArticleRange(articles: LawArticle[], from: number, to: number): string {
  return articles
    .filter(a => a.articleNum !== undefined && a.articleNum >= from && a.articleNum <= to)
    .map(a => `${a.article}\n${a.content}`)
    .join("\n\n");
}

function getArticlesByKeywords(articles: LawArticle[], keywords: string[]): string {
  const matched = articles.filter(a => {
    const text = a.article + a.content;
    return keywords.some(kw => text.includes(kw));
  });
  return matched.map(a => `${a.article}\n${a.content}`).join("\n\n");
}

// 法令全文キャッシュ
const lawCache: Record<string, LawArticle[]> = {};
function getLaw(name: string): LawArticle[] {
  if (!lawCache[name]) lawCache[name] = loadLaw(name);
  return lawCache[name];
}

// ========== トピック定義 ============================================

interface TopicDef {
  subject: string;
  topic: string;
  lawSource: () => string; // 遅延評価で条文取得
  extraContext?: string;   // 条文がない場合の補足
}

// --- 民法 ---
const minpo = () => getLaw("民法");

const TOPICS: TopicDef[] = [
  // ── 民法総則 ──
  { subject: "民法総則", topic: "制限行為能力者（未成年者・成年被後見人・被保佐人・被補助人）",
    lawSource: () => getArticleRange(minpo(), 4, 21) },
  { subject: "民法総則", topic: "意思表示（心裡留保・虚偽表示）",
    lawSource: () => getArticleRange(minpo(), 93, 94) },
  { subject: "民法総則", topic: "意思表示（錯誤）",
    lawSource: () => getArticleRange(minpo(), 95, 95) },
  { subject: "民法総則", topic: "意思表示（詐欺・強迫）",
    lawSource: () => getArticleRange(minpo(), 96, 98) },
  { subject: "民法総則", topic: "代理の基本（有権代理・代理権の範囲・復代理）",
    lawSource: () => getArticleRange(minpo(), 99, 107) },
  { subject: "民法総則", topic: "無権代理（無権代理人の責任・相手方の催告権・取消権）",
    lawSource: () => getArticleRange(minpo(), 113, 118) },
  { subject: "民法総則", topic: "表見代理（109条・110条・112条）",
    lawSource: () => getArticleRange(minpo(), 109, 112) },
  { subject: "民法総則", topic: "時効（取得時効）",
    lawSource: () => getArticleRange(minpo(), 162, 165) },
  { subject: "民法総則", topic: "時効（消滅時効・時効の完成猶予と更新）",
    lawSource: () => getArticleRange(minpo(), 166, 174) },
  { subject: "民法総則", topic: "条件・期限・期間の計算",
    lawSource: () => getArticleRange(minpo(), 127, 143) },

  // ── 物権 ──
  { subject: "物権", topic: "物権変動（意思主義・176条）",
    lawSource: () => getArticleRange(minpo(), 175, 176) },
  { subject: "物権", topic: "不動産の対抗要件（177条・登記）",
    lawSource: () => getArticleRange(minpo(), 177, 177),
    extraContext: "177条の「第三者」の範囲に関する重要判例を網羅すること。背信的悪意者排除論、単なる悪意者は第三者に含まれること、不法占拠者・不法行為者・無権利者は含まれないこと等。" },
  { subject: "物権", topic: "動産の対抗要件（178条・引渡し）",
    lawSource: () => getArticleRange(minpo(), 178, 178),
    extraContext: "引渡しの4態様（現実の引渡し・簡易の引渡し・占有改定・指図による占有移転）を全て解説すること。" },
  { subject: "物権", topic: "即時取得（192条）",
    lawSource: () => getArticleRange(minpo(), 192, 194) },
  { subject: "物権", topic: "共有（持分・管理・分割）",
    lawSource: () => getArticleRange(minpo(), 249, 264) },
  { subject: "物権", topic: "所有権の取得（付合・混和・加工）",
    lawSource: () => getArticleRange(minpo(), 239, 248) },
  { subject: "物権", topic: "占有権（占有の態様・回収の訴え）",
    lawSource: () => getArticleRange(minpo(), 180, 205) },
  { subject: "物権", topic: "地上権・地役権",
    lawSource: () => getArticleRange(minpo(), 265, 294) },
  { subject: "物権", topic: "用益物権と担保物権の全体像",
    lawSource: () => getArticleRange(minpo(), 175, 179) + "\n\n" + getArticleRange(minpo(), 265, 268) + "\n\n" + getArticleRange(minpo(), 295, 302) + "\n\n" + getArticleRange(minpo(), 342, 351) + "\n\n" + getArticleRange(minpo(), 369, 372),
    extraContext: "物権の全体構造を俯瞰する内容。用益物権（地上権・地役権・永小作権）と担保物権（留置権・先取特権・質権・抵当権）の分類、それぞれの特徴を比較整理。" },

  // ── 担保物権 ──
  { subject: "担保物権", topic: "留置権（成立要件・効力・消滅）",
    lawSource: () => getArticleRange(minpo(), 295, 302) },
  { subject: "担保物権", topic: "先取特権（種類・順位）",
    lawSource: () => getArticleRange(minpo(), 303, 341) },
  { subject: "担保物権", topic: "質権（動産質・不動産質・権利質）",
    lawSource: () => getArticleRange(minpo(), 342, 368) },
  { subject: "担保物権", topic: "抵当権の基本（設定・効力の及ぶ範囲・被担保債権の範囲）",
    lawSource: () => getArticleRange(minpo(), 369, 375) },
  { subject: "担保物権", topic: "抵当権の順位（順位の変更・譲渡・放棄）",
    lawSource: () => getArticleRange(minpo(), 373, 377) },
  { subject: "担保物権", topic: "法定地上権（成立要件・判例）",
    lawSource: () => getArticleRange(minpo(), 388, 388),
    extraContext: "法定地上権の成立要件4つ：①抵当権設定時に土地上に建物が存在、②土地と建物が同一所有者、③土地または建物に抵当権設定、④競売で土地と建物が別所有者に。判例：一番抵当権設定時基準説、更地への抵当権設定後の建物築造（不成立）、共同抵当の場合。" },
  { subject: "担保物権", topic: "一括競売・抵当権と賃借権の関係",
    lawSource: () => getArticleRange(minpo(), 387, 389) + "\n\n" + getArticleRange(minpo(), 395, 395) },
  { subject: "担保物権", topic: "物上代位（目的・差押えの要否・判例）",
    lawSource: () => getArticleRange(minpo(), 304, 304) + "\n\n" + getArticleRange(minpo(), 372, 372),
    extraContext: "物上代位の対象（売却代金・賃料・保険金・損害賠償金）、「払渡し又は引渡し前」の差押えが必要（304条1項ただし書）、抵当権者による賃料への物上代位と賃借人の相殺の優劣。" },
  { subject: "担保物権", topic: "根抵当権（元本確定・極度額・譲渡）",
    lawSource: () => getArticleRange(minpo(), 398, 399) },
  { subject: "担保物権", topic: "抵当権の処分（転抵当・譲渡・放棄・順位の譲渡・放棄）",
    lawSource: () => getArticleRange(minpo(), 376, 377) },

  // ── 債権総論 ──
  { subject: "債権総論", topic: "債務不履行（履行遅滞・履行不能・不完全履行）",
    lawSource: () => getArticleRange(minpo(), 412, 418) },
  { subject: "債権総論", topic: "損害賠償（予定・過失相殺・金銭債務の特則）",
    lawSource: () => getArticleRange(minpo(), 416, 420) },
  { subject: "債権総論", topic: "債権者代位権（要件・効果・転用）",
    lawSource: () => getArticleRange(minpo(), 423, 423) },
  { subject: "債権総論", topic: "詐害行為取消権（要件・効果・期間制限）",
    lawSource: () => getArticleRange(minpo(), 424, 426) },
  { subject: "債権総論", topic: "連帯債務（成立・求償・絶対的効力事由）",
    lawSource: () => getArticleRange(minpo(), 432, 445) },
  { subject: "債権総論", topic: "保証債務（成立・性質・催告の抗弁権・検索の抗弁権）",
    lawSource: () => getArticleRange(minpo(), 446, 458) },
  { subject: "債権総論", topic: "連帯保証（催告・検索の抗弁権なし）",
    lawSource: () => getArticleRange(minpo(), 454, 465) },
  { subject: "債権総論", topic: "債権譲渡（対抗要件・異議をとどめない承諾）",
    lawSource: () => getArticleRange(minpo(), 466, 469) },
  { subject: "債権総論", topic: "弁済（第三者弁済・弁済による代位・受領権者としての外観）",
    lawSource: () => getArticleRange(minpo(), 473, 504) },
  { subject: "債権総論", topic: "相殺（要件・禁止事由・差押えとの関係）",
    lawSource: () => getArticleRange(minpo(), 505, 512) },

  // ── 契約各論 ──
  { subject: "契約各論", topic: "契約の成立（申込みと承諾・懸賞広告）",
    lawSource: () => getArticleRange(minpo(), 521, 532) },
  { subject: "契約各論", topic: "契約の解除（催告解除・無催告解除・解除の効果）",
    lawSource: () => getArticleRange(minpo(), 540, 548) },
  { subject: "契約各論", topic: "危険負担（債務者主義・536条）",
    lawSource: () => getArticleRange(minpo(), 536, 536) },
  { subject: "契約各論", topic: "同時履行の抗弁権（533条・適用場面）",
    lawSource: () => getArticleRange(minpo(), 533, 533) },
  { subject: "契約各論", topic: "売買（契約不適合責任・手付・買戻し）",
    lawSource: () => getArticleRange(minpo(), 555, 585) },
  { subject: "契約各論", topic: "贈与（書面・負担付贈与・死因贈与）",
    lawSource: () => getArticleRange(minpo(), 549, 554) },
  { subject: "契約各論", topic: "請負（担保責任・注文者の解除権・報酬の支払時期）",
    lawSource: () => getArticleRange(minpo(), 632, 642) },
  { subject: "契約各論", topic: "委任（善管注意義務・報酬・解除）",
    lawSource: () => getArticleRange(minpo(), 643, 656) },
  { subject: "契約各論", topic: "賃貸借（民法の規定・存続期間・修繕義務・転貸借）",
    lawSource: () => getArticleRange(minpo(), 601, 622) },
  { subject: "契約各論", topic: "使用貸借（成立・終了・貸主の死亡）",
    lawSource: () => getArticleRange(minpo(), 593, 600) },

  // ── 不法行為・その他 ──
  { subject: "不法行為・その他", topic: "一般不法行為（709条・要件・効果）",
    lawSource: () => getArticleRange(minpo(), 709, 711) },
  { subject: "不法行為・その他", topic: "使用者責任（715条・求償権）",
    lawSource: () => getArticleRange(minpo(), 715, 715) },
  { subject: "不法行為・その他", topic: "工作物責任（717条・占有者と所有者の責任）",
    lawSource: () => getArticleRange(minpo(), 717, 717) },
  { subject: "不法行為・その他", topic: "共同不法行為（719条・連帯責任）",
    lawSource: () => getArticleRange(minpo(), 719, 719) },
  { subject: "不法行為・その他", topic: "不当利得（703条・704条・特殊な不当利得）",
    lawSource: () => getArticleRange(minpo(), 703, 708) },
  { subject: "不法行為・その他", topic: "事務管理",
    lawSource: () => getArticleRange(minpo(), 697, 702) },

  // ── 親族・相続 ──
  { subject: "親族・相続", topic: "相続人の範囲と順位（配偶者・子・直系尊属・兄弟姉妹）",
    lawSource: () => getArticleRange(minpo(), 886, 895) },
  { subject: "親族・相続", topic: "代襲相続（要件・再代襲・欠格と廃除の違い）",
    lawSource: () => getArticleRange(minpo(), 887, 891) },
  { subject: "親族・相続", topic: "法定相続分の計算（配偶者と子・直系尊属・兄弟姉妹）",
    lawSource: () => getArticleRange(minpo(), 900, 905) },
  { subject: "親族・相続", topic: "遺産分割（協議・審判・遺産分割前の処分）",
    lawSource: () => getArticleRange(minpo(), 906, 914) },
  { subject: "親族・相続", topic: "相続の承認と放棄（単純承認・限定承認・放棄の期間と効果）",
    lawSource: () => getArticleRange(minpo(), 915, 940) },
  { subject: "親族・相続", topic: "遺言（自筆証書・公正証書・秘密証書・検認）",
    lawSource: () => getArticleRange(minpo(), 960, 1003) },
  { subject: "親族・相続", topic: "遺留分（権利者・割合・遺留分侵害額請求権）",
    lawSource: () => getArticleRange(minpo(), 1042, 1049) },
  { subject: "親族・相続", topic: "配偶者居住権（成立・存続期間・登記）",
    lawSource: () => getArticleRange(minpo(), 1028, 1041) },

  // ── 借地借家法 ──
  ...(() => {
    const shakuchi = () => getLaw("借地借家法");
    return [
      { subject: "借地借家法", topic: "借地権の存続期間（当初30年・更新1回目20年・以後10年）",
        lawSource: () => getArticleRange(shakuchi(), 3, 4) },
      { subject: "借地借家法", topic: "借地権の更新（法定更新・建物再築と更新）",
        lawSource: () => getArticleRange(shakuchi(), 5, 8) },
      { subject: "借地借家法", topic: "借地上の建物の再築（地主の承諾・裁判所の許可）",
        lawSource: () => getArticleRange(shakuchi(), 7, 8) + "\n\n" + getArticleRange(shakuchi(), 18, 20) },
      { subject: "借地借家法", topic: "定期借地権（一般定期・事業用定期・建物譲渡特約付）",
        lawSource: () => getArticleRange(shakuchi(), 22, 25) },
      { subject: "借地借家法", topic: "借家権の存続期間と更新（正当事由・法定更新）",
        lawSource: () => getArticleRange(shakuchi(), 26, 30) },
      { subject: "借地借家法", topic: "定期建物賃貸借（公正証書等の書面・事前説明書面・終了通知）",
        lawSource: () => getArticleRange(shakuchi(), 38, 38) },
      { subject: "借地借家法", topic: "造作買取請求権",
        lawSource: () => getArticleRange(shakuchi(), 33, 33) },
      { subject: "借地借家法", topic: "借地借家法の強行規定と特約の効力",
        lawSource: () => getArticleRange(shakuchi(), 9, 9) + "\n\n" + getArticleRange(shakuchi(), 16, 16) + "\n\n" + getArticleRange(shakuchi(), 30, 30) + "\n\n" + getArticleRange(shakuchi(), 37, 37) },
      { subject: "借地借家法", topic: "転貸借・借地権の譲渡（地主の承諾・裁判所の許可代諾）",
        lawSource: () => getArticleRange(shakuchi(), 19, 20) + "\n\n" + getArticleRange(minpo(), 612, 613) },
    ] as TopicDef[];
  })(),

  // ── 区分所有法・不動産登記法 ──
  ...(() => {
    const kubun = () => getLaw("区分所有法");
    return [
      { subject: "区分所有法・不動産登記法", topic: "区分所有法（専有部分・共用部分・敷地利用権）",
        lawSource: () => getArticleRange(kubun(), 1, 12) },
      { subject: "区分所有法・不動産登記法", topic: "区分所有法（管理組合・集会・議決権の割合）",
        lawSource: () => getArticleRange(kubun(), 34, 46) },
      { subject: "区分所有法・不動産登記法", topic: "区分所有法（規約の設定変更・管理者・義務違反者への措置）",
        lawSource: () => getArticleRange(kubun(), 25, 33) + "\n\n" + getArticleRange(kubun(), 57, 60) },
      { subject: "区分所有法・不動産登記法", topic: "区分所有法（建替え決議・復旧決議）",
        lawSource: () => getArticleRange(kubun(), 61, 64) },
      { subject: "区分所有法・不動産登記法", topic: "不動産登記法（登記の種類・対抗力・公信力なし）",
        lawSource: () => "", extraContext: "不動産登記法の法令データなし。登記の種類（所有権保存・所有権移転・抵当権設定等）、登記の効力（対抗力あり・公信力なし）、登記がなくても対抗できる者（不法占拠者等）、仮登記（1号仮登記・2号仮登記）の違いを詳細に。条文番号が不確かな場合は「※条文番号要確認」と明記。" },
      { subject: "区分所有法・不動産登記法", topic: "不動産登記法（登記手続き・仮登記・登記識別情報）",
        lawSource: () => "", extraContext: "不動産登記法の法令データなし。登記申請の方法（共同申請主義・単独申請の例外）、登記識別情報（12桁の符号）、事前通知制度、本人確認情報制度、登記原因証明情報を詳細に。条文番号が不確かな場合は「※条文番号要確認」と明記。" },
    ] as TopicDef[];
  })(),

  // ── 都市計画法 ──
  ...(() => {
    const toshi = () => getLaw("都市計画法");
    return [
      { subject: "都市計画法", topic: "都市計画の体系（都市計画区域・準都市計画区域・区域外）",
        lawSource: () => getArticleRange(toshi(), 4, 8) },
      { subject: "都市計画法", topic: "区域区分（市街化区域・市街化調整区域）",
        lawSource: () => getArticleRange(toshi(), 7, 7),
        extraContext: "市街化区域=既に市街地or概ね10年以内に優先的に市街化を図る区域。市街化調整区域=市街化を抑制する区域。非線引き区域との違い。" },
      { subject: "都市計画法", topic: "用途地域（13種類の概要と指定できる区域）",
        lawSource: () => getArticleRange(toshi(), 8, 9),
        extraContext: "13種類の用途地域：第一種低層住居専用、第二種低層住居専用、第一種中高層住居専用、第二種中高層住居専用、第一種住居、第二種住居、準住居、田園住居、近隣商業、商業、準工業、工業、工業専用。市街化区域には必ず用途地域を定める。市街化調整区域には原則定めない。" },
      { subject: "都市計画法", topic: "地域地区（特別用途地区・高度地区・高度利用地区・特定街区等）",
        lawSource: () => getArticleRange(toshi(), 8, 12) },
      { subject: "都市計画法", topic: "都市施設・市街地開発事業",
        lawSource: () => getArticleRange(toshi(), 11, 13) },
      { subject: "都市計画法", topic: "地区計画",
        lawSource: () => getArticleRange(toshi(), 12, 12),
        extraContext: "地区計画の内容（地区計画の方針＋地区整備計画）、届出制（行為着手30日前）、市町村の条例による制限。" },
      { subject: "都市計画法", topic: "開発許可制度（開発行為の定義・許可の要否）",
        lawSource: () => getArticleRange(toshi(), 29, 34),
        extraContext: "開発行為=建築物の建築・特定工作物の建設を目的とする土地の区画形質の変更。許可不要の例外（小規模開発：市街化区域1,000㎡未満等、農林漁業用建築物、公益施設等）を全て列挙。" },
      { subject: "都市計画法", topic: "開発許可の基準（33条基準・34条基準）",
        lawSource: () => getArticleRange(toshi(), 33, 34),
        extraContext: "33条=技術基準（全区域共通）、34条=立地基準（市街化調整区域のみ追加適用）。34条の各号（日常生活に必要な店舗等、農林水産物加工施設等）。" },
      { subject: "都市計画法", topic: "開発許可後の手続き（工事完了の届出・検査済証・公告前の建築制限）",
        lawSource: () => getArticleRange(toshi(), 36, 42) },
      { subject: "都市計画法", topic: "都市計画の決定手続きと都市計画制限",
        lawSource: () => getArticleRange(toshi(), 15, 28) + "\n\n" + getArticleRange(toshi(), 52, 57) },
    ] as TopicDef[];
  })(),

  // ── 建築基準法 ──
  ...(() => {
    const kenchiku = () => getLaw("建築基準法");
    return [
      { subject: "建築基準法", topic: "建築確認（必要な建築物・手続き・検査）",
        lawSource: () => getArticleRange(kenchiku(), 6, 7),
        extraContext: "建築確認が必要な場合：①特殊建築物で200㎡超、②木造で3階以上or延面積500㎡超or高さ13m超or軒高9m超、③木造以外で2階以上or延面積200㎡超、④都市計画区域内の全建築物（10㎡以下の増改築は除く）。確認済証→工事→中間検査→完了検査→検査済証。" },
      { subject: "建築基準法", topic: "用途制限（13種類の用途地域ごとの建築可能な建物）",
        lawSource: () => getArticleRange(kenchiku(), 48, 48),
        extraContext: "工業専用地域=住宅不可。全用途地域で建築可能=診療所・保育所・派出所等の公益施設。商業地域・準工業地域=ほぼ何でも建築可能。住居専用地域の制限が厳しい。具体的な建築可能/不可のパターンを表で整理。" },
      { subject: "建築基準法", topic: "道路制限（接道義務・4m未満のみなし道路・セットバック）",
        lawSource: () => getArticleRange(kenchiku(), 42, 44),
        extraContext: "接道義務=幅員4m以上の道路に2m以上接すること。42条2項道路（みなし道路）=幅員4m未満でも特定行政庁が指定した道路。セットバック=道路の中心線から2m後退（一方が崖等の場合は4mから後退）。セットバック部分は建蔽率・容積率の敷地面積に算入不可。" },
      { subject: "建築基準法", topic: "建蔽率（計算方法・角地緩和・防火地域の緩和・適用除外）",
        lawSource: () => getArticleRange(kenchiku(), 53, 53),
        extraContext: "建蔽率=建築面積/敷地面積。角地緩和=+10%。防火地域内の耐火建築物=+10%。両方該当=+20%。建蔽率80%の地域+防火地域+耐火建築物=100%（適用除外）。異なる用途地域にまたがる場合=加重平均。" },
      { subject: "建築基準法", topic: "容積率（計算方法・前面道路幅員による制限・特定道路の緩和）",
        lawSource: () => getArticleRange(kenchiku(), 52, 52),
        extraContext: "容積率=延べ面積/敷地面積。前面道路幅員12m未満の場合の制限：住居系=幅員×4/10、それ以外=幅員×6/10と指定容積率の小さい方。特定道路の緩和。容積率の算定に含めない面積（地下室、共用廊下・階段等）。" },
      { subject: "建築基準法", topic: "高さ制限（絶対高さ制限・斜線制限・日影規制）",
        lawSource: () => getArticleRange(kenchiku(), 55, 58),
        extraContext: "絶対高さ制限=第一種・第二種低層住居専用地域で10mまたは12m。斜線制限3種：道路斜線（全地域）、隣地斜線（低層住居専用地域以外）、北側斜線（低層住居専用地域+中高層住居専用地域）。日影規制=商業・工業・工業専用地域では適用なし。" },
      { subject: "建築基準法", topic: "防火地域・準防火地域（建築物の構造制限）",
        lawSource: () => getArticleRange(kenchiku(), 61, 67),
        extraContext: "防火地域：3階以上or延面積100㎡超=耐火建築物、それ以外=耐火or準耐火。準防火地域：4階以上=耐火、3階=耐火or準耐火、延面積500㎡超1500㎡以下=準耐火以上。防火地域と準防火地域にまたがる=厳しい方を適用。" },
      { subject: "建築基準法", topic: "建築協定",
        lawSource: () => getArticleRange(kenchiku(), 69, 77) },
      { subject: "建築基準法", topic: "単体規定（構造耐力・防火・避難・採光・換気）",
        lawSource: () => getArticleRange(kenchiku(), 20, 37) },
      { subject: "建築基準法", topic: "既存不適格建築物",
        lawSource: () => getArticleRange(kenchiku(), 3, 3),
        extraContext: "既存不適格建築物=法令改正前に適法に建てられたが現行法に適合しない建物。そのまま使用OK。増改築・大規模修繕時に現行法適合が必要。10㎡以下の増改築は確認不要。" },
    ] as TopicDef[];
  })(),

  // ── その他の法令上の制限 ──
  { subject: "その他の法令上の制限", topic: "国土利用計画法（事後届出制・届出対象面積・届出先・届出期間）",
    lawSource: () => "", extraContext: "国土利用計画法。事後届出制（23条）：契約締結日から2週間以内に市町村長経由で都道府県知事に届出。届出対象面積：市街化区域2,000㎡以上、市街化調整区域・非線引き区域5,000㎡以上、都市計画区域外10,000㎡以上。届出義務者=権利取得者（買主）。届出事項=利用目的・対価。知事は利用目的について勧告可能（価格に対する勧告はない）。注視区域=事前届出制。監視区域=事前届出制（面積基準引下げ可能）。規制区域=許可制。" },
  { subject: "その他の法令上の制限", topic: "農地法（3条許可・4条許可・5条許可・市街化区域の特例）",
    lawSource: () => "", extraContext: "農地法。3条=農地のまま権利移動→農業委員会の許可。4条=自己の農地を転用→都道府県知事の許可。5条=転用目的の権利移動→都道府県知事の許可。市街化区域の特例：4条・5条はあらかじめ農業委員会に届出でOK（3条は特例なし）。許可なしの行為=無効。相続は3条許可不要（届出のみ）。国・都道府県が行う場合の許可不要。" },
  { subject: "その他の法令上の制限", topic: "土地区画整理法（施行者・仮換地・換地処分・清算金）",
    lawSource: () => "", extraContext: "土地区画整理法。施行者：個人、組合、区画整理会社、地方公共団体、国土交通大臣、機構・公社。仮換地=工事期間中の暫定的な土地の割当て。仮換地指定の効果=従前の宅地の使用収益停止。換地処分=最終的な土地の割当て。換地処分の公告の翌日に効力発生。清算金=換地の不均衡を金銭で調整。保留地=施行者が売却して事業費に充てる。条文番号が不確かな場合は「※条文番号要確認」と明記。" },
  { subject: "その他の法令上の制限", topic: "宅地造成及び特定盛土等規制法（規制区域・許可・届出）",
    lawSource: () => "", extraContext: "宅地造成及び特定盛土等規制法（旧宅造法、2023年改正）。宅地造成等工事規制区域：都道府県知事が指定。規制区域内の宅地造成等には知事の許可が必要。宅地造成の定義=切土で2m超、盛土で1m超、切土+盛土で2m超、面積500㎡超のいずれか。特定盛土等規制区域：盛土等の規制を広域に拡大。届出制。条文番号が不確かな場合は「※条文番号要確認」と明記。" },
  { subject: "その他の法令上の制限", topic: "その他の法令（生産緑地法・河川法・自然公園法・文化財保護法等）",
    lawSource: () => "", extraContext: "宅建試験で出題される「その他の法令」の許可・届出一覧。生産緑地法=行為制限あり（市長の許可）、河川法=河川区域内の工事に許可、海岸法=海岸保全区域内の工事に許可、自然公園法=特別地域内の行為に許可、急傾斜地法=行為制限、文化財保護法=現状変更に文化庁長官の許可。各法令の「許可権者」と「届出先」を表で整理。" },

  // ── 宅建業法 ──
  { subject: "宅建業法（免許・宅建士）", topic: "宅地建物取引業の定義（宅地の定義・取引の定義・業の定義）",
    lawSource: () => "", extraContext: "宅建業法2条。宅地=①建物の敷地に供される土地、②用途地域内の土地（道路・公園・河川等を除く）。取引=自ら売買・交換、代理・媒介で売買・交換・貸借。業=不特定多数に反復継続。自ら貸借は宅建業に該当しない（重要）。国・地方公共団体は免許不要。" },
  { subject: "宅建業法（免許・宅建士）", topic: "免許の区分（大臣免許・知事免許）と免許換え",
    lawSource: () => "", extraContext: "知事免許=1つの都道府県内にのみ事務所→その都道府県知事。大臣免許=2以上の都道府県に事務所→国土交通大臣。免許換え=事務所の変更で免許権者が変わる場合。有効期間5年。更新は期間満了の90日前から30日前まで。更新申請後に期間満了→従前の免許がみなし有効。" },
  { subject: "宅建業法（免許・宅建士）", topic: "免許の欠格事由（人的要件）",
    lawSource: () => "", extraContext: "免許の欠格事由：①破産手続開始決定で復権を得ない者、②禁錮以上の刑で5年経過していない者、③宅建業法違反・暴力的犯罪・背任罪で罰金刑→5年経過していない者、④暴力団員又は暴力団員でなくなった日から5年経過していない者、⑤免許取消し処分を受けて5年経過していない者、⑥免許取消し処分の聴聞公告日から処分日までに廃業届出→届出から5年経過していない者、⑦営業に関し成年者と同一の行為能力を有しない未成年者でその法定代理人が①〜⑥に該当、⑧心身の故障により適正に営めない者。" },
  { subject: "宅建業法（免許・宅建士）", topic: "免許の欠格事由（法人・役員・政令使用人）",
    lawSource: () => "", extraContext: "法人の欠格事由：役員（取締役・執行役・相談役・顧問等業務を執行する社員）又は政令で定める使用人（事務所の代表者）が個人の欠格事由に該当する場合、法人は免許を受けられない。免許取消し後の役員の5年制限（取消し時に役員だった者は5年間）。" },
  { subject: "宅建業法（免許・宅建士）", topic: "免許の有効期間と更新",
    lawSource: () => "", extraContext: "有効期間5年。更新申請は期間満了の90日前から30日前まで。更新申請後、期間満了まで処分がないとき→従前の免許がなお効力を有する。免許証の書換え：商号・名称・代表者の氏名の変更時。廃業届出：死亡は相続人、合併消滅は代表役員、破産は破産管財人、解散は清算人、廃業は本人。届出日=免許失効日（死亡のみ死亡時）。" },
  { subject: "宅建業法（免許・宅建士）", topic: "宅建士の登録（要件・欠格事由・登録の移転）",
    lawSource: () => "", extraContext: "宅建士の登録：試験合格+2年以上の実務経験（又は登録実務講習修了）。登録先=試験を受けた都道府県知事。登録の移転=勤務先の変更で他の都道府県に移転する場合（任意）。登録の欠格事由は免許の欠格事由とほぼ同じ+事務禁止処分期間中の登録消除で登録消除から5年。登録は一生有効（更新なし）。" },
  { subject: "宅建業法（免許・宅建士）", topic: "宅建士証（交付・更新・提示義務）",
    lawSource: () => "", extraContext: "宅建士証の有効期間5年。交付申請前6ヶ月以内の法定講習受講が必要（試験合格後1年以内は不要）。更新=新しい宅建士証の交付を受ける。提示義務：取引の関係者から請求があったとき。重要事項説明時は請求なくても提示必須。宅建士証の返納：登録消除時、事務禁止処分時（禁止期間満了後に返還請求可能）。" },
  { subject: "宅建業法（免許・宅建士）", topic: "事務所の設置（事務所の定義・届出・専任の宅建士の設置義務）",
    lawSource: () => "", extraContext: "事務所=本店＋宅建業を営む支店＋継続的に業務を行う施設。事務所ごとに業務に従事する者5人に1人以上の専任の宅建士を設置（不足した場合2週間以内に補充）。案内所等（モデルルーム等）にも1人以上の専任の宅建士が必要な場合あり（契約締結等を行う場合）。標識の掲示義務。従業者名簿の備付け義務。帳簿の備付け義務。" },

  // ── 宅建業法（営業保証金・保証協会）──
  { subject: "宅建業法（営業保証金・保証協会）", topic: "営業保証金（供託額・供託所・届出・事業開始）",
    lawSource: () => "", extraContext: "営業保証金の供託：本店1,000万円、支店1つにつき500万円。供託所=本店の最寄りの供託所。有価証券での供託可能（国債=額面100%、地方債・政府保証債=90%、その他=80%）。免許後→供託→届出→事業開始の順。届出しないと事業開始できない。届出後でないと事業開始できない旨の催告あり（届出までに供託しない場合、免許権者は免許取消し可能）。" },
  { subject: "宅建業法（営業保証金・保証協会）", topic: "営業保証金の還付（還付対象者・不足額の供託）",
    lawSource: () => "", extraContext: "還付対象=宅建業に関する取引によって生じた債権を有する者（宅建業者は除く）。還付後、免許権者から不足額の供託を通知→通知を受けた日から2週間以内に不足額を供託→供託後届出。不足額を供託しない場合→業務停止処分の対象。" },
  { subject: "宅建業法（営業保証金・保証協会）", topic: "営業保証金の取戻し（事由・公告義務）",
    lawSource: () => "", extraContext: "取戻し事由：免許失効、一部事務所廃止、保証協会への加入。取戻しには6ヶ月以上の公告が必要（債権の申出期間）。例外：本店移転による供託所変更の場合（保管替え）→公告不要。二重供託になる場合の取戻し→公告不要。" },
  { subject: "宅建業法（営業保証金・保証協会）", topic: "保証協会（加入・弁済業務保証金分担金の納付額）",
    lawSource: () => "", extraContext: "保証協会は2つ（全宅保証・不動産保証協会）。加入は任意。弁済業務保証金分担金：本店60万円、支店1つにつき30万円。加入の手続き：分担金納付→保証協会が弁済業務保証金を供託所に供託→免許権者に届出。加入日から1週間以内に社員の地位を取得。新たに支店を設置→設置日から2週間以内に分担金を納付。" },
  { subject: "宅建業法（営業保証金・保証協会）", topic: "保証協会（弁済業務・還付・還付充当金）",
    lawSource: () => "", extraContext: "弁済業務：社員と取引した者は保証協会に認証を申し出る→認証額の範囲で供託所から還付。還付限度額は営業保証金に相当する額。還付後→保証協会が社員に還付充当金の納付を通知→通知を受けた日から2週間以内に納付→納付しないと社員の地位を失う→地位喪失後1週間以内に営業保証金を供託しなければ事業継続不可。" },
  { subject: "宅建業法（営業保証金・保証協会）", topic: "営業保証金と保証協会の比較整理",
    lawSource: () => "", extraContext: "営業保証金vs保証協会の比較表。供託額（1,000万円vs60万円）、供託先（最寄り供託所vs保証協会経由）、還付対象（宅建業に関する取引の債権者、業者は除く）、不足時の対応（2週間以内vs2週間以内の還付充当金）、取戻し（6ヶ月公告）。メリット・デメリット。" },

  // ── 宅建業法（媒介契約・広告規制）──
  { subject: "宅建業法（媒介契約・広告規制）", topic: "媒介契約の種類（一般・専任・専属専任の比較）",
    lawSource: () => "", extraContext: "3種類の媒介契約の比較。一般媒介：他の業者にも依頼可、自己発見取引可、有効期間の制限なし（行政指導で3ヶ月）、報告義務なし、レインズ登録義務なし。専任媒介：他の業者に依頼不可、自己発見取引可、有効期間3ヶ月以内、2週間に1回以上の報告義務、7日以内にレインズ登録。専属専任媒介：他の業者に依頼不可、自己発見取引不可、有効期間3ヶ月以内、1週間に1回以上の報告義務、5日以内にレインズ登録。" },
  { subject: "宅建業法（媒介契約・広告規制）", topic: "媒介契約の規制（有効期間・報告義務・レインズ登録義務）",
    lawSource: () => "", extraContext: "媒介契約書の記載事項（宅地建物の所在・売買すべき価額・媒介契約の種類・有効期間・報酬・契約解除に関する事項等）。依頼者の承諾を得ても3ヶ月を超える有効期間は不可（3ヶ月に短縮）。更新は依頼者の申出による。レインズ=指定流通機構。登録事項の変更あれば遅滞なく変更。" },
  { subject: "宅建業法（媒介契約・広告規制）", topic: "報酬の限度額（売買・交換・賃借の計算方法）",
    lawSource: () => "", extraContext: "売買の報酬限度額：200万円以下=5%+税、200万円超400万円以下=4%+2万円+税、400万円超=3%+6万円+税。代理は媒介の2倍。交換は高い方の価額で計算。賃借の報酬限度額：借賃の1ヶ月分+税（貸主と借主の合計）。居住用は依頼者の一方から0.5ヶ月分+税が上限（承諾があれば1ヶ月分可）。消費税の扱い（課税業者・免税業者）。低廉な空家等の売買・交換の特例（400万円以下で18万円+税まで）。" },
  { subject: "宅建業法（媒介契約・広告規制）", topic: "広告の規制（誇大広告の禁止・広告開始時期の制限）",
    lawSource: () => "", extraContext: "誇大広告の禁止（32条）：著しく事実に相違する表示、実際のものよりも著しく優良・有利と誤認させる表示。広告開始時期の制限（33条）：開発許可・建築確認等の許可前は広告不可。取引態様の明示義務（34条）：広告時と注文を受けた時に、自ら売買か代理か媒介かを明示。おとり広告の禁止。" },
  { subject: "宅建業法（媒介契約・広告規制）", topic: "業務上の規制（契約締結時期の制限・不当な勧誘の禁止）",
    lawSource: () => "", extraContext: "契約締結時期の制限（36条）：開発許可・建築確認等の前は契約締結不可（広告も不可だが、契約はさらに厳しく予約も不可）。不当な勧誘（47条の2）：利益を生ずることが確実であると誤解させる断定的判断の提供、威迫、私生活・業務の平穏を害する方法での勧誘。守秘義務（45条）。" },

  // ── 宅建業法（重要事項説明・35条）──
  { subject: "宅建業法（重要事項説明・35条）", topic: "重要事項説明の基本（説明の主体・相手方・時期・方法）",
    lawSource: () => "", extraContext: "説明の主体=宅建士（取引士証を提示して説明）。相手方=買主・借主（売主には不要）。時期=契約が成立するまでの間に。方法=書面を交付して口頭で説明（IT重説も可）。35条書面には宅建士の記名が必要（記名のみ、押印は不要）。説明は専任でない宅建士でも可。" },
  { subject: "宅建業法（重要事項説明・35条）", topic: "35条の記載事項（登記された権利・法令上の制限・インフラ整備状況）",
    lawSource: () => "", extraContext: "主な記載事項：①登記された権利の種類・内容、②法令に基づく制限の概要、③私道に関する負担、④飲用水・電気・ガスの供給・排水施設の整備状況、⑤宅地造成又は建築工事完了時の形状・構造（未完成物件の場合）、⑥建物状況調査の結果の概要（既存建物の場合）。" },
  { subject: "宅建業法（重要事項説明・35条）", topic: "35条の記載事項（代金以外の金銭・契約解除・損害賠償額の予定）",
    lawSource: () => "", extraContext: "⑦代金・交換差金・借賃以外に授受される金銭の額及び目的（手付金・敷金・礼金等）、⑧契約の解除に関する事項、⑨損害賠償額の予定又は違約金に関する事項、⑩手付金等の保全措置の概要、⑪ローンのあっせんの内容及びあっせんによるローンが成立しないときの措置、⑫瑕疵担保責任の履行に関する保証保険契約等の措置。" },
  { subject: "宅建業法（重要事項説明・35条）", topic: "35条の記載事項（手付金等の保全措置・ローンのあっせん）",
    lawSource: () => "", extraContext: "手付金等の保全措置の概要：保全措置を講じるかどうか及びその措置の概要。融資のあっせん：金融機関名、融資額、金利、返済方法等。融資不成立時の措置（ローン特約の有無）。宅建業者は融資条件を正確に説明する義務。代金又は交換差金に関する金銭の貸借のあっせんの内容。" },
  { subject: "宅建業法（重要事項説明・35条）", topic: "35条の記載事項（貸借特有の事項）",
    lawSource: () => "", extraContext: "貸借特有の記載事項：①台所・浴室・便所等の設備の整備状況、②契約期間・契約の更新に関する事項、③定期建物賃貸借のときはその旨、④用途その他利用の制限に関する事項、⑤敷金その他契約終了時に精算する金銭の精算に関する事項、⑥管理の委託先。区分所有建物の貸借の場合=管理費・修繕積立金の額も。" },
  { subject: "宅建業法（重要事項説明・35条）", topic: "IT重説の要件と手続き",
    lawSource: () => "", extraContext: "IT重説（オンライン重要事項説明）：売買・賃貸借の両方で可能（2021年～）。要件：①相手方の承諾、②映像を確認できる方法（テレビ会議等）、③事前に35条書面を相手方に送付、④宅建士証を画面上で提示し相手方が視認できること。書面の電磁的方法による提供も可能（相手方の承諾が必要）。" },

  // ── 宅建業法（37条書面）──
  { subject: "宅建業法（37条書面）", topic: "37条書面の必要的記載事項",
    lawSource: () => "", extraContext: "37条書面の必要的記載事項：①当事者の氏名・住所、②宅地建物の所在・面積等、③建物の構造・種類（売買・交換のみ）、④代金又は交換差金の額・支払時期・支払方法、⑤宅地建物の引渡しの時期、⑥移転登記の申請の時期（売買・交換のみ）。貸借の場合：借賃の額・支払時期・支払方法。" },
  { subject: "宅建業法（37条書面）", topic: "37条書面の任意的記載事項",
    lawSource: () => "", extraContext: "任意的記載事項（定めがあれば記載）：①代金・交換差金以外の金銭の額・授受の目的、②契約の解除に関する事項、③損害賠償額の予定又は違約金に関する事項、④天災その他不可抗力による損害の負担（危険負担）に関する事項、⑤契約不適合責任に関する事項（保証保険契約等）、⑥租税公課の負担に関する事項、⑦ローンのあっせんの内容。" },
  { subject: "宅建業法（37条書面）", topic: "35条書面と37条書面の比較整理",
    lawSource: () => "", extraContext: "35条と37条の違いを表で整理。35条=契約前に説明、宅建士が説明+記名、相手方は買主・借主のみ。37条=契約後遅滞なく交付、宅建士の記名は必要だが説明義務はない、当事者全員に交付（売主・買主の両方）。35条にはあるが37条にはない事項（法令上の制限等）。37条にはあるが35条にはない事項（引渡し時期・登記申請時期等）。" },
  { subject: "宅建業法（37条書面）", topic: "37条書面の交付の相手方と宅建士の記名",
    lawSource: () => "", extraContext: "交付の相手方=契約の当事者（売主と買主、貸主と借主の両方）。宅建士の記名が必要（説明義務はない）。交付の時期=契約が成立した後遅滞なく。宅建業者間の取引でも37条書面の交付は省略不可（35条の重要事項説明は省略可能だが37条は省略不可）。書面の電磁的方法による提供も可能（相手方の承諾が必要）。" },

  // ── 宅建業法（8種制限）──
  { subject: "宅建業法（8種制限）", topic: "8種制限の適用場面（業者売主・非業者買主の場合のみ）",
    lawSource: () => "", extraContext: "8種制限は宅建業者が自ら売主となり、買主が宅建業者でない場合にのみ適用。業者間取引には適用なし。代理・媒介の場合も適用なし（自ら売主の場合のみ）。8種制限は買主保護のための規定であり、買主に不利な特約は無効となる。" },
  { subject: "宅建業法（8種制限）", topic: "クーリングオフ（適用場面・期間・方法・効果）",
    lawSource: () => "", extraContext: "クーリングオフ：事務所等以外の場所で買受けの申込み又は契約をした場合に適用。「事務所等」=事務所、事務所以外で継続的に業務を行う施設、展示会場（土地に定着した建物内）、相手方が自ら申し出た場合のその者の自宅又は勤務先。申込みの撤回等ができる旨を書面で告げられた日から起算して8日間。書面による（発信主義）。代金全額を支払い+引渡しを受けた場合は不可。" },
  { subject: "宅建業法（8種制限）", topic: "損害賠償額の予定等の制限（代金の20%）",
    lawSource: () => "", extraContext: "損害賠償額の予定と違約金の合計が代金の額の20%を超える特約→20%を超える部分が無効（全体が無効になるのではなく超過部分のみ無効）。定めがない場合→民法の原則（実損賠償）。宅建業者間取引には適用なし。" },
  { subject: "宅建業法（8種制限）", topic: "手付の性質と額の制限（解約手付・代金の20%）",
    lawSource: () => "", extraContext: "手付は解約手付の性質を有する（どのような名目でも解約手付とみなされる）。手付の額は代金の20%以下。20%を超える部分は無効。相手方が契約の履行に着手するまでは、買主は手付放棄、売主は手付倍返しで解除可能。「手付金の放棄による解除はできない」旨の特約は無効。" },
  { subject: "宅建業法（8種制限）", topic: "手付金等の保全措置（未完成物件5%・完成物件10%）",
    lawSource: () => "", extraContext: "保全措置が必要な場合：未完成物件=代金の5%超又は1,000万円超、完成物件=代金の10%超又は1,000万円超。保全方法：未完成物件=保証委託契約又は保険契約、完成物件=保証委託契約又は保険契約又は指定保管機関による保管。保全措置を講じない場合は手付金等を受領できない。買主が所有権の登記をした場合は保全措置不要。" },
  { subject: "宅建業法（8種制限）", topic: "自己の所有に属しない物件の売買制限",
    lawSource: () => "", extraContext: "原則：自己の所有に属しない物件（他人物・未完成物件）の売買契約を締結してはならない。例外：①他人物売買で確実に取得できる契約がある場合、②未完成物件で手付金等の保全措置を講じた場合。買主が宅建業者の場合は制限なし。" },
  { subject: "宅建業法（8種制限）", topic: "契約不適合責任の特約制限（引渡しから2年以上）",
    lawSource: () => "", extraContext: "民法の規定より買主に不利な特約は原則無効。ただし「引渡しの日から2年以上」の期間を定める特約は有効。例：「引渡しから1年」=無効（民法の規定が適用）。「引渡しから2年」=有効。「知った時から1年以内に通知」=民法と同じなので有効（特約としても有効）。責任を一切負わない旨の特約=無効。" },
  { subject: "宅建業法（8種制限）", topic: "割賦販売の契約解除等の制限",
    lawSource: () => "", extraContext: "割賦販売=代金を2回以上に分割して受領。買主が賦払金の支払いを遅滞した場合→30日以上の相当期間を定めて書面で催告し、その期間内に支払いがないときでなければ契約解除又は残金の一括請求はできない。" },
  { subject: "宅建業法（8種制限）", topic: "所有権留保等の禁止",
    lawSource: () => "", extraContext: "原則：代金の30%超を受領した場合は所有権を買主に移転しなければならない（所有権留保の禁止）。同様に、代金の30%超を受領するまでに登記の移転義務（登記留保の禁止）。例外：受領した金額が代金の30%以下の場合は留保可能。割賦販売の場合に特に問題となる規定。" },

  // ── 宅建業法（監督処分・住宅瑕疵担保履行法）──
  { subject: "宅建業法（監督処分・住宅瑕疵担保履行法）", topic: "監督処分（指示処分・業務停止処分・免許取消処分）",
    lawSource: () => "", extraContext: "指示処分：業務に関して不正又は著しく不当な行為があったとき。業務停止処分：1年以内の期間。免許取消処分：必要的取消し（欠格事由該当・不正手段で免許取得・業務停止処分違反等）と任意的取消し（業務停止事由に該当し情状が特に重い場合）。監督処分権者：免許権者＋業務地の知事。宅建士に対する処分=指示処分・事務禁止処分（1年以内）・登録消除処分。" },
  { subject: "宅建業法（監督処分・住宅瑕疵担保履行法）", topic: "罰則（罰金・懲役の主な適用場面）",
    lawSource: () => "", extraContext: "主な罰則：無免許営業=3年以下の懲役or300万円以下の罰金。名義貸し=3年以下の懲役or300万円以下の罰金。業務停止処分違反=3年以下の懲役or300万円以下の罰金。重要事項説明義務違反=罰則なし（監督処分の対象）。37条書面交付義務違反=50万円以下の罰金。誇大広告=6ヶ月以下の懲役or100万円以下の罰金。法人の両罰規定あり（1億円以下の罰金）。" },
  { subject: "宅建業法（監督処分・住宅瑕疵担保履行法）", topic: "住宅瑕疵担保履行法（資力確保措置・供託・保険）",
    lawSource: () => "", extraContext: "住宅瑕疵担保履行法：新築住宅の売主（宅建業者）又は請負人（建設業者）に資力確保措置を義務付け。2つの方法：①住宅販売瑕疵担保保証金の供託（戸数に応じた額）、②住宅販売瑕疵担保責任保険の加入。基準日（3月31日・9月30日）に届出義務。届出をしない場合→基準日の翌日から50日経過後は新たな自ら売主の売買契約を締結できない。対象=構造耐力上主要な部分又は雨水の浸入を防止する部分の瑕疵。期間=引渡しから10年間。" },

  // ── 不動産の税金 ──
  { subject: "不動産に関する税金", topic: "不動産取得税（課税主体・税率・課税標準・特例・免税点）",
    lawSource: () => "", extraContext: "不動産取得税。課税主体=都道府県。課税客体=不動産の取得（売買・贈与・交換・建築等。相続は非課税）。税率=標準4%（土地・住宅は3%に軽減）。課税標準=固定資産税評価額（宅地は1/2特例）。免税点=土地10万円、建物（新築以外）12万円、建物（新築）23万円。新築住宅の控除=1,200万円（認定長期優良住宅は1,300万円）。中古住宅の控除=築年数に応じた額。徴収方法=普通徴収。" },
  { subject: "不動産に関する税金", topic: "固定資産税（納税義務者・税率・住宅用地の特例・新築住宅の減額）",
    lawSource: () => "", extraContext: "固定資産税。課税主体=市町村（23区は都）。納税義務者=1月1日時点の所有者（登記簿上の所有者）。税率=標準税率1.4%（制限税率なし）。免税点=土地30万円、建物20万円。住宅用地の特例：小規模住宅用地（200㎡以下）=1/6、一般住宅用地（200㎡超）=1/3。新築住宅の減額：3年間1/2（3階以上の耐火建築物は5年間1/2）。認定長期優良住宅=5年間（耐火は7年間）。固定資産税評価額は3年ごとに評価替え。" },
  { subject: "不動産に関する税金", topic: "登録免許税（税率・軽減税率・納付方法）",
    lawSource: () => "", extraContext: "登録免許税。課税主体=国。所有権保存登記=0.4%（住宅用家屋の特例0.15%）。所有権移転登記（売買）=2%（住宅用家屋の特例0.3%）。所有権移転登記（相続）=0.4%。抵当権設定登記=0.4%（住宅用家屋の特例0.1%）。課税標準=不動産の価額（固定資産税評価額）。抵当権設定登記は債権金額が課税標準。納付方法=原則として現金納付（税額3万円以下は印紙可）。" },
  { subject: "不動産に関する税金", topic: "印紙税（課税文書・税額・非課税文書・過怠税）",
    lawSource: () => "", extraContext: "印紙税。課税文書：不動産売買契約書、建設工事請負契約書、土地賃貸借契約書（建物賃貸借契約書は非課税）、領収書（5万円以上）。税額は契約金額に応じて段階的。記載金額がないもの=200円。非課税文書：建物賃貸借契約書、委任状、抵当権設定契約書。過怠税：印紙を貼らなかった場合=税額の3倍（自主的に申し出=1.1倍）。消印しなかった場合=印紙の額面と同額。" },
  { subject: "不動産に関する税金", topic: "所得税（譲渡所得・長期と短期・3,000万円特別控除・買換え特例・住宅ローン控除）",
    lawSource: () => getArticleRange(getLaw("所得税法"), 33, 33),
    extraContext: "譲渡所得=収入金額-（取得費+譲渡費用）-特別控除。長期譲渡所得（所有期間5年超）=所得税15%+住民税5%。短期譲渡所得（5年以下）=所得税30%+住民税9%。所有期間の起算日=取得日（実際の引渡日or契約日）、譲渡した年の1月1日で判定。3,000万円特別控除（居住用財産）。居住用財産の軽減税率の特例（10年超所有：6,000万円以下の部分=所得税10%+住民税4%）。特定居住用財産の買換え特例。住宅ローン控除=年末残高の0.7%（最大13年間）。" },
  { subject: "不動産に関する税金", topic: "贈与税・相続税（住宅取得等資金の非課税）",
    lawSource: () => "", extraContext: "贈与税の住宅取得等資金の非課税：直系尊属から住宅取得等資金の贈与を受けた場合、一定額まで非課税（省エネ住宅1,000万円、一般住宅500万円）。相続時精算課税制度との併用可能。不動産取得税・登録免許税・固定資産税と贈与税・相続税の関係整理。" },

  // ── 地価公示・鑑定評価・その他 ──
  { subject: "地価公示・鑑定評価・その他", topic: "地価公示法（目的・標準地・公示価格・効力）",
    lawSource: () => "", extraContext: "地価公示法。目的=一般の土地取引の指標、公共事業用地の取得価格の算定基準。標準地=土地鑑定委員会が選定（都市計画区域内）。公示価格=毎年1月1日時点の正常な価格を3月に公示。2人以上の不動産鑑定士が鑑定。都市計画区域外も調査可能。不動産鑑定士は公示価格を規準とする義務。公共事業の取得価格は公示価格を規準。一般の取引では指標（努力義務）。" },
  { subject: "地価公示・鑑定評価・その他", topic: "不動産鑑定評価基準（原価法・取引事例比較法・収益還元法）",
    lawSource: () => "", extraContext: "3つの鑑定評価方式。原価法=再調達原価-減価修正=積算価格。取引事例比較法=類似の取引事例の価格を補正=比準価格。収益還元法=将来の純収益を現在価値に還元=収益価格（直接還元法とDCF法）。鑑定評価の手順：対象不動産の確認→資料の収集・整理→3方式の適用→試算価格の調整→鑑定評価額の決定。最有効使用の原則。" },
  { subject: "地価公示・鑑定評価・その他", topic: "住宅金融支援機構（フラット35・直接融資）",
    lawSource: () => "", extraContext: "住宅金融支援機構。主な業務：①証券化支援業務（フラット35）=民間金融機関の住宅ローン債権を買取り又は保証。②直接融資=災害復興建築物の融資、財形住宅融資等。フラット35の特徴：全期間固定金利、融資額=8,000万円以下、融資割合=購入価額の100%以内、返済期間=15年以上35年以下。団体信用生命保険への加入は任意。保証人・保証料不要。繰上返済手数料不要。" },
  { subject: "地価公示・鑑定評価・その他", topic: "景品表示法（不動産の表示に関する公正競争規約）",
    lawSource: () => "", extraContext: "不動産の表示に関する公正競争規約。徒歩所要時間の表示=80mにつき1分（端数切上げ）。面積：畳1枚の広さ=1.62㎡以上。新築の定義=建築後1年未満かつ未入居。物件からの所要時間=電車等の乗換え時間を含む。「最寄り駅から徒歩○分」の起算点=駅の出入口。物件までの距離=道路距離。二重価格表示の条件=過去の販売価格と比較する場合のルール。おとり広告の禁止。" },
  { subject: "地価公示・鑑定評価・その他", topic: "統計問題の出題パターンと対策",
    lawSource: () => "", extraContext: "統計問題は毎年1問出題。出題される統計：①地価公示（国土交通省、3月公表）、②住宅着工統計（国土交通省、毎月）、③不動産価格指数、④土地白書（国土交通省、6月公表）、⑤法人企業統計。出題パターン：最新の数値は毎年変わるため暗記は試験直前に。「増加か減少か」「何年連続か」がポイント。※最新の統計データは各自確認が必要。" },
  { subject: "地価公示・鑑定評価・その他", topic: "土地の形質・地目・種類の知識",
    lawSource: () => "", extraContext: "宅地に適した土地：台地・丘陵（排水良好、地盤安定）。宅地に不適な土地：低地・埋立地・干拓地・旧河道（地盤軟弱、浸水リスク）。扇状地=扇端部は宅地に適するが扇央部は適さない（伏流水のため）。自然堤防=洪水時に形成された微高地で宅地に適する。後背湿地=自然堤防の背後、低湿地で不適。段丘=宅地に適する。がけ崩れ・土石流のリスクがある場所の判定。" },
  { subject: "地価公示・鑑定評価・その他", topic: "建物の構造・材料・設備の知識",
    lawSource: () => "", extraContext: "木造：軽量で施工容易、耐火性低い。鉄骨造（S造）：強度高い、耐火被覆が必要。鉄筋コンクリート造（RC造）：耐火性・耐久性高い、重い。鉄骨鉄筋コンクリート造（SRC造）：最も強度と耐久性が高い、コスト高。基礎の種類：直接基礎（独立基礎・布基礎・ベタ基礎）、杭基礎。鉄筋コンクリートの特性：圧縮力はコンクリート、引張力は鉄筋が負担。かぶり厚さの重要性。" },
];

// ========== 教材生成 ================================================

async function generateTopic(def: TopicDef): Promise<string> {
  const lawText = def.lawSource();
  const hasLaw = lawText.length > 100;

  const prompt = `あなたは宅建試験（宅地建物取引士試験）の教材を作成する**日本最高峰の講師**です。
合格率19%の試験で、あなたの教材だけで合格を目指す受験生が使います。
一流の教材とは「試験に出るポイントが全て載っていて、読めば解ける」ものです。

## 作成するトピック
科目: ${def.subject}
トピック: ${def.topic}

${hasLaw ? `## 根拠法令
以下の法令条文を根拠にしてください。条文の内容を正確に反映し、条文番号を必ず引用すること。

${lawText.slice(0, 45000)}` : ""}

${def.extraContext ? `## 補足情報
${def.extraContext}` : ""}

## 品質基準（これを満たさない教材は二流）

1. **条文番号は全て正確に記載**。不確かなら「※条文番号要確認」
2. **数字は全て正確**（期間・金額・面積・割合）。宅建は数字で合否が分かれる
3. **原則と例外を必ずセットで記載**。原則だけでは問題が解けない
4. **判例の結論を明記**。「判例がある」だけでは意味がない。結論まで書く
5. **ひっかけパターンを具体的に**。「注意が必要」ではなく「○○と混同しやすいが、違いは△△」
6. **具体例を必ず入れる**。「AがBに土地を売却した場合...」のような設例
7. **比較表で整理**。類似制度は必ず比較表にまとめる

## 教材の構成（5,000〜10,000字）

### 1. 概要と出題傾向（200〜300字）
- このトピックの宅建試験での位置づけ（毎年出る/2年に1回等）
- 何問程度出題されるか
- 得点戦略（確実に取るべきか、捨ててもいいか）

### 2. 基本知識（1,500〜3,000字）
- 制度の趣旨・目的（なぜこの制度があるのか）
- 基本的な仕組み・要件・効果
- 全ての重要概念を漏れなく解説
- **条文の根拠を必ず明記**（○○条○項）
- 図表を使って構造を整理

### 3. 重要論点の深掘り（1,500〜3,000字）
- 試験頻出の論点を個別に深掘り
- 各論点ごとに：
  - **原則と例外**を明示
  - **具体例**（「甲土地をAがBに売却し、CがBから購入した場合...」等）
  - **過去問で実際に出たひっかけパターン**
  - **正誤の判断基準**（「〜の場合は正しい」「〜の場合は誤り」）

### 4. 比較・横断整理（500〜1,500字）
- **比較表**（似た制度・概念を表で整理）
- **数字の一覧**（期間・金額・面積等をまとめた表）
- **混同しやすいポイントの整理**

### 5. 過去問での出題パターン（300〜800字）
- よくある出題形式（正しいものはどれか/誤っているものはどれか）
- 典型的なひっかけ選択肢の例
- 正解を見抜くコツ

### 6. 暗記チェックリスト（200〜500字）
- このトピックで**絶対に覚えるべき項目**を箇条書き
- 語呂合わせ・覚え方のコツがあれば記載

マークダウン形式で出力。見出しは##で統一。`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ========== メイン ==================================================

interface GeneratedTopic {
  subject: string;
  topic: string;
  content: string;
  charCount: number;
  hasLawSource: boolean;
  generatedAt: string;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // 進捗管理
  let progress: Set<string> = new Set();
  if (existsSync(PROGRESS_FILE)) {
    progress = new Set(JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")));
  }

  let results: GeneratedTopic[] = [];
  if (existsSync(OUTPUT_FILE)) {
    results = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
  }

  const total = TOPICS.length;
  const remaining = TOPICS.filter(t => !progress.has(`${t.subject}::${t.topic}`));

  console.log(`\n📚 宅建完全教材生成（${total}トピック）`);
  console.log(`   完了: ${progress.size} / 残り: ${remaining.length}\n`);

  let generated = 0;
  let errors = 0;
  let totalChars = results.reduce((s, r) => s + r.charCount, 0);

  for (const def of remaining) {
    const key = `${def.subject}::${def.topic}`;
    console.log(`  [${progress.size + 1}/${total}] ${def.subject} > ${def.topic} ...`);

    const startTime = Date.now();
    try {
      const content = await generateTopic(def);
      const charCount = content.length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const hasLaw = def.lawSource().length > 100;

      results.push({
        subject: def.subject,
        topic: def.topic,
        content,
        charCount,
        hasLawSource: hasLaw,
        generatedAt: new Date().toISOString(),
      });

      progress.add(key);
      generated++;
      totalChars += charCount;

      // 進捗保存（毎回）
      writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      writeFileSync(PROGRESS_FILE, JSON.stringify([...progress]));

      const avgChars = Math.round(totalChars / results.length);
      console.log(`  ✅ ${charCount.toLocaleString()}字 (${elapsed}s) [平均${avgChars.toLocaleString()}字]`);

      // レートリミット対策
      await new Promise(r => setTimeout(r, 1500));
    } catch (err: unknown) {
      errors++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes("usage limits") || errMsg.includes("rate_limit")) {
        console.log(`  ⏸️  APIリミット到達 (${elapsed}s). 60秒待機...`);
        await new Promise(r => setTimeout(r, 60000));
        // リトライ
        errors--;
        remaining.push(def); // キューに戻す
      } else {
        console.error(`  ❌ エラー (${elapsed}s): ${errMsg.slice(0, 100)}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // サマリー
  console.log(`\n========================================`);
  console.log(`📊 宅建完全教材生成 完了`);
  console.log(`  生成: ${generated} / エラー: ${errors}`);
  console.log(`  総トピック: ${results.length}`);
  console.log(`  総文字数: ${totalChars.toLocaleString()}字`);
  console.log(`  平均文字数: ${results.length > 0 ? Math.round(totalChars / results.length).toLocaleString() : 0}字/トピック`);
  console.log(`========================================\n`);
}

main().catch(console.error);
