/**
 * LLMルーティング — 機能ごとにモデルを使い分ける
 *
 * Teach / Core / Socratic: Gemini 2.5 Pro
 * Mentor / Practice / CaseStudy / Flashcards: Gemini 2.5 Flash
 *
 * フォールバック: Flash 503 → Flash再試行 → Haiku → Pro(thinking制限)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return _genAI;
}

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _anthropic;
}

export type LLMRole = "teach" | "core" | "socratic" | "mentor" | "practice" | "case-study" | "flashcards";

const MODEL_MAP: Record<LLMRole, { provider: "gemini"; model: string }> = {
  teach:        { provider: "gemini", model: "gemini-2.5-pro" },
  core:         { provider: "gemini", model: "gemini-2.5-pro" },
  socratic:     { provider: "gemini", model: "gemini-2.5-pro" },
  mentor:       { provider: "gemini", model: "gemini-2.5-flash" },
  practice:     { provider: "gemini", model: "gemini-2.5-flash" },
  "case-study": { provider: "gemini", model: "gemini-2.5-flash" },
  flashcards:   { provider: "gemini", model: "gemini-2.5-flash" },
};

export function getModelConfig(role: LLMRole) {
  return MODEL_MAP[role];
}

function adjustMaxTokens(model: string, maxTokens: number): number {
  return model.includes("pro") ? maxTokens + 8192 : maxTokens;
}

function is503(err: unknown): boolean {
  return err instanceof Error && (err.message.includes("503") || err.message.includes("overloaded") || err.message.includes("unavailable"));
}

/**
 * Haiku fallback (非ストリーミング)
 */
async function haikuGenerate(system: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].type === "text" ? res.content[0].text : "";
}

/**
 * Haiku fallback (ストリーミング)
 */
async function haikuStream(system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens: number) {
  const stream = await getAnthropic().messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system,
    messages,
  });
  let fullText = "";
  const iterable = (async function* () {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        yield event.delta.text;
      }
    }
  })();
  return { stream: iterable, getText: () => fullText };
}

/**
 * ストリーミング生成
 * Flash → Flash再試行 → Haiku → Pro
 */
export async function geminiStream(params: {
  role: LLMRole;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<{ stream: AsyncIterable<string>; getText: () => string }> {
  const config = MODEL_MAP[params.role];
  const maxTokens = adjustMaxTokens(config.model, params.maxTokens || 4096);
  const model = getGenAI().getGenerativeModel({
    model: config.model,
    systemInstruction: params.system,
    generationConfig: { maxOutputTokens: maxTokens },
  });

  const rawHistory = params.messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));
  const history = rawHistory.length > 0 && rawHistory[0].role === "model"
    ? [{ role: "user" as const, parts: [{ text: "お願いします。" }] }, ...rawHistory]
    : rawHistory;
  const lastMessage = params.messages[params.messages.length - 1];

  // 試行1: 元のモデル
  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);
    let fullText = "";
    const stream = (async function* () {
      for await (const chunk of result.stream) {
        const t = chunk.text();
        if (t) { fullText += t; yield t; }
      }
    })();
    return { stream, getText: () => fullText };
  } catch (err) {
    if (!is503(err)) throw err;
  }

  // 試行2: Flash再試行 (1秒待ち)
  if (config.model.includes("flash")) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessage.content);
      let fullText = "";
      const stream = (async function* () {
        for await (const chunk of result.stream) {
          const t = chunk.text();
          if (t) { fullText += t; yield t; }
        }
      })();
      console.warn(`[geminiStream:${params.role}] Flash 503 → retry succeeded`);
      return { stream, getText: () => fullText };
    } catch (err) {
      if (!is503(err)) throw err;
    }
  }

  // 試行3: Haiku (安い・速い)
  try {
    console.warn(`[geminiStream:${params.role}] → Haiku fallback`);
    return await haikuStream(params.system, params.messages, params.maxTokens || 4096);
  } catch (err) {
    console.warn(`[geminiStream:${params.role}] Haiku failed:`, err instanceof Error ? err.message : err);
  }

  // 試行4: Pro (最後の砦)
  console.warn(`[geminiStream:${params.role}] → Pro fallback`);
  const pro = getGenAI().getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: params.system,
    generationConfig: { maxOutputTokens: adjustMaxTokens("gemini-2.5-pro", params.maxTokens || 4096) },
  });
  const chat = pro.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content);
  let fullText = "";
  const stream = (async function* () {
    for await (const chunk of result.stream) {
      const t = chunk.text();
      if (t) { fullText += t; yield t; }
    }
  })();
  return { stream, getText: () => fullText };
}

/**
 * 非ストリーミング生成
 * Flash → Flash再試行 → Haiku → Pro(thinking制限)
 */
export async function geminiGenerate(params: {
  role: LLMRole;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const config = MODEL_MAP[params.role];
  const maxTokens = adjustMaxTokens(config.model, params.maxTokens || 4096);
  const model = getGenAI().getGenerativeModel({
    model: config.model,
    systemInstruction: params.system,
    generationConfig: { maxOutputTokens: maxTokens },
  });

  // 試行1: 元のモデル
  try {
    const result = await model.generateContent(params.prompt);
    return result.response.text();
  } catch (err) {
    if (!is503(err)) throw err;
  }

  // 試行2: Flash再試行
  if (config.model.includes("flash")) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const result = await model.generateContent(params.prompt);
      console.warn(`[geminiGenerate:${params.role}] Flash 503 → retry succeeded`);
      return result.response.text();
    } catch (err) {
      if (!is503(err)) throw err;
    }
  }

  // 試行3: Haiku
  try {
    console.warn(`[geminiGenerate:${params.role}] → Haiku fallback`);
    return await haikuGenerate(params.system, params.prompt, params.maxTokens || 4096);
  } catch (err) {
    console.warn(`[geminiGenerate:${params.role}] Haiku failed:`, err instanceof Error ? err.message : err);
  }

  // 試行4: Pro (thinking制限)
  console.warn(`[geminiGenerate:${params.role}] → Pro fallback (thinking limited)`);
  const pro = getGenAI().getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: params.system,
    generationConfig: {
      maxOutputTokens: adjustMaxTokens("gemini-2.5-pro", params.maxTokens || 4096),
      // @ts-ignore
      thinkingConfig: { thinkingBudget: 1024 },
    },
  });
  const result = await pro.generateContent(params.prompt);
  return result.response.text();
}
