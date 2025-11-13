import { GoogleGenAI, Part } from "@google/genai";

/**
 * Fetch an image from a public URL and convert to a Generative Part for Gemini.
 */
async function fetchImageAsPart(imageUrl: string): Promise<Part> {
    const res = await fetch(imageUrl);
    if (!res.ok)
        throw new Error(
            `Failed to fetch image: ${res.status} ${res.statusText}`
        );
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(
        ";"
    )[0];
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
 * Requires GOOGLE_API_KEY or GEMINI_API_KEY in environment.
 */
export async function describeImageWithGemini(imageUrl: string) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "Google/Gemini API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY in env."
        );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Hard-coded prompt for Gemini (image-only requests)
    const prompt = `Hãy mô tả nhân vật trong bức ảnh (cử chỉ, tư thế,...), hãy chỉ trả về đoạn mô tả, không ghi chú gì thêm.`;

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
    try {
        resp = await callModel("gemini-2.5-flash");
    } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("503") || /unavailab|overload/i.test(msg)) {
            console.warn(
                "Gemini model overloaded; retrying with gemini-2.0-flash-lite",
                msg
            );
            try {
                resp = await callModel("gemini-2.0-flash-lite");
            } catch (err2: any) {
                const combined = new Error(
                    `Gemini describe failed (primary and fallback): ${msg}; ${String(
                        err2?.message || err2
                    )}`
                );
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
    return text;
}

export default describeImageWithGemini;
