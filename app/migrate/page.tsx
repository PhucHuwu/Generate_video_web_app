"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function MigratePage() {
    const [status, setStatus] = useState<string>("Ready to migrate");
    const [progress, setProgress] = useState<string>("");
    const [isMigrating, setIsMigrating] = useState(false);

    const migrate = async () => {
        setIsMigrating(true);
        setStatus("Starting migration...");
        setProgress("");

        try {
            // Migrate Video Chat History
            const videoHistoryRaw = localStorage.getItem("chat_history_v1");
            if (videoHistoryRaw) {
                const videoHistory = JSON.parse(videoHistoryRaw);
                if (Array.isArray(videoHistory)) {
                    setStatus(`Migrating ${videoHistory.length} video chat messages...`);
                    let count = 0;
                    for (const msg of videoHistory) {
                        await fetch("/api/chat/history", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: "video",
                                text: msg.text,
                                sender: msg.sender,
                                timestamp: msg.timestamp,
                                media: msg.image
                                    ? {
                                          src: msg.image.src,
                                          type: "image",
                                      }
                                    : msg.media,
                            }),
                        });
                        count++;
                        setProgress(`Video: ${count}/${videoHistory.length}`);
                    }
                }
            }

            // Migrate Image Chat History
            const imageHistoryRaw = localStorage.getItem("chat_history_image_v1");
            if (imageHistoryRaw) {
                const imageHistory = JSON.parse(imageHistoryRaw);
                if (Array.isArray(imageHistory)) {
                    setStatus(`Migrating ${imageHistory.length} image chat messages...`);
                    let count = 0;
                    for (const msg of imageHistory) {
                        await fetch("/api/chat/history", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: "image",
                                text: msg.text,
                                sender: msg.sender,
                                timestamp: msg.timestamp,
                                media: msg.media,
                            }),
                        });
                        count++;
                        setProgress((prev) => `${prev} | Image: ${count}/${imageHistory.length}`);
                    }
                }
            }

            setStatus("Migration completed successfully!");
        } catch (error: any) {
            console.error("Migration failed:", error);
            setStatus(`Migration failed: ${error.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
            <h1 className="text-2xl font-bold">Migrate LocalStorage to MongoDB</h1>
            <p className="text-muted-foreground">Click the button below to move your chat history from this browser to the database.</p>
            <div className="p-4 border rounded-lg bg-muted w-full max-w-md text-center">
                <p className="font-medium">{status}</p>
                <p className="text-sm text-muted-foreground mt-2">{progress}</p>
            </div>
            <Button onClick={migrate} disabled={isMigrating}>
                {isMigrating ? "Migrating..." : "Start Migration"}
            </Button>
        </div>
    );
}
