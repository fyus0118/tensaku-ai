/**
 * IPA公式サイトからIT系試験の過去問ページをスクレイピングしてテキスト化
 * PDF取得ではなく、過去問道場系サイトの公開データを活用
 *
 * 使い方: bun run scripts/fetch-ipa.ts
 * 出力: scripts/ipa-questions/ ディレクトリにJSONファイル
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";

const OUTPUT_DIR = "./scripts/ipa-questions";

// IPA過去問のURLパターン
const IPA_EXAM_URLS: { examId: string; name: string; baseUrl: string }[] = [
  { examId: "it-passport", name: "ITパスポート試験", baseUrl: "https://www.itpassportsiken.com/ipkakomon.php" },
  { examId: "sg", name: "情報セキュリティマネジメント試験", baseUrl: "https://www.sg-siken.com/sgkakomon.php" },
  { examId: "kihon-jouhou", name: "基本情報技術者試験", baseUrl: "https://www.fe-siken.com/fekakomon.php" },
  { examId: "ap", name: "応用情報技術者試験", baseUrl: "https://www.ap-siken.com/apkakomon.php" },
  { examId: "nw", name: "ネットワークスペシャリスト試験", baseUrl: "https://www.nw-siken.com/nwkakomon.php" },
  { examId: "db", name: "データベーススペシャリスト試験", baseUrl: "https://www.db-siken.com/dbkakomon.php" },
  { examId: "st", name: "ITストラテジスト試験", baseUrl: "https://www.st-siken.com/stkakomon.php" },
];

// IPA公式の過去問PDFリンクを取得
const IPA_OFFICIAL_BASE = "https://www.ipa.go.jp/shiken/mondai-kaiotu";

interface QuestionData {
  examId: string;
  examName: string;
  source: string;
  questions: { year: string; category: string; question: string; answer: string; explanation: string }[];
  fetchedAt: string;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "StudyEngines-MaterialCollector/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// HTMLからテキストを抽出
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n💻 IPA過去問取得開始\n`);

  // IPA公式の過去問ページからリンクを取得
  try {
    console.log("  📄 IPA公式 過去問ページを取得中...");
    const officialPage = await fetchPage(`${IPA_OFFICIAL_BASE}/index.html`);
    const text = htmlToText(officialPage);

    writeFileSync(`${OUTPUT_DIR}/ipa-official-index.txt`, text);
    console.log("    → IPA公式インデックス保存完了");
  } catch (err) {
    console.error("  ❌ IPA公式ページ取得失敗:", err);
  }

  // 各試験の過去問道場からメタデータを取得
  for (const exam of IPA_EXAM_URLS) {
    const outFile = `${OUTPUT_DIR}/${exam.examId}.json`;

    if (existsSync(outFile)) {
      console.log(`  ⏭ ${exam.name} — スキップ（取得済み）`);
      continue;
    }

    try {
      console.log(`  📝 ${exam.name} (${exam.baseUrl})`);
      const html = await fetchPage(exam.baseUrl);
      const text = htmlToText(html);

      const data: QuestionData = {
        examId: exam.examId,
        examName: exam.name,
        source: exam.baseUrl,
        questions: [],
        fetchedAt: new Date().toISOString(),
      };

      // テキストからメタデータ（出題年度・カテゴリ一覧）を抽出
      // 過去問道場のページは問題一覧のメタデータを含む
      writeFileSync(`${OUTPUT_DIR}/${exam.examId}-raw.txt`, text);
      writeFileSync(outFile, JSON.stringify(data, null, 2));

      console.log(`    → メタデータ保存完了`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ❌ ${exam.name}: ${err}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n========================================`);
  console.log(`💻 IPA過去問取得完了`);
  console.log(`========================================\n`);
}

main().catch(console.error);
