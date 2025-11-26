/**
 * Service to generate prompts using Grok 4.1 via OpenRouter.
 * Supports reasoning (Chain of Thought).
 */

export interface GeneratePromptOptions {
    prompt: string;
    openrouterApiKeyOverride?: string;
    includeReasoning?: boolean;
}

export interface GeneratePromptResult {
    text: string;
    reasoning?: string;
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "x-ai/grok-4.1-fast:free";

export async function generatePromptWithGrok(options: GeneratePromptOptions): Promise<GeneratePromptResult> {
    const apiKey = options.openrouterApiKeyOverride || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY in env or provide override.");
    }

    const messages = [
        {
            role: "user",
            content: options.prompt,
        },
    ];

    const body: any = {
        model: MODEL_NAME,
        messages: messages,
    };

    if (options.includeReasoning) {
        body.reasoning = { enabled: true };
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "",
                "X-Title": process.env.OPENROUTER_SITE_NAME || "",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const message = choice?.message;

        if (!message) {
            throw new Error("No message returned from OpenRouter");
        }

        return {
            text: message.content || "",
            reasoning: message.reasoning_details || undefined, // Capture reasoning if available
        };
    } catch (error: any) {
        console.error("generatePromptWithGrok error:", error);
        throw error;
    }
}

export default generatePromptWithGrok;
