export interface Message {
    id: string;
    text?: string;
    image?: {
        src: string;
        fileName: string;
        size: number;
    };
    media?: {
        src: string;
        type: "video" | "image" | "unknown";
    };
    mediaList?: {
        type: "image";
        src: string;
    }[];
    sender: "user" | "bot";
    timestamp: Date;
    // taskId for retry/manual polling
    taskId?: string;
    // whether this message represents an ongoing processing state (show animated ellipsis)
    processing?: boolean;
}

export interface Settings {
    googleApiKey?: string;
    openrouterApiKey?: string;
    groqApiKey?: string;
    duration?: "5" | "10";
}
