"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Settings as SettingsIcon, Trash, AlertTriangle } from "lucide-react";
import { useTheme } from "@/components/theme-toggle-provider";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/ui/mode-toggle";
import NativeConfirm from "@/components/ui/native-confirm";
import { Message, Settings } from "@/modules/video/types";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { SettingsDialog } from "./SettingsDialog";

export function VideoChatContainer() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [credits, setCredits] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(false);
    const [creditsError, setCreditsError] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

    const STORAGE_KEY = "chat_history_v1";
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [input, setInput] = useState("");
    const [uploadedImage, setUploadedImage] = useState<{
        src: string;
        fileName: string;
        size: number;
    } | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>({
        duration: "10",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const TEXTAREA_MAX_HEIGHT = 240;

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/auth");
                if (!res.ok) {
                    router.replace("/login");
                }
            } catch (e) {
                router.replace("/login");
            }
        })();
        fetchCredits().catch(() => {});
    }, [router]);

    async function fetchCredits() {
        setIsFetchingCredits(true);
        setCreditsError(null);
        try {
            const res = await fetch("/api/credits");
            const txt = await res.text().catch(() => "");
            let parsed: any = null;
            try {
                parsed = txt ? JSON.parse(txt) : null;
            } catch (e) {
                parsed = null;
            }

            if (!res.ok) {
                const msg = parsed?.msg || parsed?.error || txt || `HTTP ${res.status}`;
                setCredits(null);
                setCreditsError(String(msg));
                return;
            }

            const dataVal = parsed?.data ?? parsed;
            const value = typeof dataVal === "number" ? dataVal : Number(dataVal);
            if (!Number.isFinite(value)) {
                setCredits(null);
                setCreditsError("Không đọc được số dư");
                return;
            }
            setCredits(value);
        } catch (err: any) {
            console.error("Failed to fetch credits:", err);
            setCredits(null);
            setCreditsError(String(err?.message || err));
        } finally {
            setIsFetchingCredits(false);
        }
    }

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

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        const max = TEXTAREA_MAX_HEIGHT;
        if (el.scrollHeight > max) {
            el.style.height = `${max}px`;
            el.style.overflowY = "auto";
        } else {
            el.style.height = `${el.scrollHeight}px`;
            el.style.overflowY = "hidden";
        }
    }, [input]);

    useEffect(() => {
        setIsClient(true);
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
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (removeErr) {}
        }
        try {
            const s = localStorage.getItem("api_keys_v1");
            if (s) {
                const loaded = JSON.parse(s);
                setSettings({
                    ...loaded,
                    duration: loaded.duration || "10",
                });
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
        } catch (e) {
            console.warn("Failed to save chat history:", e);
        }
    }, [messages, hasLoadedHistory]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadedImage) {
            alert("Vui lòng chọn ảnh (bắt buộc). Trường hợp chỉ nhập prompt không được hỗ trợ.");
            return;
        }

        if (!input || input.trim() === "") {
            alert("Vui lòng tạo hoặc nhập mô tả trước khi bắt đầu tạo video. Nhấn 'Gen Prompt' để sinh mô tả từ ảnh.");
            return;
        }

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
        const imageToSend = uploadedImage
            ? {
                  src: uploadedImage.src,
                  fileName: uploadedImage.fileName,
              }
            : undefined;
        setUploadedImage(null);
        setInput("");
        setIsLoading(true);

        try {
            const body: any = { prompt: input };
            if (imageToSend) {
                body.imageBase64 = imageToSend.src;
                body.fileName = imageToSend.fileName;
            }
            if (settings.googleApiKey) body.googleApiKey = settings.googleApiKey;
            if (settings.openrouterApiKey) body.openrouterApiKey = settings.openrouterApiKey;
            if (settings.groqApiKey) body.groqApiKey = settings.groqApiKey;
            if (settings.duration) body.duration = settings.duration;

            const response = await fetch("/api/video/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const txt = await response.text().catch(() => "");
                let friendlyRaw = txt || `Status ${response.status}`;
                let parsed: any = undefined;
                try {
                    parsed = JSON.parse(txt || "{}");
                } catch (e) {}

                const code = parsed?.code || parsed?.createResp?.code || parsed?.raw?.code || parsed?.data?.code;
                const rawMsg = parsed?.error || parsed?.msg || parsed?.createResp?.msg || parsed?.raw?.msg || friendlyRaw;

                const kieCodeMap: Record<number, string> = {
                    401: "Không xác thực — kiểm tra thông tin đăng nhập hoặc API key.",
                    402: "Không đủ credits — vui lòng nạp thêm để tiếp tục sử dụng.",
                    404: "Không tìm thấy — endpoint hoặc tài nguyên không tồn tại.",
                    422: "Dữ liệu không hợp lệ — kiểm tra prompt và ảnh gửi lên.",
                    429: "Bị giới hạn tần suất — thử lại sau một lúc.",
                    455: "Dịch vụ đang bảo trì — vui lòng thử lại sau.",
                    500: "Lỗi máy chủ — vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
                    505: "Tính năng hiện đang tắt — tính năng này không khả dụng.",
                };

                let friendly = String(rawMsg);
                if (parsed && typeof parsed.error === "string" && parsed.error.trim().startsWith("Lỗi")) {
                    friendly = parsed.error;
                } else if (typeof code === "number" && kieCodeMap[code]) {
                    friendly = `Lỗi ${code}: ${kieCodeMap[code]}` + (rawMsg ? ` (${rawMsg})` : "");
                } else if (parsed && (parsed.error || parsed.msg)) {
                    friendly = parsed.error || parsed.msg;
                }

                const botText = typeof friendly === "string" && friendly.trim().startsWith("Lỗi") ? friendly : `Lỗi: ${friendly}`;

                const botMessage: Message = {
                    id: (Date.now() + 2).toString(),
                    text: botText,
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, botMessage]);
                setIsLoading(false);
                return;
            }

            const data = await response.json();
            const thinkingDescription = data?.description || data?.geminiDescription || undefined;
            const thinkingGroq = data?.groqOutput || undefined;

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
                setIsProcessing(false);
            } else if (data?.taskId) {
                const tempId = (Date.now() + 1).toString();
                const processingMessage: Message = {
                    id: tempId,
                    text: "Đang tạo video — quá trình có thể mất khoảng 3 - 5 phút. Vui lòng chờ trong giây lát. Vui lòng không đóng hay tải lại trang này",
                    sender: "bot",
                    timestamp: new Date(),
                    processing: true,
                    thinking:
                        thinkingDescription || thinkingGroq
                            ? {
                                  collapsed: false,
                              }
                            : undefined,
                };
                setMessages((prev) => [...prev, processingMessage]);
                setIsProcessing(true);

                (async () => {
                    const maxChecks = 60;
                    const intervalMs = 3000;
                    for (let i = 0; i < maxChecks; i++) {
                        try {
                            const statusRes = await fetch(`/api/video/generate/status?taskId=${encodeURIComponent(data.taskId)}`);
                            if (!statusRes.ok) {
                                await new Promise((r) => setTimeout(r, intervalMs));
                                continue;
                            }
                            const statusData = await statusRes.json();
                            function extractResultUrls(obj: any): string[] | undefined {
                                if (!obj) return undefined;
                                if (Array.isArray(obj.resultUrls) && obj.resultUrls.length) return obj.resultUrls;
                                try {
                                    const rj = obj?.raw?.data?.resultJson;
                                    if (rj) {
                                        const parsed = typeof rj === "string" ? JSON.parse(rj) : rj;
                                        if (Array.isArray(parsed?.resultUrls) && parsed.resultUrls.length) return parsed.resultUrls;
                                    }
                                } catch (e) {}
                                if (Array.isArray(obj?.raw?.resultUrls) && obj.raw.resultUrls.length) return obj.raw.resultUrls;
                                if (Array.isArray(obj?.data?.resultUrls) && obj.data.resultUrls.length) return obj.data.resultUrls;
                                return undefined;
                            }

                            const resultUrls = extractResultUrls(statusData);

                            if (Array.isArray(resultUrls) && resultUrls.length > 0) {
                                const videoUrl = resultUrls[0];
                                const finishedMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: "Video đã tạo xong",
                                    media: { src: videoUrl, type: "video" },
                                    sender: "bot",
                                    timestamp: new Date(),
                                    thinking:
                                        statusData?.geminiDescription || statusData?.groqOutput
                                            ? {
                                                  description: statusData?.geminiDescription,
                                                  groqOutput: statusData?.groqOutput,
                                                  collapsed: true,
                                              }
                                            : undefined,
                                };

                                setMessages((prev) => {
                                    const found = prev.some((m) => m.id === tempId);
                                    if (found) return prev.map((m) => (m.id === tempId ? finishedMessage : m));
                                    return [...prev, finishedMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }

                            if (statusData?.state === "fail" || statusData?.state === "failed") {
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
                                        statusData?.geminiDescription || statusData?.groqOutput
                                            ? {
                                                  description: statusData?.geminiDescription,
                                                  groqOutput: statusData?.groqOutput,
                                                  collapsed: true,
                                              }
                                            : undefined,
                                };

                                setMessages((prev) => {
                                    const found = prev.some((m) => m.id === tempId);
                                    if (found) return prev.map((m) => (m.id === tempId ? failMessage : m));
                                    return [...prev, failMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }
                        } catch (err) {}
                        await new Promise((r) => setTimeout(r, intervalMs));
                    }

                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempId
                                ? {
                                      ...m,
                                      text: "Quá trình tạo video đang mất nhiều thời gian hơn dự kiến. Đang tiếp tục kiểm tra. Vui lòng không đóng hay tải lại trang này",
                                      taskId: data.taskId,
                                      processing: true,
                                  }
                                : m
                        )
                    );

                    const extendedMaxChecks = 36;
                    const extendedIntervalMs = 5000;
                    for (let i = 0; i < extendedMaxChecks; i++) {
                        try {
                            const statusRes = await fetch(`/api/video/generate/status?taskId=${encodeURIComponent(data.taskId)}`);
                            if (!statusRes.ok) {
                                await new Promise((r) => setTimeout(r, extendedIntervalMs));
                                continue;
                            }
                            const statusData = await statusRes.json();
                            function extractResultUrls(obj: any): string[] | undefined {
                                if (!obj) return undefined;
                                if (Array.isArray(obj.resultUrls) && obj.resultUrls.length) return obj.resultUrls;
                                try {
                                    const rj = obj?.raw?.data?.resultJson;
                                    if (rj) {
                                        const parsed = typeof rj === "string" ? JSON.parse(rj) : rj;
                                        if (Array.isArray(parsed?.resultUrls) && parsed.resultUrls.length) return parsed.resultUrls;
                                    }
                                } catch (e) {}
                                if (Array.isArray(obj?.raw?.resultUrls) && obj.raw.resultUrls.length) return obj.raw.resultUrls;
                                if (Array.isArray(obj?.data?.resultUrls) && obj.data.resultUrls.length) return obj.data.resultUrls;
                                return undefined;
                            }

                            const resultUrls = extractResultUrls(statusData);

                            if (Array.isArray(resultUrls) && resultUrls.length > 0) {
                                const videoUrl = resultUrls[0];
                                const finishedMessage: Message = {
                                    id: (Date.now() + 2).toString(),
                                    text: "Video đã tạo xong",
                                    media: { src: videoUrl, type: "video" },
                                    sender: "bot",
                                    timestamp: new Date(),
                                };

                                setMessages((prev) => {
                                    const found = prev.some((m) => m.id === tempId);
                                    if (found) return prev.map((m) => (m.id === tempId ? finishedMessage : m));
                                    return [...prev, finishedMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }

                            if (statusData?.state === "fail" || statusData?.state === "failed") {
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
                                    const found = prev.some((m) => m.id === tempId);
                                    if (found) return prev.map((m) => (m.id === tempId ? failMessage : m));
                                    return [...prev, failMessage];
                                });
                                setIsProcessing(false);
                                return;
                            }
                        } catch (err) {}
                        await new Promise((r) => setTimeout(r, extendedIntervalMs));
                    }

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
        } catch (error: any) {
            console.error("Error sending message:", error);
            let friendly = (error && error.message) || "Không nhận được phản hồi từ dịch vụ.";
            try {
                const jsonMatch = String(friendly).match(/(\{[\s\S]*\})/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[1]);
                    const code = parsed?.code || parsed?.createResp?.code;
                    const rawMsg = parsed?.msg || parsed?.error || parsed?.createResp?.msg || parsed?.raw?.msg;
                    const kieCodeMap: Record<number, string> = {
                        401: "Không xác thực — kiểm tra thông tin đăng nhập hoặc API key.",
                        402: "Không đủ credits — vui lòng nạp thêm để tiếp tục sử dụng.",
                        404: "Không tìm thấy — endpoint hoặc tài nguyên không tồn tại.",
                        422: "Dữ liệu không hợp lệ — kiểm tra prompt và ảnh gửi lên.",
                        429: "Bị giới hạn tần suất — thử lại sau một lúc.",
                        455: "Dịch vụ đang bảo trì — vui lòng thử lại sau.",
                        500: "Lỗi máy chủ — vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
                        505: "Tính năng hiện đang tắt — tính năng này không khả dụng.",
                    };
                    if (typeof code === "number" && kieCodeMap[code]) {
                        friendly = `Lỗi ${code}: ${kieCodeMap[code]}` + (rawMsg ? ` (${rawMsg})` : "");
                    } else if (rawMsg) {
                        friendly = String(rawMsg);
                    }
                }
            } catch (e) {}

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: `Lỗi: ${friendly}`,
                sender: "bot",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Vui lòng chọn một tệp ảnh hợp lệ");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Kích thước ảnh phải nhỏ hơn 5MB");
            return;
        }

        setIsLoading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target?.result as string;
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

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleGeneratePrompt = async () => {
        if (!uploadedImage) return;
        setIsGeneratingPrompt(true);
        try {
            const body: any = {
                imageBase64: uploadedImage.src,
            };
            if (settings.googleApiKey) body.googleApiKey = settings.googleApiKey;
            if (settings.openrouterApiKey) body.openrouterApiKey = settings.openrouterApiKey;
            if (settings.groqApiKey) body.groqApiKey = settings.groqApiKey;

            const res = await fetch("/api/describe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                let friendly = txt;
                try {
                    const parsed = JSON.parse(txt || "{}");
                    if (parsed?.error) friendly = parsed.error;
                } catch (e) {}
                console.error("Describe failed:", res.status, friendly);
                alert(`Lỗi khi sinh prompt: ${friendly}`);
                return;
            }

            const data = await res.json();
            const suggested = data?.groqOutput || data?.description || "";
            setInput(suggested);
            textareaRef.current?.focus();
        } catch (err) {
            console.error("Gen Prompt error:", err);
            alert("Lỗi khi sinh prompt từ ảnh. Vui lòng thử lại.");
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const doClearHistory = () => {
        setMessages([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        setHasLoadedHistory(true);
        setIsConfirmOpen(false);
    };

    const doLogout = async () => {
        if (isLoading || isProcessing) {
            setIsLogoutConfirmOpen(false);
            try {
                alert("Không thể đăng xuất khi đang tạo video. Vui lòng đợi quá trình hoàn tất.");
            } catch (e) {}
            return;
        }

        setIsLogoutConfirmOpen(false);
        try {
            await fetch("/api/logout", { method: "POST" });
        } catch (e) {}
        router.replace("/login");
    };

    const clearHistory = () => {
        setIsConfirmOpen(true);
    };

    const handleSaveSettings = (newSettings: Settings) => {
        setSettings(newSettings);
        try {
            localStorage.setItem("api_keys_v1", JSON.stringify(newSettings));
        } catch (e) {
            console.error("Failed to save API keys", e);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <header id="chat-header" className="border-b border-border bg-card p-4">
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground hidden md:block">Chatbot tạo video</h1>
                            <p className="text-sm text-muted-foreground hidden md:block">Tạo video từ mô tả văn bản và ảnh</p>
                        </div>
                        <ModeToggle currentMode="video" onToggle={() => router.push("/image")} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            id="btn-fetch-credits"
                            size="sm"
                            variant="ghost"
                            onClick={fetchCredits}
                            disabled={isFetchingCredits}
                            title={creditsError ? `Lỗi: ${creditsError}` : "Lấy số dư hiện tại"}
                        >
                            <span className="text-sm">
                                {isFetchingCredits ? (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                                        <span>...</span>
                                    </span>
                                ) : credits === null ? (
                                    <span>-</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        {(() => {
                                            const remainingVideos = Math.floor(credits / (settings.duration === "5" ? 42 : 84));
                                            const isLowCredits = remainingVideos <= 3;
                                            return (
                                                <>
                                                    {isLowCredits && (
                                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-label="Cảnh báo: Credits thấp" />
                                                    )}
                                                    <span className="tabular-nums">{credits}</span>
                                                    <span className="hidden sm:inline">credits</span>
                                                    <span
                                                        className={cn(
                                                            "hidden md:inline",
                                                            isLowCredits ? "text-amber-500 font-medium" : "text-muted-foreground"
                                                        )}
                                                    >
                                                        ({remainingVideos} video)
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </span>
                                )}
                            </span>
                        </Button>

                        <Button
                            id="btn-theme-toggle"
                            size="sm"
                            variant="ghost"
                            onClick={toggleTheme}
                            title={theme === "light" ? "Chuyển sang chế độ tối" : "Chuyển sang chế độ sáng"}
                        >
                            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        </Button>
                        <Button id="btn-settings" size="sm" variant="ghost" onClick={() => setIsSettingsOpen(true)} title="Cài đặt">
                            <SettingsIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            id="btn-clear-history"
                            size="sm"
                            variant="ghost"
                            onClick={clearHistory}
                            disabled={messages.length === 0 || isLoading || isProcessing}
                            title="Xóa lịch sử chat"
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                        <Button
                            id="btn-logout"
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            disabled={isLoading || isProcessing}
                            title={isLoading || isProcessing ? "Không thể đăng xuất khi đang tạo video" : undefined}
                        >
                            Đăng xuất
                        </Button>
                    </div>
                </div>
            </header>

            <main id="chat-messages-container" className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto h-full flex flex-col">
                    <MessageList messages={messages} onToggleThinking={toggleThinking} messagesEndRef={messagesEndRef} />
                </div>
            </main>

            <InputArea
                input={input}
                setInput={setInput}
                uploadedImage={uploadedImage}
                onImageUpload={handleImageUpload}
                onClearImage={() => {
                    setUploadedImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                onSend={handleSendMessage}
                isLoading={isLoading}
                isGeneratingPrompt={isGeneratingPrompt}
                onGeneratePrompt={handleGeneratePrompt}
                onSettingsClick={() => setIsSettingsOpen(true)}
                fileInputRef={fileInputRef}
                textareaRef={textareaRef}
                credits={credits}
            />

            <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={handleSaveSettings} />

            <NativeConfirm
                id="modal-confirm-clear-history"
                open={isConfirmOpen}
                title="Xóa lịch sử chat"
                description="Bạn có chắc muốn xóa toàn bộ lịch sử chat? Hành động này không thể hoàn tác."
                confirmLabel="Xóa"
                cancelLabel="Hủy"
                onConfirm={doClearHistory}
                onCancel={() => setIsConfirmOpen(false)}
            />
            <NativeConfirm
                id="modal-confirm-logout"
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
