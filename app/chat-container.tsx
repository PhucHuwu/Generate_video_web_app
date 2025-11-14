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
    thinking?: {
        // raw Gemini description and optional Groq-processed output
        description?: string;
        groqOutput?: string;
        // whether the thinking block is collapsed (hidden) in the UI
        collapsed?: boolean;
        // visible (streamed) fragments
        visibleDescription?: string;
        visibleGroq?: string;
    };
    media?: {
        src: string;
        type: "video" | "image" | "unknown";
    };
    sender: "user" | "bot";
    timestamp: Date;
    // taskId for retry/manual polling
    taskId?: string;
    // whether this message represents an ongoing processing state (show animated ellipsis)
    processing?: boolean;
}

function AnimatedEllipsis({ interval = 400 }: { interval?: number }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const t = window.setInterval(() => {
            setCount((c) => (c + 1) % 4);
        }, interval);
        return () => clearInterval(t);
    }, [interval]);
    return (
        <span aria-hidden className="inline-block w-6">
            {".".repeat(count)}
        </span>
    );
}

export function ChatContainer() {
    const [messages, setMessages] = useState<Message[]>([]);
    const STORAGE_KEY = "chat_history_v1";
    const [isProcessing, setIsProcessing] = useState(false);
    const [input, setInput] = useState("");
    const [uploadedImage, setUploadedImage] = useState<{
        src: string;
        fileName: string;
        size: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamTimersRef = useRef<Map<string, number>>(new Map());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const toggleThinking = (id: string) => {
        setMessages((prev) =>
            prev.map((m) =>
                m.id === id && m.thinking
                    ? {
                          ...m,
                          thinking: {
                              ...m.thinking,
                              collapsed: !m.thinking.collapsed,
                          },
                      }
                    : m
            )
        );
    };

    // Start a fake streaming effect for the thinking block of a message.
    const startFakeThinkingStream = (
        id: string,
        fullDescription: string | undefined,
        fullGroq: string | undefined
    ) => {
        // clear existing timer if any
        const existing = streamTimersRef.current.get(id);
        if (existing) {
            clearInterval(existing);
            streamTimersRef.current.delete(id);
        }

        const desc = fullDescription || "";
        const groq = fullGroq || "";

        // We'll reveal description first, then groq with a small pause
        let descIndex = 0;
        let groqIndex = 0;
        let phase: "desc" | "pause" | "groq" = desc
            ? "desc"
            : groq
            ? "groq"
            : "desc";

        const intervalMs = 40; // speed of fake typing
        const timer = window.setInterval(() => {
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== id || !m.thinking) return m;

                    const newThinking = { ...m.thinking } as any;

                    if (phase === "desc") {
                        descIndex += Math.max(1, Math.floor(Math.random() * 3));
                        if (descIndex >= desc.length) {
                            descIndex = desc.length;
                            newThinking.visibleDescription = desc.slice(
                                0,
                                descIndex
                            );
                            if (groq) phase = "pause";
                        } else {
                            newThinking.visibleDescription = desc.slice(
                                0,
                                descIndex
                            );
                        }
                    } else if (phase === "pause") {
                        // short pause before groq
                        phase = "groq";
                    } else if (phase === "groq") {
                        groqIndex += Math.max(1, Math.floor(Math.random() * 3));
                        if (groqIndex >= groq.length) {
                            groqIndex = groq.length;
                            newThinking.visibleGroq = groq.slice(0, groqIndex);
                            // done
                            const t = streamTimersRef.current.get(id);
                            if (t) {
                                clearInterval(t);
                                streamTimersRef.current.delete(id);
                            }
                        } else {
                            newThinking.visibleGroq = groq.slice(0, groqIndex);
                        }
                    }

                    return {
                        ...m,
                        thinking: { ...m.thinking, ...newThinking },
                    };
                })
            );
        }, intervalMs);

        streamTimersRef.current.set(id, timer);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // cleanup any running stream timers on unmount
    useEffect(() => {
        return () => {
            streamTimersRef.current.forEach((t) => clearInterval(t));
            streamTimersRef.current.clear();
        };
    }, []);

    // Load chat history from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as any[];
                const restored: Message[] = parsed.map((m) => ({
                    ...m,
                    // restore timestamp to Date
                    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                }));
                setMessages(restored);
            }
        } catch (e) {
            console.warn("Failed to load chat history:", e);
        }
    }, []);

    // Persist chat history to localStorage whenever messages change
    useEffect(() => {
        try {
            const toSave = messages.map((m) => ({
                ...m,
                timestamp:
                    m.timestamp instanceof Date
                        ? m.timestamp.toISOString()
                        : m.timestamp,
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            console.warn("Failed to save chat history:", e);
        }
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

            // If backend returned Gemini/Groq outputs, prepare a 'thinking' block
            const thinkingDescription =
                data?.description || data?.geminiDescription || undefined;
            const thinkingGroq = data?.groqOutput || undefined;

            // If the server already returned resultUrls, show immediately
            // Prioritize checking resultUrls first, regardless of state value
            if (Array.isArray(data?.resultUrls) && data.resultUrls.length > 0) {
                const videoUrl = data.resultUrls[0];
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "Video đã tạo xong",
                    media: { src: videoUrl, type: "video" },
                    sender: "bot",
                    timestamp: new Date(),
                    thinking:
                        thinkingDescription || thinkingGroq
                            ? {
                                  description: thinkingDescription,
                                  groqOutput: thinkingGroq,
                                  collapsed: true,
                              }
                            : undefined,
                };
                setMessages((prev) => [...prev, botMessage]);
                // ensure processing state is cleared if any
                setIsProcessing(false);
            } else if (data?.taskId) {
                // Show a temporary processing message, and start client-side polling for status
                const tempId = (Date.now() + 1).toString();
                const processingMessage: Message = {
                    id: tempId,
                    text: "Đang tạo video — quá trình có thể mất khoảng 30–60 giây. Vui lòng chờ trong giây lát. Vui lòng không đóng hay tải lại trang này",
                    sender: "bot",
                    timestamp: new Date(),
                    processing: true,
                    thinking:
                        thinkingDescription || thinkingGroq
                            ? {
                                  // Do NOT expose full description/groqOutput here to avoid briefly flashing full text.
                                  // The streamer will reveal visible fragments over time.
                                  collapsed: false,
                              }
                            : undefined,
                };
                setMessages((prev) => [...prev, processingMessage]);
                // mark processing so user cannot send new messages until finished
                setIsProcessing(true);

                // Start fake streaming for thinking content if present
                if (processingMessage.thinking) {
                    startFakeThinkingStream(
                        tempId,
                        thinkingDescription,
                        thinkingGroq
                    );
                }

                // Start polling in background
                (async () => {
                    const maxChecks = 60; // up to ~120s with 2s interval
                    const intervalMs = 3000;
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
                            console.debug(
                                "/api/generate/status returned",
                                statusData
                            );
                            // Robust extraction of resultUrls from several response shapes
                            function extractResultUrls(
                                obj: any
                            ): string[] | undefined {
                                if (!obj) return undefined;
                                if (
                                    Array.isArray(obj.resultUrls) &&
                                    obj.resultUrls.length
                                )
                                    return obj.resultUrls;
                                try {
                                    const rj = obj?.raw?.data?.resultJson;
                                    if (rj) {
                                        const parsed =
                                            typeof rj === "string"
                                                ? JSON.parse(rj)
                                                : rj;
                                        if (
                                            Array.isArray(parsed?.resultUrls) &&
                                            parsed.resultUrls.length
                                        )
                                            return parsed.resultUrls;
                                    }
                                } catch (e) {
                                    // ignore
                                }
                                if (
                                    Array.isArray(obj?.raw?.resultUrls) &&
                                    obj.raw.resultUrls.length
                                )
                                    return obj.raw.resultUrls;
                                if (
                                    Array.isArray(obj?.data?.resultUrls) &&
                                    obj.data.resultUrls.length
                                )
                                    return obj.data.resultUrls;
                                return undefined;
                            }

                            const resultUrls = extractResultUrls(statusData);

                            // If we have resultUrls, consider it a success regardless of state
                            if (
                                Array.isArray(resultUrls) &&
                                resultUrls.length > 0
                            ) {
                                const videoUrl = resultUrls[0];
                                const finishedMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: "Video đã tạo xong",
                                    media: { src: videoUrl, type: "video" },
                                    sender: "bot",
                                    timestamp: new Date(),
                                    thinking:
                                        statusData?.geminiDescription ||
                                        statusData?.groqOutput
                                            ? {
                                                  description:
                                                      statusData?.geminiDescription,
                                                  groqOutput:
                                                      statusData?.groqOutput,
                                                  visibleDescription:
                                                      statusData?.geminiDescription,
                                                  visibleGroq:
                                                      statusData?.groqOutput,
                                                  // collapse thinking when finished
                                                  collapsed: true,
                                              }
                                            : undefined,
                                };

                                // Clear any fake-stream timer for this processing message
                                const t = streamTimersRef.current.get(tempId);
                                if (t) {
                                    clearInterval(t);
                                    streamTimersRef.current.delete(tempId);
                                }

                                // Replace processing message with result (preserve thinking collapsed) or append if processing message was not found
                                setMessages((prev) => {
                                    const found = prev.some(
                                        (m) => m.id === tempId
                                    );
                                    if (found)
                                        return prev.map((m) =>
                                            m.id === tempId
                                                ? finishedMessage
                                                : m
                                        );
                                    return [...prev, finishedMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }

                            // If provider reports a failure, surface the fail message to the user and stop polling
                            if (
                                statusData?.state === "fail" ||
                                statusData?.state === "failed"
                            ) {
                                const failMsg =
                                    statusData?.raw?.data?.failMsg ||
                                    statusData?.failMsg ||
                                    statusData?.raw?.failMsg ||
                                    "Quá trình tạo video thất bại. Vui lòng thử lại với mô tả khác.";

                                const failMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: `Lỗi: ${failMsg}`,
                                    sender: "bot",
                                    timestamp: new Date(),
                                    thinking:
                                        statusData?.geminiDescription ||
                                        statusData?.groqOutput
                                            ? {
                                                  description:
                                                      statusData?.geminiDescription,
                                                  groqOutput:
                                                      statusData?.groqOutput,
                                                  visibleDescription:
                                                      statusData?.geminiDescription,
                                                  visibleGroq:
                                                      statusData?.groqOutput,
                                                  collapsed: true,
                                              }
                                            : undefined,
                                };

                                // Clear any fake-stream timer for this processing message
                                const t = streamTimersRef.current.get(tempId);
                                if (t) {
                                    clearInterval(t);
                                    streamTimersRef.current.delete(tempId);
                                }

                                // Replace processing message with failure message (append if not found)
                                setMessages((prev) => {
                                    const found = prev.some(
                                        (m) => m.id === tempId
                                    );
                                    if (found)
                                        return prev.map((m) =>
                                            m.id === tempId ? failMessage : m
                                        );
                                    return [...prev, failMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }
                        } catch (err) {
                            // ignore and retry
                        }
                        await new Promise((r) => setTimeout(r, intervalMs));
                    }

                    // If we reach here, timed out — update message with retry option and continue background polling
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId
                                ? {
                                      ...m,
                                      text: "Quá trình tạo video đang mất nhiều thời gian hơn dự kiến. Đang tiếp tục kiểm tra. Vui lòng không đóng hay tải lại trang này",
                                      // Store taskId in a custom field for manual retry
                                      taskId: data.taskId,
                                      processing: true,
                                  }
                                : m
                        )
                    );

                    // Continue background polling with longer intervals (every 5 seconds)
                    const extendedMaxChecks = 36; // 36 × 5s = 3 phút thêm
                    const extendedIntervalMs = 5000;
                    for (let i = 0; i < extendedMaxChecks; i++) {
                        try {
                            const statusRes = await fetch(
                                `/api/generate/status?taskId=${encodeURIComponent(
                                    data.taskId
                                )}`
                            );
                            if (!statusRes.ok) {
                                await new Promise((r) =>
                                    setTimeout(r, extendedIntervalMs)
                                );
                                continue;
                            }
                            const statusData = await statusRes.json();
                            function extractResultUrls(
                                obj: any
                            ): string[] | undefined {
                                if (!obj) return undefined;
                                if (
                                    Array.isArray(obj.resultUrls) &&
                                    obj.resultUrls.length
                                )
                                    return obj.resultUrls;
                                try {
                                    const rj = obj?.raw?.data?.resultJson;
                                    if (rj) {
                                        const parsed =
                                            typeof rj === "string"
                                                ? JSON.parse(rj)
                                                : rj;
                                        if (
                                            Array.isArray(parsed?.resultUrls) &&
                                            parsed.resultUrls.length
                                        )
                                            return parsed.resultUrls;
                                    }
                                } catch (e) {}
                                if (
                                    Array.isArray(obj?.raw?.resultUrls) &&
                                    obj.raw.resultUrls.length
                                )
                                    return obj.raw.resultUrls;
                                if (
                                    Array.isArray(obj?.data?.resultUrls) &&
                                    obj.data.resultUrls.length
                                )
                                    return obj.data.resultUrls;
                                return undefined;
                            }

                            const resultUrls = extractResultUrls(statusData);

                            if (
                                Array.isArray(resultUrls) &&
                                resultUrls.length > 0
                            ) {
                                const videoUrl = resultUrls[0];
                                const finishedMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: "Video đã tạo xong",
                                    media: { src: videoUrl, type: "video" },
                                    sender: "bot",
                                    timestamp: new Date(),
                                };

                                setMessages((prev) => {
                                    const found = prev.some(
                                        (m) => m.id === tempId
                                    );
                                    if (found)
                                        return prev.map((m) =>
                                            m.id === tempId
                                                ? finishedMessage
                                                : m
                                        );
                                    return [...prev, finishedMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }

                            if (
                                statusData?.state === "fail" ||
                                statusData?.state === "failed"
                            ) {
                                const failMsg =
                                    statusData?.raw?.data?.failMsg ||
                                    statusData?.failMsg ||
                                    statusData?.raw?.failMsg ||
                                    "Quá trình tạo video thất bại. Vui lòng thử lại với mô tả khác.";

                                const failMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: `Lỗi: ${failMsg}`,
                                    sender: "bot",
                                    timestamp: new Date(),
                                };

                                setMessages((prev) => {
                                    const found = prev.some(
                                        (m) => m.id === tempId
                                    );
                                    if (found)
                                        return prev.map((m) =>
                                            m.id === tempId ? failMessage : m
                                        );
                                    return [...prev, failMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }
                        } catch (err) {}
                        await new Promise((r) =>
                            setTimeout(r, extendedIntervalMs)
                        );
                    }

                    // Final timeout after extended polling
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId
                                ? {
                                      ...m,
                                      text: "Quá trình tạo video mất quá lâu. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
                                  }
                                : m
                        )
                    );
                    setIsProcessing(false);
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

    // Clear chat history (state + localStorage) with confirmation
    const clearHistory = () => {
        const ok = window.confirm(
            "Bạn có chắc muốn xóa toàn bộ lịch sử chat? Hành động này không thể hoàn tác."
        );
        if (!ok) return;

        // Clear any running stream timers
        streamTimersRef.current.forEach((t) => clearInterval(t));
        streamTimersRef.current.clear();

        setMessages([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // ignore
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
                                    Nhập mô tả để bắt đầu tạo video
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
                                                {message.processing && (
                                                    <AnimatedEllipsis />
                                                )}
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
                                    {message.thinking && (
                                        <div className="mb-2 border rounded px-3 py-2 bg-muted/5">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-medium">
                                                    Đang suy nghĩ...
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        toggleThinking(
                                                            message.id
                                                        )
                                                    }
                                                    className="text-xs text-primary/90"
                                                >
                                                    {message.thinking.collapsed
                                                        ? "Hiện"
                                                        : "Ẩn"}
                                                </button>
                                            </div>
                                            {!message.thinking.collapsed && (
                                                <div className="mt-2 text-sm text-muted-foreground space-y-2">
                                                    {(message.thinking
                                                        .visibleDescription ??
                                                        message.thinking
                                                            .description) && (
                                                        <div>
                                                            <div className="font-semibold text-xs">
                                                                Tôi sẽ phân tích
                                                                bức ảnh trước
                                                                tiên
                                                            </div>
                                                            <div className="whitespace-pre-wrap">
                                                                {"Trên hình ảnh là " +
                                                                    (message
                                                                        .thinking
                                                                        .visibleDescription ??
                                                                        message
                                                                            .thinking
                                                                            .description)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(message.thinking
                                                        .visibleGroq !==
                                                        undefined ||
                                                        (message.thinking
                                                            .collapsed &&
                                                            message.thinking
                                                                .groqOutput)) && (
                                                        <div>
                                                            <div className="font-semibold text-xs">
                                                                Gợi ý hành động
                                                                tiếp theo
                                                            </div>
                                                            <div className="whitespace-pre-wrap">
                                                                {message
                                                                    .thinking
                                                                    .visibleGroq !==
                                                                undefined
                                                                    ? message
                                                                          .thinking
                                                                          .visibleGroq
                                                                    : message
                                                                          .thinking
                                                                          .groqOutput}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {message.media &&
                                        message.media.type === "video" && (
                                            <div className="mb-2">
                                                <video
                                                    key={message.media.src}
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
                                            {message.processing && (
                                                <AnimatedEllipsis />
                                            )}
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
                    <div className="flex justify-end mb-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={clearHistory}
                            disabled={
                                messages.length === 0 ||
                                isLoading ||
                                isProcessing
                            }
                        >
                            Xóa lịch sử
                        </Button>
                    </div>
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
                            placeholder="Nhập mô tả của bạn..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading || isProcessing}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            disabled={isLoading || isProcessing}
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
                            disabled={isLoading || isProcessing}
                        />
                        <Button
                            type="submit"
                            disabled={
                                isLoading ||
                                isProcessing ||
                                (!input.trim() && !uploadedImage)
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
