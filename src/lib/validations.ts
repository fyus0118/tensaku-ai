import { z } from "zod/v4";

// ── Chat ──────────────────────────────────────
export const chatPostSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(10000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(50000),
      })
    )
    .max(50)
    .optional(),
});

// ── Practice POST ─────────────────────────────
export const practicePostSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  questionType: z.enum(["multiple_choice", "essay"]).optional(),
});

// ── Practice PUT ──────────────────────────────
export const practicePutSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  question: z.string().min(1).max(10000),
  questionType: z.enum(["multiple_choice", "essay"]),
  userAnswer: z.string().max(10000),
  correctAnswer: z.string().max(10000),
  isCorrect: z.boolean(),
  explanation: z.string().max(20000).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
});

// ── Teach ────────────────────────────────────
export const teachPostSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  message: z.string().min(1).max(10000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(50000),
      })
    )
    .max(50)
    .optional(),
});

// ── Review ────────────────────────────────────
export const reviewPostSchema = z.object({
  reviewType: z.enum(["essay", "report"]),
  content: z.string().min(1).max(50000),
  documentType: z.string().max(100).optional(),
  targetUniversity: z.string().max(200).optional(),
  targetDepartment: z.string().max(200).optional(),
  examType: z.string().max(100).optional(),
  theme: z.string().max(500).optional(),
  wordLimit: z.union([z.string().max(10), z.number().int().min(1).max(100000)]).optional(),
  grade: z.string().max(50).optional(),
  citationStyle: z.string().max(50).optional(),
});

// ── Flashcards POST ───────────────────────────
export const flashcardsPostSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  count: z.number().int().min(1).max(20).optional(),
});

// ── Flashcards PUT ────────────────────────────
export const flashcardsPutSchema = z.object({
  cardId: z.string().min(1).max(100),
  quality: z.number().int().min(0).max(5),
});

// ── Materials POST ───────────────────────────
export const materialsPostSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  content: z.string().min(10).max(100000),
});

// ── Materials PATCH ──────────────────────────
export const materialsPatchSchema = z.object({
  examId: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  content: z.string().min(10).max(100000),
});

// ── Materials DELETE ─────────────────────────
export const materialsDeleteSchema = z.object({
  id: z.string().min(1).max(300).optional(),
  title: z.string().min(1).max(200).optional(),
  examId: z.string().min(1).max(100).optional(),
});

// ── Helper ────────────────────────────────────
export function parseBody<T>(schema: z.ZodType<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
  return { success: false, error: `入力が不正です: ${messages}` };
}
