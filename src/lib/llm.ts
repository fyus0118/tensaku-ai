/**
 * LLMルーティング — 機能ごとにモデルを使い分ける
 *
 * Teach / Core: Claude Sonnet (隠しタグ精度・人格プロンプト)
 * Socratic: Gemini Pro (推論力十分・コスト2/3)
 * Mentor / Practice / CaseStudy / Flashcards: Gemini Flash (コスト最優先)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return _genAI;
}

export type LLMRole = "teach" | "core" | "socratic" | "mentor" | "practice" | "case-study" | "flashcards";

const MODEL_MAP: Record<LLMRole, { provider: "anthropic" | "gemini"; model: string }> = {
  teach:        { provider: "gemini",   model: "gemini-2.5-pro" },
  core:         { provider: "gemini",   model: "gemini-2.5-pro" },
  socratic:     { provider: "gemini",   model: "gemini-2.5-pro" },
  mentor:       { provider: "gemini",   model: "gemini-2.5-flash" },
  practice:     { provider: "gemini",   model: "gemini-2.5-flash" },
  "case-study": { provider: "gemini",   model: "gemini-2.5-flash" },
  flashcards:   { provider: "gemini",   model: "gemini-2.5-flash" },
};

export function getModelConfig(role: LLMRole) {
  return MODEL_MAP[role];
}

/**
 * Geminiでストリーミング生成 — Anthropicのstream互換のイベント形式で返す
 */
export async function geminiStream(params: {
  role: LLMRole;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<{ stream: AsyncIterable<string>; getText: () => string }> {
  const config = MODEL_MAP[params.role];
  const model = getGenAI().getGenerativeModel({
    model: config.model,
    systemInstruction: params.system,
    generationConfig: { maxOutputTokens: params.maxTokens || 4096 },
  });

  // Gemini uses "user" and "model" roles, and requires first message to be "user"
  const rawHistory = params.messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  // Gemini requires first message to be "user" — prepend dummy if needed
  const history = rawHistory.length > 0 && rawHistory[0].role === "model"
    ? [{ role: "user" as const, parts: [{ text: "お願いします。" }] }, ...rawHistory]
    : rawHistory;

  const lastMessage = params.messages[params.messages.length - 1];

  let chat = model.startChat({ history });
  let result;
  try {
    result = await chat.sendMessageStream(lastMessage.content);
  } catch (err) {
    const is503 = err instanceof Error && err.message.includes("503");
    if (is503 && config.model.includes("flash")) {
      console.warn(`[geminiStream:${params.role}] Flash 503 → Pro fallback`);
      const fallback = getGenAI().getGenerativeModel({
        model: "gemini-2.5-pro",
        systemInstruction: params.system,
        generationConfig: { maxOutputTokens: params.maxTokens || 4096 },
      });
      chat = fallback.startChat({ history });
      result = await chat.sendMessageStream(lastMessage.content);
    } else {
      throw err;
    }
  }

  let fullText = "";

  const stream = (async function* () {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        yield text;
      }
    }
  })();

  return { stream, getText: () => fullText };
}

/**
 * Geminiで非ストリーミング生成
 */
export async function geminiGenerate(params: {
  role: LLMRole;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const config = MODEL_MAP[params.role];
  const model = getGenAI().getGenerativeModel({
    model: config.model,
    systemInstruction: params.system,
    generationConfig: { maxOutputTokens: params.maxTokens || 4096 },
  });

  try {
    const result = await model.generateContent(params.prompt);
    return result.response.text();
  } catch (err) {
    // 503: Flash→Proにフォールバック
    const is503 = err instanceof Error && err.message.includes("503");
    if (is503 && config.model.includes("flash")) {
      console.warn(`[geminiGenerate:${params.role}] Flash 503 → Pro fallback`);
      const fallback = getGenAI().getGenerativeModel({
        model: "gemini-2.5-pro",
        systemInstruction: params.system,
        generationConfig: { maxOutputTokens: params.maxTokens || 4096 },
      });
      const result = await fallback.generateContent(params.prompt);
      return result.response.text();
    }
    console.error(`[geminiGenerate:${params.role}] error:`, err instanceof Error ? err.message : err);
    throw err;
  }
}
