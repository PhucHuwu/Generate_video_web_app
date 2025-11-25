import { NextRequest, NextResponse } from "next/server";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageBase64 } = body;

        if (!imageBase64 || typeof imageBase64 !== "string") {
            return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
        }

        // Upload to Cloudinary
        const cloudinaryUrl = await uploadImageToCloudinary(imageBase64, "user-uploads");

        return NextResponse.json({
            success: true,
            url: cloudinaryUrl,
        });
    } catch (error: any) {
        console.error("Image upload error:", error);
        return NextResponse.json(
            {
                error: error.message || "Failed to upload image",
            },
            { status: 500 }
        );
    }
}
