"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Trash, LogOut, LayoutGrid } from "lucide-react";
import { useTheme } from "@/components/theme-toggle-provider";
import { ModeToggle } from "@/components/ui/mode-toggle";
import NativeConfirm from "@/components/ui/native-confirm";
import { Message } from "@/modules/video/types";
import { MessageList } from "@/modules/video/components/MessageList";
import { InputArea } from "@/modules/video/components/InputArea";
import { GallerySidebar } from "@/modules/gallery/components/GallerySidebar";

export function ImageChatContainer() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [oldestCursor, setOldestCursor] = useState<string | null>(null);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch("/api/chat/history?type=image&limit=10");
                if (res.ok) {
                    const data = await res.json();
                    if (data.messages && Array.isArray(data.messages)) {
                        setMessages(
                            data.messages.map((m: any) => ({
                                ...m,
                                timestamp: new Date(m.timestamp),
                            }))
                        );
                        setHasMoreHistory(data.hasMore || false);
                        setOldestCursor(data.nextCursor || null);
                    }
                }
            } catch (error) {
                console.error("Failed to load history:", error);
            } finally {
                setHasLoadedHistory(true);
                // Scroll to bottom after loading history to show newest messages
                setTimeout(scrollToBottom, 200);
            }
        };

        fetchHistory();
    }, []);

    const scrollToBottom = () => {
        // Scroll instantly without smooth animation to avoid annoying effect
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });

        // Also use scrollTop as backup to ensure we scroll all the way
        const container = messagesEndRef.current?.parentElement;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Scroll to bottom after user sends message
        setTimeout(scrollToBottom, 100);

        const promptText = input;
        setInput("");

        // Save user message to DB
        fetch("/api/chat/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "image",
                text: userMessage.text,
                sender: userMessage.sender,
                timestamp: userMessage.timestamp,
            }),
        }).catch((e) => console.error("Failed to save user message:", e));

        // Tạo processing message TRƯỚC KHI gọi API
        const tempId = (Date.now() + 1).toString();
        const processingMessage: Message = {
            id: tempId,
            text: "Đang tạo ảnh — quá trình có thể mất khoảng 10 - 20 giây. Vui lòng đợi",
            sender: "bot",
            timestamp: new Date(),
            processing: true,
        };
        setMessages((prev) => [...prev, processingMessage]);

        // Scroll to show processing message
        setTimeout(scrollToBottom, 100);

        setIsLoading(true);

        try {
            // Call Grok image generation API
            const response = await fetch("/api/image/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt: promptText }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(errorData.error || "Failed to generate image");
            }

            const data = await response.json();

            // Create bot message with generated image
            const botMessage: Message = {
                id: (Date.now() + 2).toString(),
                text: data.revisedPrompt || promptText,
                sender: "bot",
                timestamp: new Date(),
                media: data.imageUrl
                    ? {
                          type: "image",
                          src: data.imageUrl,
                      }
                    : undefined,
            };

            // Thay thế processing message bằng kết quả
            setMessages((prev) => prev.map((m) => (m.id === tempId ? botMessage : m)));

            // Scroll to show the generated image
            setTimeout(scrollToBottom, 100);

            // Save bot message to DB
            fetch("/api/chat/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image",
                    text: botMessage.text,
                    sender: botMessage.sender,
                    timestamp: botMessage.timestamp,
                    media: botMessage.media,
                }),
            }).catch((e) => console.error("Failed to save bot message:", e));
        } catch (error: any) {
            console.error("Image generation error:", error);
            // Update processing message to error
            const errorMessage: Message = {
                id: tempId,
                text: `Lỗi: ${error.message || "Không thể tạo ảnh. Vui lòng thử lại."}`,
                sender: "bot",
                timestamp: new Date(),
                processing: false,
            };
            setMessages((prev) => prev.map((m) => (m.id === tempId ? errorMessage : m)));

            // Scroll to show error message
            setTimeout(scrollToBottom, 100);

            // Save error message to DB (optional)
            fetch("/api/chat/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image",
                    text: errorMessage.text,
                    sender: errorMessage.sender,
                    timestamp: errorMessage.timestamp,
                }),
            }).catch((e) => console.error("Failed to save error message:", e));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRandomPrompt = async () => {
        setIsGeneratingPrompt(true);
        try {
            const res = await fetch("/api/prompt/random", {
                method: "POST",
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || "Failed to generate random prompt");
            }

            const data = await res.json();
            if (data.prompt) {
                setInput(data.prompt);
                textareaRef.current?.focus();
            }
        } catch (err) {
            console.error("Random prompt error:", err);
            alert("Lỗi khi tạo prompt ngẫu nhiên. Vui lòng thử lại.");
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const loadMoreHistory = async () => {
        if (!hasMoreHistory || isLoadingMore || !oldestCursor) return;

        setIsLoadingMore(true);
        try {
            const res = await fetch(`/api/chat/history?type=image&limit=10&cursor=${oldestCursor}`);
            if (res.ok) {
                const data = await res.json();
                if (data.messages && Array.isArray(data.messages)) {
                    const olderMessages = data.messages.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp),
                    }));
                    // Prepend older messages to the beginning
                    setMessages((prev) => [...olderMessages, ...prev]);
                    setHasMoreHistory(data.hasMore || false);
                    setOldestCursor(data.nextCursor || null);
                }
            }
        } catch (error) {
            console.error("Failed to load more history:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const clearHistory = () => {
        setIsConfirmOpen(true);
    };

    const doClearHistory = () => {
        setMessages([]);
        try {
            fetch("/api/chat/history?type=image", { method: "DELETE" });
        } catch (e) {}
        setIsConfirmOpen(false);
    };

    const doLogout = async () => {
        if (isLoading) {
            setIsLogoutConfirmOpen(false);
            try {
                alert("Không thể đăng xuất khi đang tạo ảnh. Vui lòng đợi quá trình hoàn tất.");
            } catch (e) {}
            return;
        }

        setIsLogoutConfirmOpen(false);
        try {
            await fetch("/api/logout", { method: "POST" });
        } catch (e) {}
        router.replace("/login");
    };

    return (
        <div className="flex flex-row h-screen bg-background">
            <GallerySidebar type="image" isOpen={isGalleryOpen} onToggle={() => setIsGalleryOpen(!isGalleryOpen)} />
            <div className="flex flex-col flex-1 h-screen">
                <header className="border-b border-border bg-card p-4">
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-0 md:gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground hidden md:block">Chatbot tạo Video/Ảnh</h1>
                                <p className="text-sm text-muted-foreground hidden md:block">Tạo ảnh từ mô tả văn bản</p>
                            </div>
                            <ModeToggle currentMode="image" onToggle={() => router.push("/")} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsGalleryOpen(!isGalleryOpen)}
                                className="lg:hidden"
                                title={isGalleryOpen ? "Ẩn gallery" : "Hiện gallery"}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={toggleTheme}
                                title={theme === "light" ? "Chuyển sang chế độ tối" : "Chuyển sang chế độ sáng"}
                            >
                                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={clearHistory} disabled={messages.length === 0 || isLoading} title="Xóa lịch sử chat">
                                <Trash className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsLogoutConfirmOpen(true)}
                                disabled={isLoading}
                                title={isLoading ? "Không thể đăng xuất khi đang tạo ảnh" : "Đăng xuất"}
                                className="gap-1.5"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden sm:inline">Đăng xuất</span>
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        <MessageList
                            messages={messages}
                            messagesEndRef={messagesEndRef}
                            hasMoreHistory={hasMoreHistory}
                            isLoadingMore={isLoadingMore}
                            onLoadMore={loadMoreHistory}
                        />
                    </div>
                </div>

                <InputArea
                    input={input}
                    setInput={setInput}
                    onSend={handleSendMessage}
                    isLoading={isLoading}
                    textareaRef={textareaRef}
                    isGeneratingPrompt={isGeneratingPrompt}
                    onRandomPrompt={handleRandomPrompt}
                />

                <NativeConfirm
                    open={isConfirmOpen}
                    title="Xóa lịch sử chat"
                    description="Bạn có chắc muốn xóa toàn bộ lịch sử chat? Hành động này không thể hoàn tác."
                    confirmLabel="Xóa"
                    cancelLabel="Hủy"
                    onConfirm={doClearHistory}
                    onCancel={() => setIsConfirmOpen(false)}
                />
                <NativeConfirm
                    open={isLogoutConfirmOpen}
                    title="Đăng xuất"
                    description="Bạn có chắc muốn đăng xuất khỏi tài khoản hiện tại? Bạn sẽ cần đăng nhập lại để tiếp tục."
                    confirmLabel="Đăng xuất"
                    cancelLabel="Hủy"
                    onConfirm={doLogout}
                    onCancel={() => setIsLogoutConfirmOpen(false)}
                />
            </div>
        </div>
    );
}
