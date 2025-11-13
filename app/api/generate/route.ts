import "@/lib/early-warnings"; // register warning handler early to suppress known upstream deprecation warnings
import { NextRequest, NextResponse } from "next/server";
import generateMedia from "@/backend/generate-service";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { describeImageWithGemini } from "@/backend/gemini-service";
import { sendToGroq } from "@/backend/groq-service";

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        // We accept JSON. If a client sends multipart/form-data, reject with helpful note.
        if (contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                {
                    error: "multipart/form-data detected. Please send JSON with prompt and optional imageBase64 (data URL) or image_url.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        // image_url can be provided directly, or client can send imageBase64 (data URL)
        let image_url: string | undefined =
            typeof body?.image_url === "string" && body.image_url.trim() !== ""
                ? body.image_url.trim()
                : undefined;

        // If imageBase64 present, upload to Cloudinary to get a public URL
        if (
            !image_url &&
            typeof body?.imageBase64 === "string" &&
            body.imageBase64.startsWith("data:image/")
        ) {
            try {
                image_url = await uploadImageToCloudinary(body.imageBase64);
                console.log("Image uploaded to Cloudinary:", image_url);
            } catch (e: any) {
                console.error("Failed to upload image to Cloudinary:", e);
                return NextResponse.json(
                    { error: `Không thể upload ảnh: ${e.message}` },
                    { status: 500 }
                );
            }
        }

        // Now read prompt after handling image upload so we can support image-only requests
        let prompt = String(body?.prompt || "").trim();

        // Track whether the client provided an explicit prompt
        const clientProvidedPrompt = Boolean(
            body?.prompt && String(body.prompt).trim() !== ""
        );

        // If prompt is empty but an image was provided, set the special auto-prompt
        // The prompt instructs the downstream system to describe the character in the image
        if (!prompt && image_url) {
            prompt = `Hãy mô tả nhân vật trong bức ảnh (cử chỉ, tư thế,...), hãy chỉ trả về đoạn mô tả, không ghi chú gì thêm.`;
            console.log(
                "No prompt provided; using auto-prompt for image-only request."
            );

            // Send image + prompt to Gemini to obtain a description. For this step we will
            // only log and return the description to the client (do NOT send to KIE yet).
            try {
                const description = await describeImageWithGemini(
                    image_url,
                    prompt
                );
                console.log("Gemini description:", description);

                // Send Gemini output to Groq, stream/logging occurs inside helper
                try {
                    const groqOutput = await sendToGroq(description);
                    console.log("Groq output:", groqOutput);

                    return NextResponse.json({
                        description,
                        groqOutput,
                        usedPrompt: prompt,
                        image_url,
                    });
                } catch (gErr: any) {
                    console.error("Groq processing failed:", gErr);
                    // Return Gemini description and the groq error message (but don't fail silently)
                    return NextResponse.json({
                        description,
                        groqError: gErr?.message || String(gErr),
                        usedPrompt: prompt,
                        image_url,
                    });
                }
            } catch (e: any) {
                console.error("Gemini describe failed:", e);

                // Parse error to provide user-friendly messages
                let userMessage = "Không thể phân tích ảnh";
                const errorStr = JSON.stringify(e);

                if (
                    errorStr.includes('"code":503') ||
                    errorStr.includes("UNAVAILABLE") ||
                    errorStr.includes("overloaded")
                ) {
                    userMessage =
                        "Dịch vụ Gemini đang quá tải. Vui lòng thử lại sau vài giây.";
                } else if (
                    errorStr.includes('"code":429') ||
                    errorStr.includes("RESOURCE_EXHAUSTED")
                ) {
                    userMessage =
                        "Đã vượt quá giới hạn sử dụng API. Vui lòng thử lại sau.";
                } else if (
                    errorStr.includes('"code":401') ||
                    errorStr.includes("UNAUTHENTICATED")
                ) {
                    userMessage =
                        "API key không hợp lệ. Vui lòng kiểm tra cấu hình.";
                } else if (e?.message) {
                    userMessage = `Lỗi phân tích ảnh: ${e.message}`;
                }

                return NextResponse.json(
                    { error: userMessage },
                    { status: 503 }
                );
            }
        }

        // If there's still no prompt (no prompt and no image), return error
        if (!prompt) {
            return NextResponse.json(
                { error: "Cần prompt để tạo media" },
                { status: 400 }
            );
        }

        // Optional parameters with simple validation
        // Accept only "5" or "10". Default to "10" when missing/invalid to change system default.
        const duration = body?.duration === "5" ? "5" : "10";
        const negative_prompt =
            typeof body?.negative_prompt === "string"
                ? body.negative_prompt
                : undefined;
        const cfg_scale =
            typeof body?.cfg_scale === "number" ? body.cfg_scale : undefined;
        const callBackUrl =
            typeof body?.callBackUrl === "string"
                ? body.callBackUrl
                : undefined;

        const result = await generateMedia(
            {
                prompt,
                image_url,
                duration,
                negative_prompt,
                cfg_scale,
            },
            { callBackUrl }
        );

        return NextResponse.json(result);
    } catch (err: any) {
        console.error("/api/generate error", err);
        const message = err?.message || "Lỗi máy chủ";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
