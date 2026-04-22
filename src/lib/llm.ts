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
  teach:        { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  core:         { provider: "anthropic", model: "claude-sonnet-4-20250514" },
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

  // Gemini uses "user" and "model" roles
  const history = params.messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const lastMessage = params.messages[params.messages.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content);

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

  const result = await model.generateContent(params.prompt);
  return result.response.text();
}
