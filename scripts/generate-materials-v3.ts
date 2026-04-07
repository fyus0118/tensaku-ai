/**
 * 全試験対応 教材生成スクリプト v3
 *
 * v2との差分:
 *   - 1トピック 5,000〜10,000字（v2は800〜1,200字）
 *   - 法令全文を使用（v2は最初の50条のみ）
 *   - max_tokens: 8192（v2は2048）
 *   - 試験ごとにカスタムプロンプト
 *
 * 使い方:
 *   bun run scripts/generate-materials-v3.ts              # 全試験
 *   bun run scripts/generate-materials-v3.ts fp2           # 特定試験のみ
 *   bun run scripts/generate-materials-v3.ts fp2,boki2     # 複数指定
 *
 * 出力: scripts/materials-v3/{examId}.json
 */

import Anthropic from "@anthropic-ai/sdk";
import { EXAM_CATEGORIES, type ExamCategory } from "../src/lib/exams";
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
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

// 科目→トピック に関連する法令名を推定するマッピング（法令系試験向け）
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

interface LawArticle {
  article: string;
  content: string;
}

function loadLaw(lawName: string): LawArticle[] {
  const file = `${LAWS_DIR}/${lawName}.json`;
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return data.articles || [];
  } catch {
    return [];
  }
}

function getLawTextForTopic(
  examId: string,
  subjectName: string,
  topicName: string
): { text: string; lawNames: string[] } {
  // 1. 試験全体の法令リスト
  const examLaws = EXAM_LAW_MAP[examId] || [];

  // 2. 科目名からヒントを得る
  const subjectHints = SUBJECT_LAW_HINTS[subjectName] || [];

  // 3. 優先順位: 科目ヒント > 試験全体
  const priorityLaws = subjectHints.length > 0 ? subjectHints : examLaws;

  const texts: string[] = [];
  const usedLaws: string[] = [];

  for (const lawName of priorityLaws) {
    const articles = loadLaw(lawName);
    if (articles.length === 0) continue;

    // トピック名に関連する条文をフィルタリング
    const relevant = filterRelevantArticles(articles, topicName, subjectName);
    const articleText = relevant.length > 0
      ? relevant.map(a => `${a.article}\n${a.content}`).join("\n\n")
      : articles.slice(0, 80).map(a => `${a.article}\n${a.content}`).join("\n\n");

    const trimmed = articleText.slice(0, 25000);
    if (trimmed.length > 100) {
      texts.push(`【${lawName}】\n${trimmed}`);
      usedLaws.push(lawName);
    }
  }

  // 合計テキストを制限
  const combined = texts.join("\n\n---\n\n").slice(0, 50000);
  return { text: combined, lawNames: usedLaws };
}

function filterRelevantArticles(
  articles: LawArticle[],
  topic: string,
  subject: string
): LawArticle[] {
  const keywords = extractKeywords(topic, subject);
  if (keywords.length === 0) return [];

  const scored = articles.map(a => {
    const text = a.article + " " + a.content;
    const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    return { article: a, score };
  });

  const relevant = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  return relevant.slice(0, 100).map(s => s.article);
}

