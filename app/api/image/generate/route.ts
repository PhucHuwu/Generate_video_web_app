import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/modules/image/services/image-generation.service";

import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // 1. Create Pending Message in DB
        const pendingMsg = await prisma.chatMessage.create({
            data: {
                type: "image",
                sender: "bot",
                text: "Đang tạo ảnh — quá trình có thể mất khoảng 10 - 20 giây. Vui lòng đợi",
                status: "pending",
                timestamp: new Date(),
            },
        });

        try {
            // 2. Call Grok image generation service
            const result = await generateImage({
                prompt,
                n: 4,
                response_format: "url",
            });

            // 3. Update Message to Success
            const updatedMsg = await prisma.chatMessage.update({
                where: { id: pendingMsg.id },
                data: {
                    status: "success",
                    text: result.revised_prompt || prompt,
                    mediaList: result.urls ? result.urls.map((url) => ({ type: "image", src: url })) : undefined,
                    mediaUrl: result.url, // Keep for backward compatibility if needed, or just rely on mediaList
                    mediaType: "image",
                },
            });

            return NextResponse.json({
                success: true,
                message: updatedMsg,
                imageUrl: result.url,
                imageUrls: result.urls,
                revisedPrompt: result.revised_prompt,
            });
        } catch (genError: any) {
            console.error("Image generation failed:", genError);

            // 4. Update Message to Failed
            await prisma.chatMessage.update({
                where: { id: pendingMsg.id },
                data: {
                    status: "failed",
                    text: `Lỗi: ${genError.message || "Không thể tạo ảnh"}`,
                    failReason: genError.message,
                },
            });

            throw genError; // Re-throw to be caught by outer catch for response
        }
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
