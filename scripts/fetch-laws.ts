/**
 * e-Gov法令APIから試験対象の法令条文を取得してJSONで保存
 *
 * 使い方: bun run scripts/fetch-laws.ts
 * 出力: scripts/laws/ ディレクトリに法令ごとのJSONファイル
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";

const OUTPUT_DIR = "./scripts/laws";
const API_BASE = "https://laws.e-gov.go.jp/api/1";

// 全試験で必要な法令のマッピング
const TARGET_LAWS: { lawNum: string; name: string; exams: string[] }[] = [
  // === 憲法 ===
  { lawNum: "昭和二十一年憲法", name: "日本国憲法", exams: ["yobi-shihou", "shihou-shiken", "gyousei-shoshi", "koumuin"] },

  // === 民法・商法 ===
  { lawNum: "明治二十九年法律第八十九号", name: "民法", exams: ["yobi-shihou", "shihou-shiken", "shihou-shoshi", "gyousei-shoshi", "takken", "fp2", "business-law"] },
  { lawNum: "明治三十二年法律第四十八号", name: "商法", exams: ["yobi-shihou", "shihou-shiken", "shihou-shoshi"] },
  { lawNum: "平成十七年法律第八十六号", name: "会社法", exams: ["yobi-shihou", "shihou-shiken", "shihou-shoshi", "kounin-kaikeishi", "business-law"] },

  // === 刑法 ===
  { lawNum: "明治四十年法律第四十五号", name: "刑法", exams: ["yobi-shihou", "shihou-shiken", "shihou-shoshi"] },

  // === 訴訟法 ===
  { lawNum: "平成八年法律第百九号", name: "民事訴訟法", exams: ["yobi-shihou", "shihou-shiken", "shihou-shoshi"] },
  { lawNum: "昭和二十三年法律第百三十一号", name: "刑事訴訟法", exams: ["yobi-shihou", "shihou-shiken"] },

  // === 行政法 ===
  { lawNum: "平成五年法律第八十八号", name: "行政手続法", exams: ["gyousei-shoshi", "koumuin"] },
  { lawNum: "平成二十六年法律第六十八号", name: "行政不服審査法", exams: ["gyousei-shoshi", "koumuin"] },
  { lawNum: "昭和三十七年法律第百三十九号", name: "行政事件訴訟法", exams: ["gyousei-shoshi", "koumuin"] },
  { lawNum: "昭和二十二年法律第百二十五号", name: "国家賠償法", exams: ["gyousei-shoshi", "koumuin"] },
  { lawNum: "昭和二十二年法律第六十七号", name: "地方自治法", exams: ["gyousei-shoshi", "koumuin"] },

  // === 労働・社会保険法 ===
  { lawNum: "昭和二十二年法律第四十九号", name: "労働基準法", exams: ["sharoshi", "business-law"] },
  { lawNum: "昭和二十二年法律第百六十四号", name: "労働者災害補償保険法", exams: ["sharoshi"] },
  { lawNum: "昭和四十九年法律第百十六号", name: "雇用保険法", exams: ["sharoshi"] },
  { lawNum: "大正十一年法律第七十号", name: "健康保険法", exams: ["sharoshi"] },
  { lawNum: "昭和三十四年法律第百四十一号", name: "国民年金法", exams: ["sharoshi"] },
  { lawNum: "昭和二十九年法律第百十五号", name: "厚生年金保険法", exams: ["sharoshi"] },
  { lawNum: "昭和四十七年法律第五十七号", name: "労働安全衛生法", exams: ["sharoshi"] },

  // === 知的財産法 ===
  { lawNum: "昭和三十四年法律第百二十一号", name: "特許法", exams: ["benri-shi", "chizai"] },
  { lawNum: "昭和三十四年法律第百二十三号", name: "実用新案法", exams: ["benri-shi", "chizai"] },
  { lawNum: "昭和三十四年法律第百二十五号", name: "意匠法", exams: ["benri-shi", "chizai"] },
  { lawNum: "昭和三十四年法律第百二十七号", name: "商標法", exams: ["benri-shi", "chizai"] },
  { lawNum: "昭和四十五年法律第四十八号", name: "著作権法", exams: ["benri-shi", "chizai"] },
  { lawNum: "平成五年法律第四十七号", name: "不正競争防止法", exams: ["benri-shi", "chizai", "business-law"] },

  // === 不動産法 ===
  { lawNum: "昭和二十六年法律第百七十六号", name: "宅地建物取引業法", exams: ["takken"] },
  { lawNum: "平成三年法律第九十号", name: "借地借家法", exams: ["takken", "chintai"] },
  { lawNum: "昭和四十三年法律第百号", name: "都市計画法", exams: ["takken", "kenchiku-shi"] },
  { lawNum: "昭和二十五年法律第二百一号", name: "建築基準法", exams: ["takken", "kenchiku-shi"] },
  { lawNum: "昭和三十七年法律第百五十号", name: "区分所有法", exams: ["mankan"] },

  // === 金融法 ===
  { lawNum: "昭和二十三年法律第二十五号", name: "金融商品取引法", exams: ["gaimuin", "kounin-kaikeishi"] },
  { lawNum: "昭和五十八年法律第三十二号", name: "貸金業法", exams: ["kashikin"] },

  // === 個人情報・消費者 ===
  { lawNum: "平成十五年法律第五十七号", name: "個人情報保護法", exams: ["kojin-joho", "sg", "business-law"] },
  { lawNum: "平成十二年法律第六十一号", name: "消費者契約法", exams: ["business-law", "fp2"] },
  { lawNum: "昭和二十二年法律第五十四号", name: "独占禁止法", exams: ["business-law"] },

  // === 危険物 ===
  { lawNum: "昭和二十三年法律第百八十六号", name: "消防法", exams: ["kikenbutsu", "kenchiku-shi"] },

  // === 税法 ===
  { lawNum: "昭和四十年法律第三十四号", name: "法人税法", exams: ["zeirishi", "kounin-kaikeishi"] },
  { lawNum: "昭和四十年法律第三十三号", name: "所得税法", exams: ["zeirishi", "fp2"] },
  { lawNum: "昭和二十五年法律第七十三号", name: "相続税法", exams: ["zeirishi", "fp2"] },
  { lawNum: "昭和六十三年法律第百八号", name: "消費税法", exams: ["zeirishi", "kounin-kaikeishi"] },

  // === 福祉 ===
  { lawNum: "昭和二十二年法律第百六十四号", name: "児童福祉法", exams: ["hoiku-shi"] },
  { lawNum: "昭和二十六年法律第四十五号", name: "社会福祉法", exams: ["hoiku-shi"] },

  // === 薬事 ===
  { lawNum: "昭和三十五年法律第百四十五号", name: "医薬品医療機器等法", exams: ["touroku-hanbai"] },
];

// XMLからテキストを抽出する簡易パーサー
function extractTextFromXml(xml: string): string {
  // XMLタグを除去してテキストだけ抽出
  return xml
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 条文構造を抽出
function extractArticles(xml: string): { article: string; content: string }[] {
  const articles: { article: string; content: string }[] = [];
  // <Article Num="X">...</Article> パターンを探す
  const articleRegex = /<Article[^>]*Num="([^"]*)"[^>]*>([\s\S]*?)<\/Article>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const num = match[1];
    const content = extractTextFromXml(match[2]);
    if (content.trim()) {
      articles.push({ article: `第${num}条`, content: content.trim() });
    }
  }
  return articles;
}

async function fetchLaw(lawNum: string): Promise<string> {
  const url = `${API_BASE}/lawdata/${encodeURIComponent(lawNum)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} for ${lawNum}`);
  }
  return await res.text();
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n⚖️ 法令取得開始: ${TARGET_LAWS.length}法令\n`);

  let success = 0;
  let errors = 0;

  for (const law of TARGET_LAWS) {
    const outFile = `${OUTPUT_DIR}/${law.name.replace(/[\/\\]/g, "_")}.json`;

    if (existsSync(outFile)) {
      console.log(`  ⏭ ${law.name} — スキップ（取得済み）`);
      success++;
      continue;
    }

    try {
      console.log(`  📜 ${law.name} (${law.lawNum})`);

      const xml = await fetchLaw(law.lawNum);
      const articles = extractArticles(xml);
      const fullText = extractTextFromXml(xml);

      const result = {
        name: law.name,
        lawNum: law.lawNum,
        exams: law.exams,
        articleCount: articles.length,
        articles,
        fullText: fullText.slice(0, 500000), // 500KB上限
        fetchedAt: new Date().toISOString(),
      };

      writeFileSync(outFile, JSON.stringify(result, null, 2));
      console.log(`    → ${articles.length}条 取得完了`);
      success++;

      // サーバー負荷軽減
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  ❌ ${law.name}: ${err}`);
      errors++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n========================================`);
  console.log(`⚖️ 法令取得完了`);
  console.log(`  成功: ${success}`);
  console.log(`  エラー: ${errors}`);
  console.log(`  合計: ${TARGET_LAWS.length}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
