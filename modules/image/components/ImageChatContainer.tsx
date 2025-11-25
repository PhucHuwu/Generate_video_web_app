"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Trash, LogOut } from "lucide-react";
import { useTheme } from "@/components/theme-toggle-provider";
import { ModeToggle } from "@/components/ui/mode-toggle";
import NativeConfirm from "@/components/ui/native-confirm";
import { Message } from "@/modules/video/types";
import { MessageList } from "@/modules/video/components/MessageList";
import { InputArea } from "@/modules/video/components/InputArea";

export function ImageChatContainer() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

    const STORAGE_KEY = "chat_history_image_v1";

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    const restored: Message[] = parsed.map((m) => ({
                        ...m,
                        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                    }));
                    setMessages(restored);
                }
            }
        } catch (e) {}
        setHasLoadedHistory(true);
    }, []);

    useEffect(() => {
        if (!hasLoadedHistory) return;
        try {
            const toSave = messages.map((m) => ({
                ...m,
                timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {}
    }, [messages, hasLoadedHistory]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
        const promptText = input;
        setInput("");
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
                id: (Date.now() + 1).toString(),
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

            setMessages((prev) => [...prev, botMessage]);
        } catch (error: any) {
            console.error("Image generation error:", error);
            // Add error message to chat
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: `Lỗi: ${error.message || "Không thể tạo ảnh. Vui lòng thử lại."}`,
                sender: "bot",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = () => {
        setIsConfirmOpen(true);
    };

    const doClearHistory = () => {
        setMessages([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
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
        <div className="flex flex-col h-screen bg-background">
            <header className="border-b border-border bg-card p-4">
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground hidden md:block">Chatbot tạo ảnh</h1>
                            <p className="text-sm text-muted-foreground hidden md:block">Tạo ảnh từ mô tả văn bản</p>
                        </div>
                        <ModeToggle currentMode="image" onToggle={() => router.push("/")} />
                    </div>
                    <div className="flex items-center gap-2">
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
                    <MessageList messages={messages} messagesEndRef={messagesEndRef} />
                </div>
            </div>

            <InputArea input={input} setInput={setInput} onSend={handleSendMessage} isLoading={isLoading} textareaRef={textareaRef} />

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
    );
}
