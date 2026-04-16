/**
 * 教材イラストのアップロード
 *
 * 使い方:
 *   bun run scripts/upload-illustration.ts <画像パス> --exam takken --subject 権利関係 --topic "意思表示" [--caption "心裡留保の関係図"] [--position after_heading]
 *   bun run scripts/upload-illustration.ts ./images/*.png --exam takken --subject 権利関係 --topic "意思表示"
 *
 * 画像はSupabase Storageにアップロードされ、material_illustrationsテーブルに登録される
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { basename, extname } from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "illustrations";

function parseArgs() {
  const args = process.argv.slice(2);
  const files: string[] = [];
  let examId = "", subject = "", topic = "", caption = "", position = "after_heading";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--exam") examId = args[++i];
    else if (args[i] === "--subject") subject = args[++i];
    else if (args[i] === "--topic") topic = args[++i];
    else if (args[i] === "--caption") caption = args[++i];
    else if (args[i] === "--position") position = args[++i];
    else files.push(args[i]);
  }

  if (!examId || !subject || !topic || files.length === 0) {
    console.error("Usage: bun run scripts/upload-illustration.ts <file> --exam <id> --subject <name> --topic <name> [--caption <text>] [--position before_content|after_heading|after_content]");
    process.exit(1);
  }

  return { files, examId, subject, topic, caption, position };
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

async function upload(filePath: string, examId: string, subject: string, topic: string, caption: string, position: string, sortOrder: number) {
  if (!existsSync(filePath)) {
    console.error(`  ❌ File not found: ${filePath}`);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const fileName = `${examId}/${Date.now()}-${basename(filePath)}`;

  const fileData = readFileSync(filePath);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileData, { contentType, upsert: true });

  if (uploadError) {
    console.error(`  ❌ Upload failed: ${uploadError.message}`);
    return;
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  const { error: dbError } = await supabase.from("material_illustrations").insert({
    exam_id: examId,
    subject,
    topic,
    image_url: publicUrl,
    caption: caption || null,
    position,
    sort_order: sortOrder,
  });

  if (dbError) {
    console.error(`  ❌ DB insert failed: ${dbError.message}`);
    return;
  }

  console.log(`  ✅ ${basename(filePath)} → ${publicUrl}`);
}

async function main() {
  const { files, examId, subject, topic, caption, position } = parseArgs();

  console.log(`\nアップロード: ${files.length}ファイル`);
  console.log(`  試験: ${examId} / 科目: ${subject} / トピック: ${topic}`);
  console.log(`  位置: ${position}\n`);

  for (let i = 0; i < files.length; i++) {
    await upload(files[i], examId, subject, topic, caption, position, i);
  }

  console.log("\n完了");
}

main();
