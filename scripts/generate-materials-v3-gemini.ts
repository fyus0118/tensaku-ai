/**
 * 全試験対応 教材生成スクリプト v3 (Gemini版 v2 — 高品質版)
 *
 * 宅建教材の検証で判明したエラーパターンを全て防止するプロンプト設計:
 *   - 条文番号の捏造防止（法令データに実在するもののみ使用）
 *   - 旧法用語の混入防止（現行法のみ）
 *   - 例外規定の欠落防止（ただし書きを必ず記載）
 *   - トピック外の内容混入防止（スコープルール）
 *   - 具体例・比較表・ひっかけパターンの必須化
 *
 * 2段階パイプライン:
 *   Step 1: Gemini 2.5 Pro で生成（強化プロンプト）
 *   Step 2: Gemini 2.5 Pro でセルフチェック（条文検証+品質チェック+修正）
 *   品質ゲート: 文字数・必須セクション・具体例・比較表の存在を自動検証
 *
 * 使い方:
 *   source .env.local && bun run scripts/generate-materials-v3-gemini.ts
 *   source .env.local && bun run scripts/generate-materials-v3-gemini.ts fp2
 *   source .env.local && bun run scripts/generate-materials-v3-gemini.ts fp2,boki2
 *
 * 出力: scripts/materials-v3/{examId}.json
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXAM_CATEGORIES, type ExamCategory } from "../src/lib/exams";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  generationConfig: { maxOutputTokens: 16384 },
});

const OUTPUT_DIR = "./scripts/materials-v3";
const LAWS_DIR = "./scripts/laws";

// ========== 試験→法令マッピング ==========

const EXAM_LAW_MAP: Record<string, string[]> = {
  "yobi-shihou": ["日本国憲法", "民法", "刑法", "商法", "会社法", "民事訴訟法", "刑事訴訟法"],
  "shihou-shiken": ["日本国憲法", "民法", "刑法", "商法", "会社法", "民事訴訟法", "刑事訴訟法"],
  "shihou-shoshi": ["民法", "会社法", "刑法", "民事訴訟法", "不動産登記法"],
  "gyousei-shoshi": ["日本国憲法", "民法", "行政手続法", "行政不服審査法", "行政事件訴訟法", "国家賠償法", "地方自治法"],
  "sharoshi": ["労働基準法", "労働安全衛生法", "労働者災害補償保険法", "雇用保険法", "健康保険法", "国民年金法", "厚生年金保険法"],
  "benri-shi": ["特許法", "実用新案法", "意匠法", "商標法", "著作権法", "不正競争防止法"],
  "business-law": ["民法", "会社法", "消費者契約法", "独占禁止法", "個人情報保護法", "不正競争防止法", "労働基準法"],
  "chizai": ["特許法", "意匠法", "商標法", "著作権法", "不正競争防止法"],
  "kojin-joho": ["個人情報保護法"],
  "kenchiku-shi": ["建築基準法", "都市計画法", "消防法"],
  "mankan": ["区分所有法", "民法"],
  "chintai": ["借地借家法", "民法"],
  "kounin-kaikeishi": ["会社法", "金融商品取引法", "法人税法", "消費税法"],
  "zeirishi": ["法人税法", "所得税法", "相続税法", "消費税法"],
  "fp2": ["所得税法", "相続税法", "民法", "消費者契約法"],
  "gaimuin": ["金融商品取引法"],
  "kashikin": ["貸金業法"],
  "koumuin": ["日本国憲法", "民法", "行政手続法", "行政不服審査法", "行政事件訴訟法"],
  "kikenbutsu": ["消防法"],
  "touroku-hanbai": ["医薬品医療機器等法"],
  "hoiku-shi": ["児童福祉法", "社会福祉法"],
  "sg": ["個人情報保護法"],
};

const SUBJECT_LAW_HINTS: Record<string, string[]> = {
  "憲法": ["日本国憲法"],
  "民法": ["民法"],
  "刑法": ["刑法"],
  "商法": ["商法", "会社法"],
  "民事訴訟法": ["民事訴訟法"],
  "刑事訴訟法": ["刑事訴訟法"],
  "行政法": ["行政手続法", "行政不服審査法", "行政事件訴訟法", "国家賠償法"],
  "労働基準法": ["労働基準法"],
  "労働安全衛生法": ["労働安全衛生法"],
  "労災保険法": ["労働者災害補償保険法"],
  "雇用保険法": ["雇用保険法"],
  "健康保険法": ["健康保険法"],
  "国民年金法": ["国民年金法"],
  "厚生年金保険法": ["厚生年金保険法"],
  "特許法・実用新案法": ["特許法", "実用新案法"],
  "意匠法・商標法": ["意匠法", "商標法"],
  "著作権法・不正競争防止法": ["著作権法", "不正競争防止法"],
  "簿記": [],
  "財務会計論": ["会社法"],
  "監査論": [],
  "会社法": ["会社法"],
  "金融商品取引法": ["金融商品取引法"],
};

// ========== 法令データ読み込み ==========

interface LawArticle { article: string; content: string; }

function loadLaw(lawName: string): LawArticle[] {
  const file = `${LAWS_DIR}/${lawName}.json`;
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return data.articles || [];
  } catch { return []; }
}

function getLawTextForTopic(
  examId: string, subjectName: string, topicName: string
): { text: string; lawNames: string[] } {
  const examLaws = EXAM_LAW_MAP[examId] || [];
  const subjectHints = SUBJECT_LAW_HINTS[subjectName] || [];
  const priorityLaws = subjectHints.length > 0 ? subjectHints : examLaws;

  const texts: string[] = [];
  const usedLaws: string[] = [];

  for (const lawName of priorityLaws) {
    const articles = loadLaw(lawName);
    if (articles.length === 0) continue;

    // Geminiの1Mコンテキストを活かして、関連条文をたっぷり入れる
    const relevant = filterRelevantArticles(articles, topicName, subjectName);
    const articleText = relevant.length > 0
      ? relevant.map(a => `${a.article}\n${a.content}`).join("\n\n")
      : articles.slice(0, 200).map(a => `${a.article}\n${a.content}`).join("\n\n");

    // Gemini版: 100,000字まで（Claude版は25,000字）
    const trimmed = articleText.slice(0, 100000);
    if (trimmed.length > 100) {
      texts.push(`【${lawName}】\n${trimmed}`);
      usedLaws.push(lawName);
    }
  }

  // Gemini版: 合計200,000字まで（Claude版は50,000字）
  const combined = texts.join("\n\n---\n\n").slice(0, 200000);
  return { text: combined, lawNames: usedLaws };
}

function filterRelevantArticles(
  articles: LawArticle[], topic: string, subject: string
): LawArticle[] {
  const keywords = extractKeywords(topic, subject);
  if (keywords.length === 0) return [];

  const scored = articles.map(a => {
    const text = a.article + " " + a.content;
    const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    return { article: a, score };
  });

  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 200).map(s => s.article);
}

function extractKeywords(topic: string, subject: string): string[] {
  const words = [...topic.split(/[・、/（）()]/), ...subject.split(/[・、/（）()]/)];
  return words.filter(w => w.length >= 2);
}

// ========== 試験タイプ別プロンプト ==========

function getExamType(exam: ExamCategory): "law" | "accounting" | "it" | "medical" | "general" {
  const id = exam.id;
  if (["yobi-shihou", "shihou-shiken", "shihou-shoshi", "gyousei-shoshi",
       "sharoshi", "benri-shi", "business-law", "chizai", "kojin-joho",
       "takken", "mankan", "chintai", "koumuin", "kikenbutsu", "kashikin",
       "gaimuin", "kenchiku-shi", "zeirishi"].includes(id)) return "law";
  if (["kounin-kaikeishi", "boki2", "boki3", "fp2", "shindan-shi"].includes(id)) return "accounting";
  if (["it-passport", "kihon-jouhou", "sg", "ap", "st", "nw", "db",
       "aws", "python3"].includes(id)) return "it";
  if (["ishi", "kangoshi", "touroku-hanbai", "hoiku-shi"].includes(id)) return "medical";
  return "general";
}

// ========== 品質保証: セルフチェックプロンプト ==========

function buildSelfCheckPrompt(
  exam: ExamCategory, topicName: string, content: string,
  lawText: string, hasLaw: boolean
): string {
  return `あなたは${exam.name}の教材品質管理の専門家です。
以下の教材を厳密にチェックし、問題があれば修正した完全版を出力してください。

## チェック対象トピック: ${topicName}

## チェック項目（全て確認すること）

### A. 正確性チェック
1. **条文番号の検証**: 教材中の全ての条文番号が${hasLaw ? "下記の法令データに実在するか" : "正確か"}確認。存在しない条文番号は削除または修正
2. **数字の検証**: 期間・金額・面積・割合・人数等の数字が全て正確か
3. **旧法・廃止規定の混入**: 現行法で改正済みの用語や制度を使っていないか（例: 旧民法の「中断」→現行法では「完成猶予・更新」）
4. **要件・効果の正確性**: 制度の成立要件や法的効果が正確か、要件の抜けはないか

### B. 網羅性チェック
5. **例外規定の欠落**: 「ただし〜」「〜の場合を除く」「〜についてはこの限りでない」等の例外規定が全て記載されているか
6. **原則と例外のセット**: 原則だけ書いて例外を書いていない箇所はないか
7. **重要判例の欠落**: このトピックで必須の判例が漏れていないか

### C. スコープチェック
8. **トピック外の内容**: 「${topicName}」に直接関係ない制度・概念の解説が混入していないか → 混入していれば削除
9. **深さの適切さ**: 関連トピックへの言及は「〜については別トピック参照」程度に留め、本格的な解説は不要

### D. 実用性チェック
10. **具体例の充実度**: 抽象的な定義だけでなく、具体的な事例・数値例が十分にあるか
11. **比較表の存在**: 似た制度との比較がMarkdown表で整理されているか
12. **ひっかけパターン**: 試験で実際に出る誤答選択肢のパターンが含まれているか

${hasLaw ? `## 法令データ（検証用）
${lawText.slice(0, 150000)}` : ""}

## チェック対象の教材
${content}

## 出力ルール
- 問題がなければそのまま出力
- 問題があれば修正済みの完全版を出力（差分ではなく全文）
- 修正した箇所の末尾に <!-- fixed: 理由 --> のHTMLコメントを入れる
- マークダウン形式の教材本文のみ出力。\`\`\`で囲まない`;
}

// ========== メインプロンプト構築 ==========

function buildPrompt(
  exam: ExamCategory, subjectName: string, topicName: string,
  lawText: string, lawNames: string[]
): string {
  const examType = getExamType(exam);
  const hasLaw = lawText.length > 100;

  const baseInfo = `## 試験情報
試験名: ${exam.name}
科目: ${subjectName}
トピック: ${topicName}
${exam.hasEssay ? "※ 論述式がある試験です。記述・論述対策も含めてください。" : ""}`;

  const lawSection = hasLaw ? `
## 根拠となる法令条文（${lawNames.join("、")}）
以下の法令条文を**唯一の正確な情報源**として教材を作成してください。

**重要**: 条文番号を記載する場合、必ず以下のデータ内に実在する条文のみを使うこと。
データに存在しない条文番号を書くと重大な品質問題になる。
条文が見つからない場合は条文番号を省略し、制度の説明のみ記載すること。

${lawText}` : "";

  // 宅建検証で判明した頻出エラーパターンを防止するルール
  const antiHallucinationRules = `
## 絶対ルール（違反は品質不合格）

### 正確性ルール
1. **条文番号の捏造禁止**: ${hasLaw ? "上記法令データに存在する条文番号のみ使用可能。「〜条の2」「〜条の3」等の枝番号も、データに実在するものだけ使うこと。見つからなければ条文番号を書かずに制度の内容だけ説明する" : "確信がない条文番号は書かない。「※条文番号要確認」と明記する"}
2. **数字は推測しない**: 期間（年・月・日）、金額、面積、割合、人数等の数字は、${hasLaw ? "法令データから正確に引用" : "確信がある場合のみ記載"}。記憶があいまいな数字は「※要確認」と明記
3. **現行法のみ使用**: 改正前の旧法用語・廃止された制度を書かない。特に注意:
   - 旧民法の「時効の中断」→ 現行法では「完成猶予・更新」
   - 旧法の条文番号が変わっている場合がある
   - 改正で要件が変わっている制度がある
4. **例外規定は必ず書く**: 原則を書いたら、必ず「ただし書き」「除外規定」「適用除外」をセットで書く。例外を省略しない

### スコープルール
5. **このトピックだけを扱う**: 「${topicName}」に直接関係する内容のみ。関連する別トピックは「〜については[別トピック名]で詳述」と一行で触れるだけ
6. **深入りしない**: 前提知識の説明は最小限（1-2文）。読者は同じ科目の他トピックも学習する前提

### 品質ルール
7. **具体例を必ず入れる**: 全てのセクションに具体的な事例・数値例・ケーススタディを含める。抽象的な定義だけのセクションは不合格
8. **比較表を活用**: 似た制度・概念がある場合、必ずMarkdown表形式で比較する
9. **試験目線で書く**: 「出題されやすいポイント」「ひっかけの典型パターン」「正誤判断の決め手」を明示
10. **10,000〜15,000字**: この範囲で作成。法律系は長めに。短すぎる教材は不合格`;

  const structureByType: Record<string, string> = {
    law: `
## 教材の構成（この順序で全セクション必須）

### 1. 概要と出題傾向（400〜600字）
- この分野の試験での位置づけ・出題頻度・配点目安
- 「この分野から毎年X問出題」等の具体的な傾向
- 得点戦略（確実に取る/捨て問にしない等）
- 学習の優先度と他トピックとの関連性

### 2. 制度の全体像（1,500〜2,500字）
- 制度の趣旨・目的（なぜこの制度が必要か — 立法趣旨）
- 制度の基本構造を図式的に説明
- 主要な用語の正確な定義（${hasLaw ? "条文に基づく" : "通説に基づく"}）
- この制度の「登場人物」と「法律関係」を明確に

### 3. 要件と効果（2,000〜3,500字）
- 成立要件を一つずつ丁寧に（要件①、要件②...）
- 各要件の具体的な判断基準
- 法的効果（何が起こるか）
- **例外・除外規定を全て網羅**（「ただし〜」を絶対に省略しない）
- ${hasLaw ? "全ての要件・効果に条文番号を付記" : ""}
- 具体的な事例で要件充足を確認する演習的な説明

### 4. 重要判例・論点（2,000〜3,000字）
- 試験頻出の判例（事案の概要→争点→結論→試験での出題ポイント）
- 学説の対立がある場合は判例・通説の立場を明示
- 複合的な論点（複数の制度が絡むケース）
- 具体的な事例問題形式での解説

### 5. ひっかけ・誤答パターン（1,000〜2,000字）
- 試験で実際に出る「誤りの選択肢」のパターンを列挙
- 各パターンについて「なぜ誤りか」を条文・判例の根拠付きで説明
- 正誤判断の決め手（この一点を知っていれば解ける）
- 「○か×か」形式の確認問題を5問以上

### 6. 比較・横断整理（800〜1,500字）
- 似た制度との比較表（Markdown表形式 — 最低1つ）
- 混同しやすいポイントを「AとBの違い」形式で整理
- 重要数字の一覧表（期間・金額・面積・割合等）

### 7. 暗記チェックリスト（400〜600字）
- 絶対に覚えるべき項目を箇条書き
- 数字・期間の一覧
- 語呂合わせ・覚え方（自然なものがあれば）`,

    accounting: `
## 教材の構成（この順序で全セクション必須）

### 1. 概要と出題傾向（400〜600字）
- 試験での出題範囲・配点・出題頻度
- 計算問題か理論問題か、またはその両方か
- 学習の優先度

### 2. 基本理論（2,000〜3,000字）
- 基礎概念・定義を正確に
- 会計基準・原則の根拠と趣旨
- 関連する基準・指針の体系的な位置づけ
- 具体的な数値例を交えた説明

### 3. 計算・仕訳パターン（3,000〜5,000字）
- 基本パターンから応用パターンまで網羅
- 各パターンに具体的な数値例と完全な計算過程
- 仕訳例（借方/貸方を明示、金額付き）
- 計算の「落とし穴」と注意点
- 電卓操作のコツ（該当する場合）

### 4. 応用・複合論点（2,000〜3,000字）
- 複合的な問題パターン（2つ以上の論点が絡むケース）
- 間違えやすい処理とその理由
- 例外的な取扱い・特殊なケース
- 税効果・連結等との関連（該当する場合）

### 5. ひっかけ・誤答パターン（800〜1,500字）
- よくある計算ミスのパターン
- 理論問題での誤りの選択肢パターン
- 確認問題を5問以上

### 6. 出題パターンと攻略（500〜1,000字）
- 過去問の傾向
- 時間配分のコツ
- 部分点の取り方

### 7. 暗記チェック（400〜600字）
- 重要な勘定科目・計算公式一覧
- 仕訳の「型」一覧`,

    it: `
## 教材の構成（この順序で全セクション必須）

### 1. 概要と出題傾向（400〜600字）
- 出題範囲での位置づけ・出題頻度
- 午前/午後での出題形式の違い（該当する場合）

### 2. 基本知識（2,500〜4,000字）
- 技術の仕組み・原理を段階的に説明
- 用語の正確な定義（曖昧な表現を避ける）
- アーキテクチャ・構成をテキストベースで図解
- 具体的な構成例・設定例

### 3. 技術の詳細（2,500〜4,000字）
- 具体的なプロトコル・アルゴリズム・手法の動作
- パケット構造・データフロー等の詳細
- セキュリティ・パフォーマンスの観点
- 実務での利用シーン
- 計算問題がある場合は計算過程を完全に示す

### 4. 比較・分類（1,000〜2,000字）
- 似た技術との比較表（Markdown表形式 — 最低1つ）
- 用途・要件による使い分け
- バージョンや規格の違い
- 「AとBの違い」形式の整理

### 5. ひっかけ・誤答パターン（800〜1,500字）
- 試験で出る誤りの選択肢パターン
- 用語の混同パターン
- 確認問題を5問以上

### 6. 暗記チェック（400〜600字）
- 数値・規格・略語一覧表
- ポート番号・プロトコル対応表（該当する場合）
- 計算公式一覧（該当する場合）`,

    medical: `
## 教材の構成（この順序で全セクション必須）

### 1. 概要と出題傾向（400〜600字）
- 試験での出題頻度・重要度
- 出題形式の傾向

### 2. 基本知識（2,500〜4,000字）
- 基礎理論・メカニズムを段階的に
- 分類・体系的な整理（表形式を活用）
- 正常と異常の対比

### 3. 臨床・実務（2,500〜4,000字）
- 具体的な症例・事例（典型例と非典型例）
- 判断基準・手順をフローで示す
- 注意点・禁忌を明確に
- 鑑別診断のポイント

### 4. 関連制度・法規（500〜1,500字）
- 関連法令・ガイドライン
- 届出・手続きの流れ

### 5. ひっかけ・誤答パターン（800〜1,500字）
- 国試での典型的な誤答パターン
- 状況設定問題の攻略
- 確認問題を5問以上

### 6. 暗記チェック（400〜600字）
- 数値・基準値一覧表
- 分類表
- 語呂合わせ（自然なものがあれば）`,

    general: `
## 教材の構成（この順序で全セクション必須）

### 1. 概要と出題傾向（400〜600字）
- 試験での出題範囲・位置づけ
- 出題頻度と配点

### 2. 基本知識（3,000〜5,000字）
- 体系的な解説
- 重要概念の正確な定義と説明
- 具体的な事例を交えて

### 3. 応用・発展（2,500〜4,000字）
- 応用的な論点
- 複合的な問題パターン
- 具体例・ケーススタディ

### 4. 比較・整理（800〜1,500字）
- 似た概念の比較表
- 混同しやすいポイント

### 5. ひっかけ・誤答パターン（800〜1,500字）
- 試験での典型的な誤答パターン
- 確認問題を5問以上

### 6. 暗記チェック（400〜600字）
- 重要ポイント一覧`,
  };

  return `あなたは${exam.name}の教材を作成する日本トップクラスの講師です。
予備校で20年以上の指導経験があり、合格率90%以上を誇ります。
あなたの教材は「この教材だけで合格できる」と評判で、市販テキストを超える品質が求められています。

${baseInfo}
${lawSection}

${antiHallucinationRules}

${structureByType[examType] || structureByType.general}

## 出力
マークダウン形式で教材本文のみ出力してください。\`\`\`で囲まない。`;
}

// ========== メイン ==========

interface GeneratedTopic {
  examId: string;
  subject: string;
  topic: string;
  content: string;
  charCount: number;
  hasLawSource: boolean;
  generatedAt: string;
  generatedBy: string;
}

// ========== 品質ゲート ==========

const MIN_CHARS = 8000;
const REQUIRED_SECTIONS_LAW = ["概要", "制度", "要件", "判例", "ひっかけ", "比較", "暗記"];
const REQUIRED_SECTIONS_OTHER = ["概要", "基本", "ひっかけ", "暗記"];

function qualityCheck(content: string, examType: string): { pass: boolean; issues: string[] } {
  const issues: string[] = [];

  if (content.length < MIN_CHARS) {
    issues.push(`文字数不足: ${content.length}字 (最低${MIN_CHARS}字)`);
  }

  // セクション見出しの存在チェック
  const requiredKeywords = examType === "law" ? REQUIRED_SECTIONS_LAW : REQUIRED_SECTIONS_OTHER;
  const headings = content.match(/^##+ .+/gm) || [];
  const headingText = headings.join(" ");
  for (const kw of requiredKeywords) {
    if (!headingText.includes(kw)) {
      issues.push(`必須セクション欠落: 「${kw}」を含む見出しがない`);
    }
  }

  // 具体例の存在チェック（「例:」「例えば」「具体的に」「ケース」が少なすぎる）
  const exampleMatches = content.match(/例[：:]|例えば|具体的に|ケース|事例/g) || [];
  if (exampleMatches.length < 3) {
    issues.push(`具体例不足: ${exampleMatches.length}箇所（最低3箇所必要）`);
  }

  // Markdown表の存在チェック
  const tableMatches = content.match(/\|.*\|.*\|/g) || [];
  if (tableMatches.length < 3) {
    issues.push(`比較表不足: Markdown表が不十分`);
  }

  return { pass: issues.length === 0, issues };
}

// ========== メイン生成ループ ==========

async function generateForExam(exam: ExamCategory) {
  const outputFile = `${OUTPUT_DIR}/${exam.id}.json`;

  let results: GeneratedTopic[] = [];
  const doneTopics = new Set<string>();

  if (existsSync(outputFile)) {
    results = JSON.parse(readFileSync(outputFile, "utf-8"));
    // Gemini生成分のみカウント（Claude生成分は再生成対象）
    const geminiResults = results.filter(r => r.generatedBy === "gemini-2.5-pro-v2");
    for (const r of geminiResults) {
      doneTopics.add(`${r.subject}::${r.topic}`);
    }
    // 旧Gemini/Claude生成分を除外してv2分だけ残す
    if (geminiResults.length > 0 && geminiResults.length < results.length) {
      results = geminiResults;
      console.log(`  v2生成済み: ${geminiResults.length}トピック（旧版は再生成）`);
    } else if (geminiResults.length === results.length) {
      console.log(`  既存(v2): ${results.length}トピック`);
    } else {
      results = [];
      console.log(`  旧版をリセット → v2で再生成`);
    }
  }

  const allTopics: { subject: string; topic: string }[] = [];
  for (const sub of exam.subjects) {
    for (const topic of sub.topics) {
      allTopics.push({ subject: sub.name, topic });
    }
  }

  const remaining = allTopics.filter(t => !doneTopics.has(`${t.subject}::${t.topic}`));
  if (remaining.length === 0) {
    console.log(`  全トピック生成済み -- スキップ`);
    return;
  }

  const examType = getExamType(exam);
  console.log(`  対象: ${remaining.length}/${allTopics.length}トピック\n`);

  for (let i = 0; i < remaining.length; i++) {
    const { subject, topic } = remaining[i];
    console.log(`  [${i + 1}/${remaining.length}] ${subject} > ${topic}`);
    const startTime = Date.now();

    try {
      const { text: lawText, lawNames } = getLawTextForTopic(exam.id, subject, topic);
      const hasLaw = lawText.length > 100;

      // ===== Step 1: 生成 =====
      const prompt = buildPrompt(exam, subject, topic, lawText, lawNames);
      const result = await model.generateContent([{ text: prompt }]);
      let content = result.response.text();
      const step1Chars = content.length;
      const step1Elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // ===== Step 2: 品質ゲート =====
      const qc = qualityCheck(content, examType);

      if (!qc.pass) {
        console.log(`    Step1: ${step1Chars.toLocaleString()}字 (${step1Elapsed}s) — 品質NG: ${qc.issues[0]}`);
      } else {
        console.log(`    Step1: ${step1Chars.toLocaleString()}字 (${step1Elapsed}s) — 品質OK`);
      }

      // ===== Step 3: セルフチェック（常に実行） =====
      await new Promise(r => setTimeout(r, 2000));
      const checkPrompt = buildSelfCheckPrompt(exam, topic, content, lawText, hasLaw);
      const checkResult = await model.generateContent([{ text: checkPrompt }]);
      const checkedContent = checkResult.response.text();
      const step2Elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // セルフチェック後が十分な長さなら採用、短すぎればStep1版を使用
      if (checkedContent.length >= content.length * 0.8) {
        content = checkedContent;
        const fixCount = (content.match(/<!-- fixed:/g) || []).length;
        console.log(`    Step2: セルフチェック完了 (${fixCount}箇所修正, ${step2Elapsed}s)`);
      } else {
        console.log(`    Step2: セルフチェック出力短すぎ → Step1版を採用`);
      }

      // HTMLコメントを除去（教材本文には不要）
      content = content.replace(/\s*<!-- fixed:.*?-->/g, "");

      const charCount = content.length;
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      results.push({
        examId: exam.id,
        subject,
        topic,
        content,
        charCount,
        hasLawSource: hasLaw,
        generatedAt: new Date().toISOString(),
        generatedBy: "gemini-2.5-pro-v2",
      });

      doneTopics.add(`${subject}::${topic}`);
      writeFileSync(outputFile, JSON.stringify(results, null, 2));

      console.log(`    完了: ${charCount.toLocaleString()}字 (${totalElapsed}s)${hasLaw ? " [法令根拠あり]" : ""}\n`);

      // レートリミット対策（2回API呼ぶので少し長めに）
      await new Promise(r => setTimeout(r, 4000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ ${msg.slice(0, 150)}`);

      if (msg.includes("429") || msg.includes("503") || msg.includes("quota") || msg.includes("rate") || msg.includes("Resource has been exhausted") || msg.includes("high demand") || msg.includes("Service Unavailable")) {
        const retryKey = `retry_${exam.id}_${i}`;
        const retryCount = ((globalThis as any)[retryKey] || 0) as number;
        if (retryCount < 5) {
          (globalThis as any)[retryKey] = retryCount + 1;
          const waitSec = 60 * (retryCount + 1);
          console.log(`    ⏸️  ${waitSec}秒待機 (${retryCount + 1}/5)...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          i--; // リトライ
        } else {
          console.log(`    ⏭️  5回失敗 → スキップ`);
        }
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  const totalChars = results.reduce((s, r) => s + r.charCount, 0);
  console.log(`\n  完了: ${results.length}トピック / ${totalChars.toLocaleString()}字 (平均 ${Math.round(totalChars / results.length).toLocaleString()}字/トピック)\n`);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const targetArg = process.argv[2];
  const targetIds = targetArg ? targetArg.split(",").map(s => s.trim()) : null;

  const exams = EXAM_CATEGORIES.filter(e => {
    if (e.id === "takken") return false; // 宅建はv3照合済み
    if (targetIds) return targetIds.includes(e.id);
    return true;
  });

  if (exams.length === 0) {
    console.error("対象試験がありません。");
    console.log("利用可能:", EXAM_CATEGORIES.map(e => e.id).join(", "));
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`教材 v3 生成（Gemini 2.5 Pro v2 — 高品質版）`);
  console.log(`対象: ${exams.length}試験`);
  console.log(`目標: 10,000〜15,000字/トピック`);
  console.log(`パイプライン: 生成 → 品質ゲート → セルフチェック`);
  console.log(`========================================\n`);

  for (const exam of exams) {
    console.log(`\n--- ${exam.name} (${exam.id}) ---`);
    await generateForExam(exam);
  }

  console.log(`\n========================================`);
  console.log(`全試験 生成完了`);
  for (const exam of exams) {
    const file = `${OUTPUT_DIR}/${exam.id}.json`;
    if (existsSync(file)) {
      const data: GeneratedTopic[] = JSON.parse(readFileSync(file, "utf-8"));
      const chars = data.reduce((s, r) => s + r.charCount, 0);
      console.log(`  ${exam.id}: ${data.length}トピック / ${chars.toLocaleString()}字`);
    }
  }
  console.log(`========================================\n`);
}

main().catch(console.error);
