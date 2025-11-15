import "@/lib/early-warnings"; // register warning handler early to suppress known upstream deprecation warnings
import { NextRequest, NextResponse } from "next/server";
import generateMedia, { createTask } from "@/backend/generate-service";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

// Quy tắc prompt chung: đảm bảo mặt nhân vật không bị cắt trong video.
// Sử dụng một hướng dẫn rõ ràng (positive) và các từ khóa tránh (negative) để tăng khả năng tuân thủ.
const FACE_RULE_POSITIVE =
    "Ensure characters' faces remain fully visible and are not cropped.";
const FACE_RULE_NEGATIVE = "cropped face, cut-off face, partial face";

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

        // Ensure image_url is an https public URL. KIE chỉ chấp nhận URL bắt đầu bằng https://
        if (image_url && !/^https:\/\//i.test(image_url)) {
            return NextResponse.json(
                {
                    error: "KIE chỉ chấp nhận URL HTTPS (bắt đầu bằng https://). Vui lòng gửi một image_url công khai bắt đầu bằng https:// hoặc gửi imageBase64 để upload.",
                },
                { status: 400 }
            );
        }

        // Reject text-only requests: service requires an image (image_url or imageBase64).
        if (!image_url) {
            return NextResponse.json(
                {
                    error: "Dịch vụ chỉ hỗ trợ tạo video từ ảnh hoặc ảnh+kèm prompt. Trường hợp chỉ nhập prompt không được hỗ trợ.",
                },
                { status: 400 }
            );
        }

        // Now read prompt after handling image upload so we can support image-only requests
        let prompt = String(body?.prompt || "").trim();

        // Track whether the client provided an explicit prompt
        const clientProvidedPrompt = Boolean(
            body?.prompt && String(body.prompt).trim() !== ""
        );

        // Require a prompt. The new flow expects the client to call `/api/describe`
        // (or provide a prompt manually) before calling `/api/generate`.
        if (!prompt) {
            return NextResponse.json(
                {
                    error: "Cần prompt để tạo media. Vui lòng nhấn 'Gen Prompt' để sinh mô tả từ ảnh hoặc nhập mô tả trước khi gửi.",
                },
                { status: 400 }
            );
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

        // Đảm bảo prompt/negative_prompt bao gồm quy tắc mặt trước khi gọi generateMedia
        let finalPrompt = prompt;
        if (!finalPrompt.includes("face") && !finalPrompt.includes("mặt")) {
            finalPrompt = `${FACE_RULE_POSITIVE} ${finalPrompt}`.trim();
        }

        let finalNegative = negative_prompt;
        if (typeof finalNegative === "string" && finalNegative.trim() !== "") {
            if (
                !finalNegative.includes("cropped face") &&
                !finalNegative.includes("mặt bị cắt")
            ) {
                finalNegative = `${finalNegative}, ${FACE_RULE_NEGATIVE}`;
            }
        } else {
            finalNegative = `blur, distort, low quality, modest, reserved, decent, unsexy, asexual, prudish, chaste, ${FACE_RULE_NEGATIVE}`;
        }

        const result = await generateMedia(
            {
                prompt: finalPrompt,
                image_url,
                duration,
                negative_prompt: finalNegative,
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