function extractKeywords(topic: string, subject: string): string[] {
  // トピック名と科目名からキーワードを抽出
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

function buildPrompt(
  exam: ExamCategory,
  subjectName: string,
  topicName: string,
  lawText: string,
  lawNames: string[]
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
以下の法令条文を根拠として教材を作成してください。

${lawText}` : "";

  const structureByType: Record<string, string> = {
    law: `
### 1. 概要（300字程度）
- この分野の試験での位置づけ・出題頻度・配点目安

### 2. 基本知識（1,500〜3,000字）
- 制度の趣旨・目的
- 基本的な仕組み・要件・効果
- ${hasLaw ? "条文の根拠を必ず明記" : "正確な制度内容を記載（不確実な点は「※要確認」と明記）"}

### 3. 重要論点の深掘り（1,500〜3,000字）
- 試験頻出の論点を個別に解説
- 原則と例外
- 具体例・事例
- ひっかけパターンと正誤判断基準

### 4. 比較・横断整理（500〜1,000字）
- 似た制度との比較表
- 混同しやすいポイント
- 数字の一覧（期間・金額等）

### 5. 過去問での出題パターン（500〜1,000字）
- 典型的な出題形式とひっかけ
- 正解を見抜くコツ

### 6. 暗記チェックリスト（300〜500字）
- 絶対に覚えるべき項目一覧
- 語呂合わせ・覚え方`,

    accounting: `
### 1. 概要（300字程度）
- 試験での出題範囲・配点

### 2. 基本理論（1,000〜2,000字）
- 基礎概念・定義
- 会計基準・原則の根拠

### 3. 計算・仕訳（2,000〜3,000字）
- 計算パターンを網羅
- 仕訳例（借方/貸方を明示）
- 計算過程をステップごとに
- 頻出の数値パターン

### 4. 応用論点（1,000〜2,000字）
- 複合的な問題パターン
- 間違えやすい処理
- 例外的な取扱い

### 5. 出題パターンと攻略（500〜1,000字）
- 過去問の傾向
- 時間配分のコツ
- 部分点の取り方

### 6. 暗記チェック（300〜500字）
- 重要な勘定科目・公式一覧`,

    it: `
### 1. 概要（300字程度）
- 出題範囲での位置づけ

### 2. 基本知識（1,500〜3,000字）
- 技術の仕組み・原理
- 用語の正確な定義
- 図解的な説明（テキストベース）

### 3. 技術の詳細（1,500〜3,000字）
- 具体的なプロトコル・アルゴリズム・手法
- 実例・構成例
- セキュリティ・パフォーマンスの観点

### 4. 比較・分類（500〜1,000字）
- 似た技術との比較表
- 用途による使い分け
- バージョンや規格の違い

### 5. 出題パターン（500〜1,000字）
- 計算問題の解法（該当する場合）
- 穴埋め・選択肢の傾向
- 午後問題での出題形式（該当する場合）

### 6. 暗記チェック（300〜500字）
- 数値・規格・略語一覧`,

    medical: `
### 1. 概要（300字程度）
- 試験での出題頻度・重要度

### 2. 基本知識（1,500〜3,000字）
- 基礎理論・メカニズム
- 分類・体系的な整理

### 3. 臨床・実務（1,500〜3,000字）
- 具体的な症例・事例
- 判断基準・手順
- 注意点・禁忌

### 4. 関連制度・法規（500〜1,000字）
- 関連法令・ガイドライン
- 届出・手続き

### 5. 出題パターン（500〜1,000字）
- 国試での典型的な出題形式
- 状況設定問題の攻略

### 6. 暗記チェック（300〜500字）
- 数値・基準値一覧
- 語呂合わせ`,

    general: `
### 1. 概要（300字程度）
- 試験での出題範囲

### 2. 基本知識（2,000〜4,000字）
- 体系的な解説
- 重要概念の定義と説明

### 3. 応用・発展（1,500〜2,500字）
- 応用的な論点
- 具体例

### 4. 出題パターン（500〜1,000字）
- 典型的な出題形式
- 攻略法

### 5. 暗記チェック（300〜500字）
- 重要ポイント一覧`,
  };

  return `あなたは${exam.name}の教材を作成するプロの講師です。
20年以上の指導経験があり、合格者を多数輩出しています。

${baseInfo}
${lawSection}

## 絶対ルール
1. ${hasLaw ? "上記の法令条文に書かれている内容を根拠にすること" : "確信がある情報のみ記載すること"}
2. ${hasLaw ? "条文番号を必ず明記すること（不確かな場合は「※条文番号要確認」）" : "不確実な情報は「※要確認」と明記すること"}
3. 試験の出題傾向を踏まえて、出る部分を重点的に解説すること
4. 具体例を多く入れること
5. 5,000〜10,000字で作成すること

## 教材の構成
${structureByType[examType] || structureByType.general}

マークダウン形式で出力してください。`;
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
}

async function generateForExam(exam: ExamCategory) {
  const outputFile = `${OUTPUT_DIR}/${exam.id}.json`;

  // 既存結果の読み込み（レジューム対応）
  let results: GeneratedTopic[] = [];
  const doneTopics = new Set<string>();

  if (existsSync(outputFile)) {
    results = JSON.parse(readFileSync(outputFile, "utf-8"));
    for (const r of results) {
      doneTopics.add(`${r.subject}::${r.topic}`);
    }
    console.log(`  既存: ${results.length}トピック`);
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

  console.log(`  対象: ${remaining.length}/${allTopics.length}トピック\n`);

  for (const { subject, topic } of remaining) {
    const key = `${subject}::${topic}`;
    console.log(`  ${subject} > ${topic} ...`);
    const startTime = Date.now();

    try {
      const { text: lawText, lawNames } = getLawTextForTopic(exam.id, subject, topic);
      const prompt = buildPrompt(exam, subject, topic, lawText, lawNames);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0].type === "text" ? response.content[0].text : "";
      const charCount = content.length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      results.push({
        examId: exam.id,
        subject,
        topic,
        content,
        charCount,
        hasLawSource: lawText.length > 100,
        generatedAt: new Date().toISOString(),
      });

      doneTopics.add(key);
      writeFileSync(outputFile, JSON.stringify(results, null, 2));

      console.log(`  -> ${charCount.toLocaleString()}字 (${elapsed}s)${lawText.length > 100 ? " [法令根拠あり]" : ""}`);

      // レートリミット対策
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg.slice(0, 120)}`);

      if (msg.includes("rate") || msg.includes("429") || msg.includes("overloaded")) {
        console.log(`  -> 30秒待機後にリトライ...`);
        await new Promise(r => setTimeout(r, 30000));
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // サマリー
  const totalChars = results.reduce((s, r) => s + r.charCount, 0);
  console.log(`\n  完了: ${results.length}トピック / ${totalChars.toLocaleString()}字 (平均 ${Math.round(totalChars / results.length).toLocaleString()}字/トピック)\n`);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // コマンドライン引数で試験を絞り込み
  const targetArg = process.argv[2];
  const targetIds = targetArg ? targetArg.split(",").map(s => s.trim()) : null;

  const exams = EXAM_CATEGORIES.filter(e => {
    if (e.id === "takken") return false; // 宅建はv3済み
    if (targetIds) return targetIds.includes(e.id);
    return true;
  });

  if (exams.length === 0) {
    console.error("対象試験がありません。IDを確認してください。");
    console.log("利用可能:", EXAM_CATEGORIES.map(e => e.id).join(", "));
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`教材 v3 生成（5,000〜10,000字/トピック）`);
  console.log(`対象: ${exams.length}試験`);
  console.log(`========================================\n`);

  for (const exam of exams) {
    console.log(`\n--- ${exam.name} (${exam.id}) ---`);
    await generateForExam(exam);
  }

  // 全体サマリー
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
