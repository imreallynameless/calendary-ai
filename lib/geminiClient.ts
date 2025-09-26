import { GoogleGenAI } from "@google/genai";

const requiredEnvVars = ["GEMINI_API_KEY", "GEMINI_MODEL"];

function assertEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Gemini configuration: ${missing.join(", ")}`);
  }
}

export function isGeminiEnabled() {
  return process.env.GEMINI_FEATURE_ENABLED === "true";
}

const clientSingleton = (() => {
  let instance: GoogleGenAI | undefined;
  return () => {
    if (!instance) {
      assertEnv();
      instance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    }
    return instance;
  };
})();

export async function generateGeminiReply(prompt: string) {
  assertEnv();
  const model = process.env.GEMINI_MODEL!;
  const client = clientSingleton();

  console.info("[Gemini] Sending prompt", {
    model,
    promptPreview: prompt.slice(0, 500),
    promptLength: prompt.length,
  });

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    config: {
      temperature: 0.4,
      topP: 0.95,
      thinkingConfig: {
        thinkingBudget: 1,
      },
    },
    generationConfig: {
      responseModalities: ["text"],
    },
  });

  const text = response.text?.trim()
    ?? response.output?.map((item) => item.content?.parts?.map((part) => part.text ?? "").join("\n")).join("\n")
    ?? response.response?.candidates?.map((candidate) => candidate.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "").join("\n");

  console.info("[Gemini] Received response", {
    model,
    hasText: Boolean(text && text.trim().length > 0),
    responsePreview: text ? text.slice(0, 300) : undefined,
  });

  return text?.trim();
}
