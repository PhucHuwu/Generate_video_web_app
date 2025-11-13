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
export async function describeImageWithGemini(
    imageUrl: string,
    prompt: string
) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "Google/Gemini API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY in env."
        );
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = await fetchImageAsPart(imageUrl);

    const resp: any = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [imagePart, prompt],
        config: {
            temperature: 0.1,
        },
    });

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
