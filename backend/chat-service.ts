// Backend service for handling chat logic
export interface ChatRequest {
    message: string;
}

export interface ImageUploadRequest {
    imageBase64: string;
    fileName: string;
}

export interface ChatResponse {
    message: string;
    timestamp: string;
}

export interface ImageUploadResponse {
    success: boolean;
    fileName: string;
    size: number;
    timestamp: string;
}

export async function handleChatMessage(request: ChatRequest): Promise<ChatResponse> {
    return {
        message: request.message,
        timestamp: new Date().toISOString(),
    };
}

export async function handleImageUpload(request: ImageUploadRequest): Promise<ImageUploadResponse> {
    // Get base64 data size (approximate file size)
    const base64Size = Math.ceil((request.imageBase64.length * 3) / 4);

    return {
        success: true,
        fileName: request.fileName,
        size: base64Size,
        timestamp: new Date().toISOString(),
    };
}
