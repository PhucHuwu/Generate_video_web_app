"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Upload } from "lucide-react";

interface Message {
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
    sender: "user" | "bot";
    timestamp: Date;
}

export function ChatContainer() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [uploadedImage, setUploadedImage] = useState<{
        src: string;
        fileName: string;
        size: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && !uploadedImage) {
            // Require prompt before sending unless an image is attached
            alert("Vui lòng nhập prompt để tạo video hoặc chọn một ảnh.");
            return;
        }

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            image: uploadedImage
                ? {
                      src: uploadedImage.src,
                      fileName: uploadedImage.fileName,
                      size: uploadedImage.size,
                  }
                : undefined,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        // Clear the small preview immediately when the user sends the message
        setUploadedImage(null);
        setInput("");
        setIsLoading(true);

        try {
            // Call our backend generate endpoint which handles the external API and polling
            const body: any = { prompt: input };
            if (uploadedImage) {
                body.imageBase64 = uploadedImage.src;
                body.fileName = uploadedImage.fileName;
            }

            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                throw new Error(`Generate failed: ${response.status} ${text}`);
            }

            const data = await response.json();

            // If backend returned a Gemini description for image-only request, show it
            if (data?.description) {
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: data.description,
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMessage]);
                setIsLoading(false);
                return;
            }

            // If the server already returned resultUrls, show immediately
            if (
                data?.state === "success" &&
                Array.isArray(data.resultUrls) &&
                data.resultUrls.length > 0
            ) {
                const videoUrl = data.resultUrls[0];
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "Video đã tạo xong",
                    media: { src: videoUrl, type: "video" },
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMessage]);
            } else if (
                Array.isArray(data?.resultUrls) &&
                data.resultUrls.length > 0
            ) {
                // Some backends may return resultUrls without state
                const videoUrl = data.resultUrls[0];
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "Video đã tạo xong",
                    media: { src: videoUrl, type: "video" },
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMessage]);
            } else if (data?.taskId) {
                // Show a temporary processing message, and start client-side polling for status
                const tempId = (Date.now() + 1).toString();
                const processingMessage: Message = {
                    id: tempId,
                    text: "Đang tạo video — quá trình có thể mất khoảng 30–60 giây. Vui lòng chờ trong giây lát.",
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, processingMessage]);

                // Start polling in background
                (async () => {
                    const maxChecks = 30; // up to ~60s with 2s interval
                    const intervalMs = 2000;
                    for (let i = 0; i < maxChecks; i++) {
                        try {
                            const statusRes = await fetch(
                                `/api/generate/status?taskId=${encodeURIComponent(
                                    data.taskId
                                )}`
                            );
                            if (!statusRes.ok) {
                                // if server returns 4xx/5xx, break or continue depending on needs; here we'll continue
                                await new Promise((r) =>
                                    setTimeout(r, intervalMs)
                                );
                                continue;
                            }
                            const statusData = await statusRes.json();
                            if (
                                statusData?.state === "success" &&
                                Array.isArray(statusData.resultUrls) &&
                                statusData.resultUrls.length > 0
                            ) {
                                const videoUrl = statusData.resultUrls[0];
                                const finishedMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: "Video đã tạo xong",
                                    media: { src: videoUrl, type: "video" },
                                    sender: "bot",
                                    timestamp: new Date(),
                                };
                                // Replace processing message with result
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === tempId ? finishedMessage : m
                                    )
                                );
                                return;
                            }
                        } catch (err) {
                            // ignore and retry
                        }
                        await new Promise((r) => setTimeout(r, intervalMs));
                    }

                    // If we reach here, timed out — update message to a generic waiting notice
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId
                                ? {
                                      ...m,
                                      text: "Quá trình tạo video vẫn đang được xử lý và có thể mất thêm thời gian. Vui lòng kiểm tra lại sau.",
                                  }
                                : m
                        )
                    );
                })();
            } else if (data?.error) {
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: `Lỗi: ${data.error}`,
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMessage]);
            } else {
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "Không có kết quả trả về",
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMessage]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Lỗi: Không nhận được phản hồi từ dịch vụ.",
                sender: "bot",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            alert("Vui lòng chọn một tệp ảnh hợp lệ");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("Kích thước ảnh phải nhỏ hơn 5MB");
            return;
        }

        setIsLoading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target?.result as string;

                // Show small preview near the input (do not add as chat message)
                setUploadedImage({
                    src: base64String,
                    fileName: file.name,
                    size: file.size,
                });
                setIsLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error processing image:", error);
            setIsLoading(false);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card p-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-foreground">
                        Chatbot tạo video
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Tạo video từ mô tả văn bản và ảnh
                    </p>
                </div>
            </header>

            {/* Messages Container */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full pt-20 text-center">
                            <div className="text-muted-foreground space-y-2">
                                <p className="text-lg font-medium">
                                    Chào mừng đến với Chatbot tạo video
                                </p>
                                <p className="text-sm">
                                    Nhập mô tả (prompt) để bắt đầu tạo video
                                </p>
                            </div>
                        </div>
                    )}

                    {messages.map((message) => {
                        const isUser = message.sender === "user";
                        const containerJustify = isUser
                            ? "justify-end"
                            : "justify-start";
                        const bubbleClass = isUser
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-card border border-border text-foreground rounded-bl-none";

                        // If user message contains both image and text, render two separate bubbles (stacked vertically)
                        if (isUser && message.image && message.text) {
                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${containerJustify}`}
                                >
                                    <div className="max-w-xs lg:max-w-md flex flex-col items-end gap-2">
                                        {/* Image bubble */}
                                        <div
                                            className={`px-4 py-2 rounded-lg ${bubbleClass}`}
                                        >
                                            <div className="mb-2">
                                                <img
                                                    src={
                                                        message.image.src ||
                                                        "/placeholder.svg"
                                                    }
                                                    alt={message.image.fileName}
                                                    className="rounded max-w-[200px] h-auto"
                                                />
                                                <p className="text-xs mt-1 opacity-70">
                                                    {message.image.fileName}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Text bubble */}
                                        <div
                                            className={`px-4 py-2 rounded-lg ${bubbleClass}`}
                                        >
                                            <p className="break-words">
                                                {message.text}
                                            </p>
                                            <p className="text-xs mt-1 opacity-70">
                                                {message.timestamp.toLocaleTimeString(
                                                    [],
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Default rendering (single bubble) for other cases
                        return (
                            <div
                                key={message.id}
                                className={`flex ${containerJustify}`}
                            >
                                <div
                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${bubbleClass}`}
                                >
                                    {message.image && (
                                        <div className="mb-2">
                                            <img
                                                src={
                                                    message.image.src ||
                                                    "/placeholder.svg"
                                                }
                                                alt={message.image.fileName}
                                                className="rounded max-w-[200px] h-auto"
                                            />
                                            <p className="text-xs mt-1 opacity-70">
                                                {message.image.fileName}
                                            </p>
                                        </div>
                                    )}
                                    {message.media &&
                                        message.media.type === "video" && (
                                            <div className="mb-2">
                                                <video
                                                    src={message.media.src}
                                                    controls
                                                    className="rounded max-w-[200px] h-auto"
                                                />
                                                <p className="text-xs mt-1 opacity-70">
                                                    Video kết quả
                                                </p>
                                            </div>
                                        )}
                                    {message.text && (
                                        <p className="break-words">
                                            {message.text}
                                        </p>
                                    )}
                                    <p className="text-xs mt-1 opacity-70">
                                        {message.timestamp.toLocaleTimeString(
                                            [],
                                            {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            }
                                        )}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-card border border-border text-foreground px-4 py-2 rounded-lg rounded-bl-none">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100"></div>
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input Area */}
            <footer className="border-t border-border bg-card p-4">
                <div className="max-w-4xl mx-auto">
                    {/* Uploaded image preview shown above input (not as a sent message) */}
                    {uploadedImage && (
                        <div className="mb-2 flex items-center gap-3">
                            <img
                                src={uploadedImage.src}
                                alt={uploadedImage.fileName}
                                className="w-20 h-14 object-cover rounded"
                            />
                            <div className="flex-1 text-sm">
                                <div className="font-medium">
                                    {uploadedImage.fileName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {(uploadedImage.size / 1024).toFixed(2)} KB
                                </div>
                            </div>
                            <div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setUploadedImage(null);
                                        if (fileInputRef.current)
                                            fileInputRef.current.value = "";
                                    }}
                                >
                                    Hủy
                                </Button>
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="Nhập mô tả (prompt) của bạn..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            disabled={isLoading}
                            size="icon"
                            className="bg-secondary hover:bg-secondary/90"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-4 h-4" />
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            disabled={
                                isLoading || (!input.trim() && !uploadedImage)
                            }
                            size="icon"
                            className="bg-primary hover:bg-primary/90"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </footer>
        </div>
    );
}
