import { handleImageUpload, type ImageUploadRequest } from "@/backend/chat-service";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as ImageUploadRequest;

        if (!body.imageBase64 || !body.fileName) {
            return NextResponse.json({ error: "Cần dữ liệu ảnh và tên tệp" }, { status: 400 });
        }

        // Validate base64 format
        if (!body.imageBase64.startsWith("data:image/")) {
            return NextResponse.json({ error: "Định dạng ảnh không hợp lệ" }, { status: 400 });
        }

        const response = await handleImageUpload(body);
        return NextResponse.json(response);
    } catch (error) {
        console.error("Upload API error:", error);
        return NextResponse.json({ error: "Lỗi máy chủ nội bộ" }, { status: 500 });
    }
}
