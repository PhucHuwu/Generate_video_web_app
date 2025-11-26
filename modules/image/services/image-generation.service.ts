export interface GenerateImageInput {
    prompt: string;
    n?: number; // Number of images (1-10), defaults to 1
    response_format?: "url" | "b64_json"; // defaults to "url"
}

export interface GenerateImageResult {
    url?: string;
    urls?: string[];
    b64_json?: string;
    revised_prompt?: string;
}

const GROK_API_BASE = "https://api.x.ai/v1";
const GROK_API_KEY = process.env.GROK_API_KEY || "";

if (!GROK_API_KEY) {
    console.warn("GROK_API_KEY is not set. Image generation will fail until configured.");
}

/**
 * Generate an image using Grok API (xAI)
 */
export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
    if (!GROK_API_KEY) {
        throw new Error("GROK_API_KEY not configured on server");
    }

    if (!input.prompt || input.prompt.trim() === "") {
        throw new Error("Prompt is required for image generation");
    }

    const requestBody = {
        model: "grok-2-image",
        prompt: input.prompt,
        n: input.n ?? 1,
        response_format: input.response_format ?? "url",
    };

    const response = await fetch(`${GROK_API_BASE}/images/generations`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROK_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Grok API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Extract all images from response
    const images = data.data || [];
    const firstImage = images[0];

    if (!firstImage) {
        throw new Error("No image data returned from Grok API");
    }

    return {
        url: firstImage.url,
        urls: images.map((img: any) => img.url).filter(Boolean),
        b64_json: firstImage.b64_json,
        revised_prompt: firstImage.revised_prompt,
    };
}

export default generateImage;
