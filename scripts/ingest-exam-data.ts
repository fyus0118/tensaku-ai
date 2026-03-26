/**
 * 過去問・条文・知識データの取り込みスクリプト
 *
 * 使い方:
 *   VOYAGE_API_KEY=xxx SUPABASE_SERVICE_ROLE_KEY=xxx bun run scripts/ingest-exam-data.ts
 *
 * データソース:
 *   1. scripts/data/<exam_id>/ ディレクトリ内のテキストファイル
 *   2. ファイル名規則: <subject>_<topic>.txt
 *   3. 例: scripts/data/yobi-shihou/kenpo_jinken.txt
 */

import { ingestDocuments, chunkText, type DocumentChunk } from "../src/lib/rag/embeddings";
import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";

const DATA_DIR = join(new URL(".", import.meta.url).pathname, "data");

async function main() {
  console.log("=== TENSAKU 過去問取り込みパイプライン ===\n");

  // 環境変数チェック
  if (!process.env.VOYAGE_API_KEY) {
    console.error("VOYAGE_API_KEY が設定されていません");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("NEXT_PUBLIC_SUPABASE_URL が設定されていません");
    process.exit(1);
  }

  let examDirs: string[];
  try {
    examDirs = await readdir(DATA_DIR);
  } catch {
    console.log(`${DATA_DIR} が存在しません。サンプルデータを作成します...\n`);
    await createSampleData();
    examDirs = await readdir(DATA_DIR);
  }

  const allChunks: DocumentChunk[] = [];

  for (const examDir of examDirs) {
    const examPath = join(DATA_DIR, examDir);
    const files = await readdir(examPath);

    console.log(`\n📁 ${examDir}: ${files.length} ファイル`);

    for (const file of files) {
      if (!file.endsWith(".txt")) continue;

      const filePath = join(examPath, file);
      const content = await readFile(filePath, "utf-8");
      const name = basename(file, ".txt");
      const [subject, topic] = name.split("_");

      // チャンク化
      const chunks = chunkText(content, 800, 150);

      console.log(`  📄 ${file}: ${chunks.length} チャンク`);

      for (const chunk of chunks) {
        allChunks.push({
          examId: examDir,
          subject: subject || "general",
          topic: topic || "",
          content: chunk,
          metadata: {
            source: file,
            charCount: chunk.length,
          },
        });
      }
    }
  }

  console.log(`\n合計: ${allChunks.length} チャンク`);
  console.log("Embedding + Supabase保存を開始...\n");

  await ingestDocuments(allChunks);

  console.log("\n✅ 取り込み完了！");
}

