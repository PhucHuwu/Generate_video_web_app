import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/modules/image/services/image-generation.service";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // Call Grok image generation service
        const result = await generateImage({
            prompt,
            response_format: "url", // Get URL instead of base64 for easier handling
        });

        return NextResponse.json({
            success: true,
            imageUrl: result.url,
            revisedPrompt: result.revised_prompt,
        });
    } catch (error: any) {
        console.error("Image generation error:", error);
        return NextResponse.json(
            {
                error: error.message || "Failed to generate image",
            },
            { status: 500 }
        );
    }
}
