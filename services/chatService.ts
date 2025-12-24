import OpenAI from 'openai';

export type ChatMode = 'pro' | 'flash' | 'uncensored';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
//no change models
const MODELS = {
    pro: 'openai/gpt-oss-120b',
    flash: 'moonshotai/kimi-k2-instruct',
    uncensored: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free'
};

const OPENROUTER_FALLBACKS: Record<string, string> = {
    'llama3-70b-8192': 'meta-llama/llama-3.1-70b-instruct',
    'llama3-8b-8192': 'meta-llama/llama-3.1-8b-instruct'
};

const GROQ_NATIVE_MODELS = [
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma-7b-it',
    'gemma2-9b-it',
    'openai/gpt-oss-120b',
    'moonshotai/kimi-k2-instruct'
];

export class ChatService {
    private groqClient: OpenAI | null = null;
    private openRouterKeys: string[] = [];
    private currentOpenRouterIndex = 0;

    constructor(config: { groqKey?: string, openRouterKey?: string }) {
        if (config.groqKey) {
            this.groqClient = new OpenAI({
                apiKey: config.groqKey.trim(),
                baseURL: 'https://api.groq.com/openai/v1',
                dangerouslyAllowBrowser: true
            });
        }

        if (config.openRouterKey) {
            // Split by comma and clean up key string
            this.openRouterKeys = config.openRouterKey
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);
        }
    }

    private getOpenRouterClient(): OpenAI | null {
        if (this.openRouterKeys.length === 0) return null;

        // Use current index, wrapping around if needed
        const key = this.openRouterKeys[this.currentOpenRouterIndex % this.openRouterKeys.length];

        return new OpenAI({
            apiKey: key,
            baseURL: 'https://openrouter.ai/api/v1',
            dangerouslyAllowBrowser: true,
            defaultHeaders: {
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Crytonix AI'
            }
        });
    }

    private rotateOpenRouterKey() {
        this.currentOpenRouterIndex = (this.currentOpenRouterIndex + 1) % this.openRouterKeys.length;
    }

    async *streamChat(messages: ChatMessage[], mode: ChatMode) {
        const targetModel = MODELS[mode];
        const isGroqMode = mode === 'pro' || mode === 'flash';

        if (isGroqMode && this.groqClient) {
            yield* this.makeRequest(this.groqClient, targetModel, messages, mode);
        } else {
            // OpenRouter Logic with Retry
            if (this.openRouterKeys.length === 0) {
                if (isGroqMode && !this.groqClient) {
                    throw new Error(`Mode '${mode}' requires Groq API Key or OpenRouter fallback. Please check your Settings.`);
                }
                throw new Error(`Mode '${mode}' requires OpenRouter API Key. Please check your Settings.`);
            }

            const modelToUse = isGroqMode ? (OPENROUTER_FALLBACKS[targetModel] || targetModel) : targetModel;

            let lastError: any = null;
            for (let i = 0; i < this.openRouterKeys.length; i++) {
                const client = this.getOpenRouterClient();
                if (!client) break;

                try {
                    yield* this.makeRequest(client, modelToUse, messages, mode);
                    return; // Success
                } catch (error: any) {
                    lastError = error;
                    if (error?.status === 401) {
                        this.rotateOpenRouterKey();
                        continue;
                    }
                    throw error;
                }
            }
            throw lastError || new Error("All provider keys failed.");
        }
    }

    private async *makeRequest(client: OpenAI, model: string, messages: ChatMessage[], mode: ChatMode) {
        try {
            const stream = await client.chat.completions.create({
                model: model,
                messages: messages,
                stream: true,
                temperature: mode === 'pro' ? 0.7 : 0.6,
                max_tokens: 4096,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    yield content;
                }
            }
        } catch (error: any) {
            console.error('Chat stream error:', error);
            if (error?.status === 404) {
                throw new Error(`Model '${model}' not found on provider. Check availability.`);
            }
            if (error?.status === 401) {
                // Re-throw 401 so caller loop can catch and rotate
                error.validKey = false;
            }
            throw error;
        }
    }
}