async function createSampleData() {
  const { mkdir, writeFile } = await import("fs/promises");

  // 予備試験サンプルデータ
  const sampleDir = join(DATA_DIR, "yobi-shihou");
  await mkdir(sampleDir, { recursive: true });

  await writeFile(
    join(sampleDir, "kenpo_jinken.txt"),
    `## 憲法 人権分野 重要論点

### 表現の自由（21条1項）

表現の自由は、民主主義の根幹をなす精神的自由権であり、「優越的地位」が認められる。

#### 違憲審査基準の体系
1. 厳格審査基準（strict scrutiny）
   - やむにやまれぬ政府利益（compelling governmental interest）
   - 必要最小限度の規制手段
   - 適用場面：表現内容規制、事前抑制

2. 厳格な合理性の基準（intermediate scrutiny）
   - 重要な政府利益
   - 利益と実質的関連性のある手段
   - 適用場面：表現内容中立規制

3. 合理性の基準（rational basis review）
   - 正当な政府目的
   - 目的と合理的関連性のある手段
   - 適用場面：経済的自由権の規制

#### 頻出判例
- 北方ジャーナル事件（最大判昭61.6.11）：事前差止めの合憲性。「表現内容が真実でないか又はもっぱら公益を図る目的でない場合」
- 泉佐野市民会館事件（最判平7.3.7）：集会の自由。「明らかな差し迫った危険の発生が具体的に予見される場合」
- よど号ハイジャック記事事件（最大判昭58.6.22）：知る権利。在監者の新聞閲読の自由

### 法の下の平等（14条1項）

#### 判断枠組み
1. 別異取扱いの有無
2. 合理的区別か不合理な差別か
   - 事柄の性質に応じた合理的な根拠の有無（最大判昭39.5.27 待命処分事件）

#### 重要判例
- 尊属殺重罰規定違憲判決（最大判昭48.4.4）：刑法200条は14条1項に違反
- 非嫡出子相続分規定違憲決定（最大決平25.9.4）：民法900条4号但書前段は14条1項に違反
- 再婚禁止期間違憲判決（最大判平27.12.16）：100日超部分は14条1項・24条2項に違反

### 試験対策ポイント
- 予備試験論文では、違憲審査基準の選択理由を論じることが最重要
- 「規制目的」と「規制手段」を分けて論じる
- 判例の射程（どこまで適用できるか）を意識する
`
  );

  await writeFile(
    join(sampleDir, "minpo_souzetsu.txt"),
    `## 民法 総則 重要論点

### 意思表示の瑕疵

#### 心裡留保（93条）
- 表意者が真意でないことを知りながらした意思表示
- 原則：有効（93条1項本文）
- 例外：相手方が悪意又は有過失の場合は無効（93条1項但書）
- 第三者保護：善意の第三者に対抗不可（93条2項）

#### 虚偽表示（94条）
- 相手方と通じてした虚偽の意思表示
- 効果：無効（94条1項）
- 第三者保護：善意の第三者に対抗不可（94条2項）
  - 「第三者」の範囲：虚偽表示に基づいて新たに独立した法律上の利害関係を有するに至った者
  - 善意＝虚偽であることを知らないこと。無過失は不要（判例）
  - 転得者も保護（絶対的構成・相対的構成の対立）

#### 94条2項の類推適用（超頻出）
- 外観法理の一般原則として広く類推適用
- 3要件：①虚偽の外観、②帰責性、③第三者の信頼
- 不動産登記の場面で頻出

#### 錯誤（95条）
1. 意思表示に対応する意思を欠く錯誤（表示の錯誤）
2. 表意者が法律行為の基礎とした事情についてのその認識が真実に反する錯誤（動機の錯誤）
   - 動機が法律行為の基礎とされていることが表示されていた場合に限り取消可能

### 代理

#### 無権代理と表見代理
- 無権代理の効果：本人に効果不帰属（113条）
- 表見代理の3類型：
  1. 代理権授与の表示（109条）
  2. 権限外の行為（110条）
  3. 代理権消滅後（112条）
- 109条と110条の重畳適用（最判昭45.7.28）

#### 試験での論じ方
1. 代理権の有無を検討
2. 無権代理の場合→表見代理の成否を検討
3. 正当理由（善意無過失）の判断
`
  );

  // 中小企業診断士サンプル
  const shindanDir = join(DATA_DIR, "shindan-shi");
  await mkdir(shindanDir, { recursive: true });

  await writeFile(
    join(shindanDir, "kigyou_keieisennryaku.txt"),
    `## 企業経営理論 経営戦略 重要論点

### ポーターの競争戦略

#### 5フォース分析（Five Forces）
1. 既存競合間の敵対関係
2. 新規参入の脅威
3. 代替品の脅威
4. 買い手の交渉力
5. 売り手の交渉力

#### 3つの基本戦略
1. コストリーダーシップ戦略：規模の経済・経験曲線効果
2. 差別化戦略：品質・ブランド・技術で差別化
3. 集中戦略：特定セグメントに経営資源を集中

#### バリューチェーン分析
- 主活動：購買物流→製造→出荷物流→販売・マーケティング→サービス
- 支援活動：全般管理、人事・労務管理、技術開発、調達

### アンゾフの成長マトリクス
|              | 既存製品     | 新製品       |
|-------------|------------|------------|
| 既存市場     | 市場浸透戦略  | 製品開発戦略  |
| 新市場       | 市場開拓戦略  | 多角化戦略   |

### PPM（プロダクト・ポートフォリオ・マネジメント）
- 花形（Star）：高成長・高シェア → 投資継続
- 金のなる木（Cash Cow）：低成長・高シェア → 収穫
- 問題児（Question Mark）：高成長・低シェア → 投資判断
- 負け犬（Dog）：低成長・低シェア → 撤退検討

### 試験対策ポイント
- 2次試験ではSWOT分析→戦略提言の流れが定番
- 環境分析（外部＝機会・脅威、内部＝強み・弱み）を丁寧に
- 助言は具体的に「誰が・何を・どうやって」
`
  );

  console.log("サンプルデータを作成しました: scripts/data/");
}

main().catch(console.error);
