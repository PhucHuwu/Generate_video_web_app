/**
 * OpenRouter fallback helper.
 * Exports a function that calls OpenRouter's chat/completions endpoint
 * and returns a normalized `{ text: string }` response.
 */
import DESCRIBE_IMAGE_PROMPT from "./describe-prompt";

export async function callOpenRouterFallback(imageUrl: string, promptText?: string, openrouterApiKeyOverride?: string): Promise<{ text: string }> {
    const openrouterApiKey = openrouterApiKeyOverride || process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
        throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY in env or provide override to enable fallback.");
    }

    const openrouterModel = process.env.OPENROUTER_MODEL || "nvidia/nemotron-nano-12b-v2-vl:free";
    const siteUrl = process.env.OPENROUTER_SITE_URL; // optional
    const siteName = process.env.OPENROUTER_SITE_NAME; // optional

    // Prefer provided promptText, otherwise use shared Gemini prompt
    const promptToUse = (promptText && String(promptText).trim()) || DESCRIBE_IMAGE_PROMPT;

    // Use structured message content so OpenRouter receives an image input
    const body = {
        model: openrouterModel,
        messages: [
            {
                role: "user",
                // content can be an array of parts (text + image_url) per OpenRouter examples
                content: [
                    {
                        type: "text",
                        text: promptToUse,
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageUrl },
                    },
                ],
            },
        ],
    };

    const headers: Record<string, string> = {
        Authorization: `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
    };
    if (siteUrl) headers["HTTP-Referer"] = siteUrl;
    if (siteName) headers["X-Title"] = siteName;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const errStr = data ? JSON.stringify(data) : `${res.status} ${res.statusText}`;
        throw new Error(`OpenRouter fallback failed: ${errStr}`);
    }

    // Common OpenRouter response shapes: `choices[0].message.content` (string or array) or `choices[0].text`
    let text = "";
    if (data) {
        const ch = data.choices && data.choices[0];
        if (ch) {
            // Handle `message.content` which may be a string or an array of parts
            if (ch.message) {
                const content = ch.message.content;
                if (typeof content === "string") {
                    text = content;
                } else if (Array.isArray(content)) {
                    // Join all text parts in order, ignore image parts
                    text = content
                        .map((seg: any) => {
                            if (!seg) return "";
                            if (typeof seg === "string") return seg;
                            if (seg.type === "text") return seg.text || "";
                            if (seg.type === "image_url") return "";
                            // Some providers may nest content differently
                            if (typeof seg.text === "string") return seg.text;
                            return "";
                        })
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                }
            }
            if (!text && typeof ch.text === "string") text = ch.text;
            if (!text && ch.delta && typeof ch.delta.content === "string") text = ch.delta.content;
        }
        // fallback for other shapes
        if (!text && typeof data.output === "string") text = data.output;
        if (!text && typeof data.text === "string") text = data.text;
    }

    return { text: String(text || "").trim() };
}

export default callOpenRouterFallback;
