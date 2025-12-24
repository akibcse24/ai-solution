
import { GoogleGenAI, Type } from "@google/genai";
import { ExamAnalysis, ExamQuestion } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const LOCAL_GEMINI_KEY_STORAGE = 'gemini_api_key_local';
const LOCAL_OPENROUTER_KEY_STORAGE = 'openrouter_api_key_local';

type ModelProvider = 'gemini' | 'openrouter';

const getAllKeys = (keyString: string | undefined): string[] => {
  if (!keyString) return [];
  return keyString.split(/[,\n]/).map(k => k.trim()).filter(k => k.length > 0);
};

const getGeminiKeys = () => {
  let keyString: string | undefined;
  if (typeof window !== 'undefined') {
    keyString = localStorage.getItem(LOCAL_GEMINI_KEY_STORAGE) || undefined;
  }
  if (!keyString) {
    const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
    const nodeKey = typeof process !== 'undefined'
      ? (process as any).env?.API_KEY || (process as any).env?.GEMINI_API_KEY
      : undefined;
    keyString = viteKey || nodeKey;
  }
  return getAllKeys(keyString);
};

const getOpenRouterKeys = () => {
  let keyString: string | undefined;
  if (typeof window !== 'undefined') {
    keyString = localStorage.getItem(LOCAL_OPENROUTER_KEY_STORAGE) || undefined;
  }
  if (!keyString) {
    keyString = import.meta.env.VITE_OPENROUTER_API_KEY;
  }
  return getAllKeys(keyString);
};

const getGeminiApiKey = () => {
  const keys = getGeminiKeys();
  return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : undefined;
};

const getOpenRouterApiKey = () => {
  const keys = getOpenRouterKeys();
  return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : undefined;
};

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

async function withProviderRetry<T>(
  provider: ModelProvider,
  fn: (apiKey: string) => Promise<T>,
  maxRetriesPerKey = 1 // Reduced to 1 retry per key for speed
): Promise<T> {
  const keys = provider === 'gemini' ? getGeminiKeys() : getOpenRouterKeys();
  if (keys.length === 0) {
    throw new Error(`No API keys available for provider: ${provider}`);
  }

  const shuffledKeys = shuffleArray(keys);
  let lastError: any;

  for (const apiKey of shuffledKeys) {
    for (let i = 0; i < maxRetriesPerKey; i++) {
      try {
        return await fn(apiKey);
      } catch (error: any) {
        lastError = error;
        const isQuotaError = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');

        // SPEED OPTIMIZATION: If we have multiple keys and one fails, move to the next key IMMEDIATELY
        if (isQuotaError && shuffledKeys.length > 1) {
          // Break the inner retry loop for this key and move to next key in outer loop
          break;
        }

        // If it's the only key or not a quota error, use a very small delay if we still have retries left
        if (isQuotaError && i < maxRetriesPerKey - 1) {
          await delay(500); // Small 500ms delay instead of 1s+
          continue;
        }

        break; // Non-quota error or last retry for this key
      }
    }
  }
  throw lastError;
}

const buildAnswerPrompt = (question: ExamQuestion) => `
  Write a perfect model answer for this ${question.marks}-mark question.

  STRICT FORMATTING RULES:
  1. NO MARKDOWN. Do NOT use **bold**, # headers, or *italics*.
  2. USE HTML TAGS for emphasis: <b>bold text</b> and <u>underlined text</u>.
  3. MATH: MUST be wrapped in [[MATH]]...[[/MATH]]. 
     - Example: [[MATH]]x = \\frac{-b}{2a}[[MATH]]
     - Do NOT use $ or $$ for math.
     - Do NOT put text like "Calculation:" inside the math block.
  4. CODE: If the answer requires programming code, wrap it in [[CODE]]...[[/CODE]].
  5. CONTENT: Concise, academic, high-precision. Eliminate filler words.
  6. HTML TAGS must not have spaces inside brackets. Correct: <b>. Incorrect: < b >.

  Question: ${question.text}
  Context: ${question.suggestedAnswer}
`;

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError && i < maxRetries - 1) {
        const waitTime = initialDelay * Math.pow(2, i);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const analyzeExamPaper = async (files: { data: string, mimeType: string }[], _modelName: string): Promise<ExamAnalysis> => {
  const fileParts = files.map(file => ({
    inlineData: { mimeType: file.mimeType, data: file.data.split(',')[1] }
  }));

  const fastModelGemini = 'gemini-3-flash-preview';

  const prompt = `
    Analyze these exam papers. Extract questions/marks structure.
    OUTPUT: JSON only.
    
    RULES:
    - suggestAnswer: extremely brief key points only.
    - diagramRequired: true ONLY if visual answer needed.
    
    Schema:
    {
      examTitle: string,
      totalMarks: number,
      questions: [{ id, label, text, marks, suggestedAnswer, diagramRequired, diagramDescription }]
    }
  `;

  // SCANNING: Strictly Gemini only as requested
  return await withProviderRetry('gemini', async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: fastModelGemini,
      contents: { parts: [...fileParts, { text: prompt }] },
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || "{}") as ExamAnalysis;
  });
};

export const refineAcademicAnswer = async (question: ExamQuestion, modelName: string, provider: ModelProvider): Promise<string> => {
  const prompt = buildAnswerPrompt(question);

  // Helper for Gemini call
  const callGemini = async (apiKey: string, model: string) => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] }
    });
    return response.text || question.suggestedAnswer;
  };

  // Helper for OpenRouter call
  const callOpenRouter = async (apiKey: string, model: string) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== 'undefined' ? window.location.origin : "http://localhost",
        "X-Title": "Academic Architect"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a precise academic answer generator." },
          { role: "user", content: prompt }
        ],
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter error: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || question.suggestedAnswer;
  };

  // 1. Try OpenRouter first (rotating through all keys)
  try {
    const orKeys = getOpenRouterKeys();
    if (orKeys.length > 0) {
      // If the initial provider was gemini, we might want to map to a default OR model
      // but if the user selected an OR model, use that.
      const orModel = provider === 'openrouter' ? modelName : 'google/gemini-2.0-flash-001';
      return await withProviderRetry('openrouter', (key) => callOpenRouter(key, orModel));
    }
  } catch (error) {
    console.warn("OpenRouter fallback failed, trying Gemini...", error);
  }

  // 2. Fallback to Gemini (rotating through all keys)
  try {
    const geminiModel = provider === 'gemini' ? modelName : 'gemini-2.0-flash-exp';
    return await withProviderRetry('gemini', (key) => callGemini(key, geminiModel));
  } catch (error) {
    console.error("All providers and keys failed", error);
    throw error;
  }
};

export const generateTechnicalDiagram = async (description: string): Promise<string> => {
  return withRetry(async () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Missing Gemini API key. Add it in Settings or via env.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Technical diagram for exam: ${description}. 
      Style: Clean hand-drawn look, blue/black ink, white paper. High contrast.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "4:3" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Diagram generation failed.");
  }, 3, 2000);
};
