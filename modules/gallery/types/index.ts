export interface MediaItem {
    id: string;
    mediaUrl: string;
    mediaType: "image" | "video";
    text: string; // Prompt/description
    timestamp: Date;
}

export interface DateGroup {
    date: string; // Format: "DD/MM/YYYY" or "Hôm nay" / "Hôm qua"
    items: MediaItem[];
}
