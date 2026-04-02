/**
 * Core Knowledge テーブル v2 マイグレーション
 *
 * 既存の core_knowledge テーブルに新カラムを追加し、
 * match_core_knowledge RPC関数を作成する。
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const migrations = [
  // 1. core_knowledge に新カラム追加
  {
    name: "core_knowledge: add embedding column",
    sql: `ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1024);`,
  },
  {
    name: "core_knowledge: add teach_count column",
    sql: `ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS teach_count int DEFAULT 1;`,
  },
  {
    name: "core_knowledge: add last_taught_at column",
    sql: `ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS last_taught_at timestamptz DEFAULT now();`,
  },
  // 2. HNSW インデックス追加
  {
    name: "core_knowledge: HNSW index on embedding",
    sql: `CREATE INDEX IF NOT EXISTS idx_core_knowledge_embedding ON core_knowledge
      USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`,
  },
  // 3. トピック複合インデックス追加
  {
    name: "core_knowledge: topic composite index",
    sql: `CREATE INDEX IF NOT EXISTS idx_core_knowledge_topic ON core_knowledge(user_id, exam_id, subject, topic);`,
  },
  // 4. UPDATE RLSポリシー追加
  {
    name: "core_knowledge: UPDATE RLS policy",
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'core_knowledge' AND policyname = 'Users can update own core knowledge'
      ) THEN
        CREATE POLICY "Users can update own core knowledge"
          ON core_knowledge FOR UPDATE
          USING (auth.uid() = user_id);
      END IF;
    END $$;`,
  },
  // 5. teach_diagnostics に新カラム追加
  {
    name: "teach_diagnostics: add session_summary column",
    sql: `ALTER TABLE teach_diagnostics ADD COLUMN IF NOT EXISTS session_summary jsonb;`,
  },
  {
    name: "teach_diagnostics: add question_level_reached column",
    sql: `ALTER TABLE teach_diagnostics ADD COLUMN IF NOT EXISTS question_level_reached int DEFAULT 1;`,
  },
  // 6. match_core_knowledge RPC関数
  {
    name: "create match_core_knowledge function",
    sql: `CREATE OR REPLACE FUNCTION match_core_knowledge(
      query_embedding vector(1024),
      match_user_id uuid,
      match_exam_id text,
      match_count int DEFAULT 10,
      match_threshold float DEFAULT 0.3
    )
    RETURNS TABLE (
      id uuid,
      subject text,
      topic text,
      content text,
      source text,
      understanding_depth int,
      confidence float,
      connections text[],
      initial_mistake text,
      correction_path text,
      teach_count int,
      similarity float
    )
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        ck.id,
        ck.subject,
        ck.topic,
        ck.content,
        ck.source,
        ck.understanding_depth,
        ck.confidence::float,
        ck.connections,
        ck.initial_mistake,
        ck.correction_path,
        ck.teach_count,
        (1 - (ck.embedding <=> query_embedding))::float AS similarity
      FROM core_knowledge ck
      WHERE ck.user_id = match_user_id
        AND ck.exam_id = match_exam_id
        AND ck.embedding IS NOT NULL
        AND 1 - (ck.embedding <=> query_embedding) > match_threshold
      ORDER BY ck.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $func$;`,
  },
];

async function main() {
  console.log("🔄 Core v2 マイグレーション開始\n");

  for (const migration of migrations) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: migration.sql }).single();
      if (error) {
        // rpc exec_sql がない場合は直接実行を試みる
        throw error;
      }
      console.log(`  ✅ ${migration.name}`);
    } catch {
      // Supabase JS SDK では直接 SQL を実行できないため、REST API を使う
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          body: JSON.stringify({ sql: migration.sql }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        console.log(`  ✅ ${migration.name}`);
      } catch (err2) {
        console.log(`  ⚠️  ${migration.name} — REST APIでも失敗。手動実行が必要:`);
        console.log(`     ${migration.sql.slice(0, 100)}...`);
      }
    }
  }

  console.log("\n✅ マイグレーション完了");
  console.log("\n⚠️  もしRPC経由で実行できない場合は、Supabase Dashboard > SQL Editor で以下を実行してください:");
  console.log("   ファイル: supabase_core.sql の差分部分\n");
}

main().catch(console.error);
