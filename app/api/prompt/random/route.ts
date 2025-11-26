import { NextRequest, NextResponse } from "next/server";
import { generatePromptWithGrok } from "@/modules/core/services/openrouter-prompt.service";

export async function POST(req: NextRequest) {
    try {
        // Hardcoded prompt as requested by the user
        const systemPrompt =
            "Tạo cho tôi một đoạn prompt đầy đủ bằng tiếng Anh để tạo một bức ảnh 16+ gợi cảm nhẹ của một cô gái, chỉ trả về prompt, không ghi chú gì thêm.";

        const result = await generatePromptWithGrok({
            prompt: systemPrompt,
            includeReasoning: false, // No reasoning needed for this specific request
        });

        return NextResponse.json({
            success: true,
            prompt: result.text,
        });
    } catch (error: any) {
        console.error("Random prompt generation error:", error);
        return NextResponse.json(
            {
                error: error.message || "Failed to generate random prompt",
            },
            { status: 500 }
        );
    }
}
