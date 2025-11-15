import "@/lib/early-warnings"; // keep consistent logging behavior
import { NextRequest, NextResponse } from "next/server";
import { describeImageWithGemini } from "@/backend/gemini-service";
import { sendToGroq } from "@/backend/groq-service";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                {
                    error: "multipart/form-data detected. Vui lòng gửi JSON với imageBase64 (data URL) hoặc image_url.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        let image_url: string | undefined =
            typeof body?.image_url === "string" && body.image_url.trim() !== ""
                ? body.image_url.trim()
                : undefined;

        if (
            !image_url &&
            typeof body?.imageBase64 === "string" &&
            body.imageBase64.startsWith("data:image/")
        ) {
            try {
                image_url = await uploadImageToCloudinary(body.imageBase64);
                console.log(
                    "Image uploaded to Cloudinary (describe):",
                    image_url
                );
            } catch (e: any) {
                console.error(
                    "Failed to upload image to Cloudinary (describe):",
                    e
                );
                return NextResponse.json(
                    { error: `Không thể upload ảnh: ${e.message}` },
                    { status: 500 }
                );
            }
        }

        if (!image_url) {
            return NextResponse.json(
                {
                    error: "Vui lòng cung cấp image_url công khai (https) hoặc imageBase64 (data URL).",
                },
                { status: 400 }
            );
        }

        if (!/^https:\/\//i.test(image_url)) {
            return NextResponse.json(
                { error: "image_url phải bắt đầu bằng https://" },
                { status: 400 }
            );
        }

        // Allow API key overrides from client (for dev/testing)
        const googleApiKey =
            typeof body?.googleApiKey === "string"
                ? body.googleApiKey
                : undefined;
        const openrouterApiKey =
            typeof body?.openrouterApiKey === "string"
                ? body.openrouterApiKey
                : undefined;
        const groqApiKey =
            typeof body?.groqApiKey === "string" ? body.groqApiKey : undefined;

        let description: string | undefined;
        let groqOutput: string | undefined;

        try {
            description = await describeImageWithGemini(
                image_url,
                googleApiKey,
                openrouterApiKey
            );
            console.log("describe:", description);
        } catch (e: any) {
            console.error("Gemini describe failed:", e);
            return NextResponse.json(
                { error: `Gemini describe failed: ${e?.message || e}` },
                { status: 500 }
            );
        }

        try {
            groqOutput = await sendToGroq(description || "", groqApiKey);
            console.log("groq output: ", groqOutput);
        } catch (e: any) {
            console.error("Groq processing failed:", e);
            // Return description even if Groq fails
            groqOutput = undefined;
        }

        return NextResponse.json({ description, groqOutput, image_url });
    } catch (err: any) {
        console.error("/api/describe error", err);
        return NextResponse.json(
            { error: err?.message || "Lỗi máy chủ" },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
