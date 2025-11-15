import { GoogleGenAI, Part } from "@google/genai";
import DESCRIBE_IMAGE_PROMPT from "./describe-prompt";
import { callOpenRouterFallback } from "./openrouter-service";

/**
 * Fetch an image from a public URL and convert to a Generative Part for Gemini.
 */
async function fetchImageAsPart(imageUrl: string): Promise<Part> {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
        inlineData: {
            data: base64,
            mimeType: contentType,
        },
    } as Part;
}

/**
 * Send image + prompt to Gemini (gemini-2.5-flash) and return the text description.
 * Requires GEMINI_API_KEY in environment.
 */
export async function describeImageWithGemini(imageUrl: string, apiKeyOverride?: string, openrouterApiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Google/Gemini API key not configured. Set GEMINI_API_KEY in env, or provide override.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Use shared prompt for image-only requests
    const prompt = DESCRIBE_IMAGE_PROMPT;

    const imagePart = await fetchImageAsPart(imageUrl);

    // Helper to call a specific Gemini model
    async function callModel(modelName: string) {
        return await ai.models.generateContent({
            model: modelName,
            contents: [imagePart, prompt],
            config: { temperature: 0.1 },
        });
    }

    // Try primary model, then fallback to a lighter model if overloaded (503 / UNAVAILABLE)
    let resp: any;
    let usedFallback = false;
    let fallbackSource = "";
    try {
        resp = await callModel("gemini-2.5-flash");
    } catch (err: any) {
        const msg = String(err?.message || err);
        // If overloaded or unavailable, or rate-limited (429), wait a bit then retry with a lighter model
        if (msg.includes("503") || /unavailab|overload/i.test(msg) || msg.includes("429") || /TooManyRequests/i.test(msg) || msg.includes("500")) {
            console.warn("Gemini model overloaded or rate-limited; waiting 3s then retrying with OpenRouter fallback", msg);
            // small delay before fallback to avoid rapid 429 responses
            await new Promise((r) => setTimeout(r, 3000));
            // Try OpenRouter fallback (separate module)
            try {
                resp = await callOpenRouterFallback(imageUrl, prompt, openrouterApiKeyOverride);
                usedFallback = true;
                fallbackSource = "openrouter";
            } catch (err2: any) {
                const combined = new Error(`Gemini describe failed (primary and OpenRouter fallback): ${msg}; ${String(err2?.message || err2)}`);
                (combined as any).primary = err;
                (combined as any).fallback = err2;
                throw combined;
            }
        } else {
            throw err;
        }
    }

    // Try a few common response shapes
    let text = "";
    if (typeof resp?.text === "string") text = resp.text;
    else if (Array.isArray(resp?.outputs) && resp.outputs[0]) {
        const out = resp.outputs[0];
        if (typeof out?.content === "string") text = out.content;
        else if (typeof out?.text === "string") text = out.text;
    }

    text = String(text || "").trim();

    // Debug log which source produced the description and the description text
    try {
        const source = usedFallback ? fallbackSource : "gemini-2.5-flash";
        // Use console.debug for debug-level logs; use console.log if you want always-visible output
        console.debug(`[describeImageWithGemini] source=${source} description=${text}`);
    } catch (logErr) {
        // swallow logging errors to avoid affecting response
    }
    return text;
}

export default describeImageWithGemini;
