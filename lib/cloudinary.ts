import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 image to Cloudinary and return the public URL
 * @param base64Image - Data URL (e.g., "data:image/png;base64,...")
 * @param folder - Optional folder name in Cloudinary
 * @returns Public HTTPS URL of the uploaded image
 */
export async function uploadImageToCloudinary(base64Image: string, folder: string = "video-generator"): Promise<string> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        throw new Error("CLOUDINARY_CLOUD_NAME not configured. Please set Cloudinary environment variables.");
    }

    try {
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: folder,
            resource_type: "image",
            // Optional: add transformation to optimize/resize
            // transformation: [{ width: 1920, height: 1080, crop: "limit" }],
        });

        return uploadResponse.secure_url;
    } catch (error: any) {
        console.error("Cloudinary upload error:", error);
        throw new Error(`Failed to upload image to Cloudinary: ${error.message || "Unknown error"}`);
    }
}
