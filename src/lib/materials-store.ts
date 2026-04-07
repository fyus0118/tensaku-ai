import "server-only";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { chunkText, embedTexts } from "@/lib/rag/embeddings";
import {
  buildMaterialExcerpt,
  estimateReadMinutes,
  extractMaterialSections,
  type MaterialDetail,
  type MaterialSummary,
  normalizeMaterialContent,
} from "@/lib/materials";

const LEGACY_PREFIX = "legacy_";

type SupabaseLike = any;

type MaterialRow = {
  id: string;
  exam_id: string;
  subject: string;
  topic: string | null;
  title: string;
  raw_content: string;
  normalized_content: string | null;
  char_count: number | null;
  chunk_count: number | null;
  status: "processing" | "ready" | "failed" | null;
  created_at: string;
  updated_at: string;
};

type UserDocumentRow = {
  id: string;
  exam_id: string;
  subject: string;
  topic: string | null;
  title: string;
  content: string;
  chunk_index: number | null;
  total_chunks: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type LegacyMaterialRef = {
  examId: string;
  subject: string;
  topic: string | null;
  title: string;
  createdAt: string;
};

type UpsertMaterialInput = {
  userId: string;
  examId: string;
  subject: string;
  topic?: string | null;
  title?: string | null;
  content: string;
};

function createAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isMissingMaterialsRelation(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: string }).message)
      : String(error ?? "");

  return (
    message.includes("user_materials") ||
    message.includes("material_id") ||
    message.includes("Could not find the table") ||
    message.includes("schema cache")
  );
}

function encodeLegacyMaterialId(ref: LegacyMaterialRef): string {
  return `${LEGACY_PREFIX}${Buffer.from(JSON.stringify(ref)).toString("base64url")}`;
}

export function decodeLegacyMaterialId(id: string): LegacyMaterialRef | null {
  if (!id.startsWith(LEGACY_PREFIX)) return null;

  try {
    const decoded = Buffer.from(id.slice(LEGACY_PREFIX.length), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as LegacyMaterialRef;
    if (!parsed.examId || !parsed.subject || !parsed.title || !parsed.createdAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildSummary(params: {
  id: string;
  examId: string;
  subject: string;
  topic: string | null;
  title: string;
  content: string;
  totalChunks: number;
  createdAt: string;
  updatedAt?: string;
  status?: "processing" | "ready" | "failed";
  isLegacy?: boolean;
}): MaterialSummary {
  const normalized = normalizeMaterialContent(params.content);
  return {
    id: params.id,
    examId: params.examId,
    title: params.title,
    subject: params.subject,
    topic: params.topic,
    totalChunks: params.totalChunks,
    totalChars: normalized.length,
    excerpt: buildMaterialExcerpt(normalized),
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    readMinutes: estimateReadMinutes(normalized.length),
    status: params.status ?? "ready",
    isLegacy: params.isLegacy,
  };
}

function buildDetail(summary: MaterialSummary, content: string): MaterialDetail {
  const normalized = normalizeMaterialContent(content);
  return {
    ...summary,
    totalChars: normalized.length,
    excerpt: buildMaterialExcerpt(normalized),
    readMinutes: estimateReadMinutes(normalized.length),
    content: normalized,
    sections: extractMaterialSections(normalized),
  };
}

async function fetchLegacyRows(
  supabase: SupabaseLike,
  userId: string,
  ref: LegacyMaterialRef
): Promise<UserDocumentRow[]> {
  const { data, error } = await supabase
    .from("user_documents")
    .select("id, exam_id, subject, topic, title, content, chunk_index, total_chunks, created_at, metadata")
    .eq("user_id", userId)
    .eq("exam_id", ref.examId)
    .eq("subject", ref.subject)
    .eq("title", ref.title)
    .eq("created_at", ref.createdAt)
    .order("chunk_index", { ascending: true });

  if (error) throw error;
  return (data || []) as UserDocumentRow[];
}

function groupLegacyDocuments(rows: UserDocumentRow[]): MaterialSummary[] {
  const grouped = new Map<string, UserDocumentRow[]>();

  for (const row of rows) {
    const key = [
      row.exam_id,
      row.subject,
      row.topic ?? "",
      row.title,
      row.created_at,
    ].join("__");
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const sorted = [...group].sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));
      const first = sorted[0];
      const content = sorted.map((row) => row.content).join("\n\n");
      return buildSummary({
        id: encodeLegacyMaterialId({
          examId: first.exam_id,
          subject: first.subject,
          topic: first.topic,
          title: first.title,
          createdAt: first.created_at,
        }),
        examId: first.exam_id,
        subject: first.subject,
        topic: first.topic,
        title: first.title,
        content,
        totalChunks: sorted.length,
        createdAt: first.created_at,
        updatedAt: first.created_at,
        isLegacy: true,
      });
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function listMaterialsForUser(
  supabase: SupabaseLike,
  userId: string,
  examId: string
): Promise<MaterialSummary[]> {
  try {
    const { data, error } = await supabase
      .from("user_materials")
      .select("id, exam_id, subject, topic, title, normalized_content, char_count, chunk_count, status, created_at, updated_at")
      .eq("user_id", userId)
      .eq("exam_id", examId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return ((data || []) as Partial<MaterialRow>[]).map((row) =>
      buildSummary({
        id: row.id || "",
        examId: row.exam_id || examId,
        subject: row.subject || "",
        topic: row.topic ?? null,
        title: row.title || "無題の教材",
        content: row.normalized_content || "",
        totalChunks: row.chunk_count || 0,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        status: row.status || "ready",
      })
    );
  } catch (error) {
    if (!isMissingMaterialsRelation(error)) {
      throw error;
    }

    const { data, error: legacyError } = await supabase
      .from("user_documents")
      .select("id, exam_id, subject, topic, title, content, chunk_index, total_chunks, created_at, metadata")
      .eq("user_id", userId)
      .eq("exam_id", examId)
      .order("created_at", { ascending: false });

    if (legacyError) throw legacyError;
    return groupLegacyDocuments((data || []) as UserDocumentRow[]);
  }
}

export async function getMaterialDetailForUser(
  supabase: SupabaseLike,
  userId: string,
  materialId: string
): Promise<MaterialDetail | null> {
  const legacyRef = decodeLegacyMaterialId(materialId);
  if (legacyRef) {
    const rows = await fetchLegacyRows(supabase, userId, legacyRef);
    if (rows.length === 0) return null;
    const summary = groupLegacyDocuments(rows)[0];
    const content = rows.map((row) => row.content).join("\n\n");
    return buildDetail(summary, content);
  }

  try {
    const { data, error } = await supabase
      .from("user_materials")
      .select("id, exam_id, subject, topic, title, raw_content, normalized_content, char_count, chunk_count, status, created_at, updated_at")
      .eq("user_id", userId)
      .eq("id", materialId)
      .single();

    if (error) throw error;
    const row = data as MaterialRow;
    const content = row.normalized_content || row.raw_content || "";
    const summary = buildSummary({
      id: row.id,
      examId: row.exam_id,
      subject: row.subject,
      topic: row.topic,
      title: row.title,
      content,
      totalChunks: row.chunk_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status || "ready",
    });
    return buildDetail(summary, content);
  } catch (error) {
    if (!isMissingMaterialsRelation(error)) {
      return null;
    }
    return null;
  }
}

async function insertMaterialChunks(params: {
  admin: SupabaseLike;
  userId: string;
  examId: string;
  subject: string;
  topic: string | null;
  title: string;
  normalizedContent: string;
  materialId?: string;
}) {
  const chunks = chunkText(params.normalizedContent, 1000, 200);
  if (chunks.length === 0) {
    throw new Error("テキストが短すぎます");
  }
  if (chunks.length > 200) {
    throw new Error("テキストが長すぎます。20万文字以内にしてください。");
  }

  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((chunk, index) => ({
    user_id: params.userId,
    exam_id: params.examId,
    subject: params.subject,
    topic: params.topic,
    title: params.title,
    content: chunk,
    embedding: JSON.stringify(embeddings[index]),
    chunk_index: index,
    total_chunks: chunks.length,
    material_id: params.materialId ?? null,
    metadata: {
      source: "user_material",
      materialId: params.materialId ?? null,
      title: params.title,
      chunkIndex: index,
      totalChunks: chunks.length,
    },
  }));

  const { error } = await params.admin.from("user_documents").insert(rows);
  if (error) throw error;

  return {
    chunks: chunks.length,
    charCount: params.normalizedContent.length,
  };
}

export async function createMaterialForUser(
  supabase: SupabaseLike,
  input: UpsertMaterialInput
): Promise<MaterialDetail> {
  const admin = createAdminClient();
  const normalizedContent = normalizeMaterialContent(input.content);
  const materialTitle =
    input.title?.trim() || `${input.subject}${input.topic ? ` > ${input.topic}` : ""} の教材`;

  let materialId: string | undefined;
  let createdAt = new Date().toISOString();
  let updatedAt = createdAt;
  let usedLegacyFallback = false;

  try {
    const { data, error } = await admin
      .from("user_materials")
      .insert({
        user_id: input.userId,
        exam_id: input.examId,
        subject: input.subject,
        topic: input.topic ?? null,
        title: materialTitle,
        raw_content: input.content,
        normalized_content: normalizedContent,
        char_count: normalizedContent.length,
        chunk_count: 0,
        status: "processing",
      })
      .select("id, created_at, updated_at")
      .single();

    if (error) throw error;
    materialId = data.id as string;
    createdAt = data.created_at as string;
    updatedAt = data.updated_at as string;
  } catch (error) {
    if (!isMissingMaterialsRelation(error)) {
      throw error;
    }
    usedLegacyFallback = true;
  }

  try {
    const { chunks, charCount } = await insertMaterialChunks({
      admin,
      userId: input.userId,
      examId: input.examId,
      subject: input.subject,
      topic: input.topic ?? null,
      title: materialTitle,
      normalizedContent,
      materialId,
    });

    if (materialId) {
      const { data, error } = await admin
        .from("user_materials")
        .update({
          raw_content: input.content,
          normalized_content: normalizedContent,
          char_count: charCount,
          chunk_count: chunks,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", materialId)
        .select("updated_at")
        .single();

      if (error) throw error;
      updatedAt = (data.updated_at as string) || updatedAt;
    }

    const summary = buildSummary({
      id:
        materialId ||
        encodeLegacyMaterialId({
          examId: input.examId,
          subject: input.subject,
          topic: input.topic ?? null,
          title: materialTitle,
          createdAt,
        }),
      examId: input.examId,
      subject: input.subject,
      topic: input.topic ?? null,
      title: materialTitle,
      content: normalizedContent,
      totalChunks: chunks,
      createdAt,
      updatedAt,
      status: "ready",
      isLegacy: usedLegacyFallback,
    });

    return buildDetail(summary, normalizedContent);
  } catch (error) {
    if (materialId) {
      await admin
        .from("user_materials")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", materialId);
    }
    throw error;
  }
}

export async function updateMaterialForUser(
  supabase: SupabaseLike,
  userId: string,
  materialId: string,
  input: UpsertMaterialInput
): Promise<MaterialDetail | null> {
  const legacyRef = decodeLegacyMaterialId(materialId);
  if (legacyRef) {
    await deleteMaterialForUser(supabase, userId, materialId);
    return createMaterialForUser(supabase, { ...input, userId });
  }

  const admin = createAdminClient();
  const normalizedContent = normalizeMaterialContent(input.content);
  const materialTitle =
    input.title?.trim() || `${input.subject}${input.topic ? ` > ${input.topic}` : ""} の教材`;

  const { data: material, error } = await admin
    .from("user_materials")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("id", materialId)
    .single();

  if (error || !material) {
    return null;
  }

  await admin
    .from("user_materials")
    .update({
      subject: input.subject,
      topic: input.topic ?? null,
      title: materialTitle,
      raw_content: input.content,
      normalized_content: normalizedContent,
      char_count: normalizedContent.length,
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", materialId);

  const { error: deleteChunksError } = await admin
    .from("user_documents")
    .delete()
    .eq("user_id", userId)
    .eq("material_id", materialId);
  if (deleteChunksError && !isMissingMaterialsRelation(deleteChunksError)) {
    throw deleteChunksError;
  }

  try {
    const { chunks, charCount } = await insertMaterialChunks({
      admin,
      userId,
      examId: input.examId,
      subject: input.subject,
      topic: input.topic ?? null,
      title: materialTitle,
      normalizedContent,
      materialId,
    });

    await admin
      .from("user_materials")
      .update({
        raw_content: input.content,
        normalized_content: normalizedContent,
        char_count: charCount,
        chunk_count: chunks,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", materialId);

    return getMaterialDetailForUser(supabase, userId, materialId);
  } catch (updateError) {
    await admin
      .from("user_materials")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", materialId);
    throw updateError;
  }
}

export async function deleteMaterialForUser(
  supabase: SupabaseLike,
  userId: string,
  materialId: string
): Promise<boolean> {
  const legacyRef = decodeLegacyMaterialId(materialId);
  if (legacyRef) {
    const { error } = await supabase
      .from("user_documents")
      .delete()
      .eq("user_id", userId)
      .eq("exam_id", legacyRef.examId)
      .eq("subject", legacyRef.subject)
      .eq("title", legacyRef.title)
      .eq("created_at", legacyRef.createdAt);
    if (error) throw error;
    return true;
  }

  const admin = createAdminClient();
  const { data: material, error: fetchError } = await admin
    .from("user_materials")
    .select("id")
    .eq("user_id", userId)
    .eq("id", materialId)
    .single();

  if (fetchError || !material) {
    return false;
  }

  await admin.from("user_documents").delete().eq("user_id", userId).eq("material_id", materialId);
  const { error } = await admin.from("user_materials").delete().eq("id", materialId).eq("user_id", userId);
  if (error) throw error;
  return true;
}
