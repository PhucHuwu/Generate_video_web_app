"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Settings as SettingsIcon, Trash, AlertTriangle, LogOut } from "lucide-react";
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
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>({
        duration: "10",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        setIsClient(true);
        const fetchHistory = async () => {
            try {
                const res = await fetch("/api/chat/history?type=video");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setMessages(
                            data.map((m: any) => ({
                                ...m,
                                timestamp: new Date(m.timestamp),
                            }))
                        );
                    }
                }
            } catch (error) {
                console.error("Failed to load history:", error);
            } finally {
                setHasLoadedHistory(true);
            }
        };

        fetchHistory();
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
    }, []);

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

        // Save user message to DB
        fetch("/api/chat/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "video",
                text: userMessage.text,
                sender: userMessage.sender,
                timestamp: userMessage.timestamp,
                media: userMessage.image
                    ? {
                          src: userMessage.image.src,
                          type: "image",
                      }
                    : undefined,
            }),
        }).catch((e) => console.error("Failed to save user message:", e));

        // Tạo processing message TRƯỚC KHI gọi API để người dùng thấy ngay
        const tempId = (Date.now() + 1).toString();
        const processingMessage: Message = {
            id: tempId,
            text: "Đang tạo video — quá trình có thể mất khoảng 3 - 5 phút. Vui lòng không đóng hay tải lại trang này",
            sender: "bot",
            timestamp: new Date(),
            processing: true,
        };
        setMessages((prev) => [...prev, processingMessage]);
        setIsLoading(true);
        setIsProcessing(true);

        try {
            const body: any = { prompt: input };
            if (imageToSend) {
                // Nếu src là URL Cloudinary (https://...) thì gửi image_url, còn nếu là base64 thì gửi imageBase64
                if (imageToSend.src.startsWith("https://")) {
                    body.image_url = imageToSend.src;
                } else {
                    body.imageBase64 = imageToSend.src;
                }
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
                // Thay thế processing message bằng error message
                setMessages((prev) => prev.map((m) => (m.id === tempId ? botMessage : m)));
                setIsLoading(false);
                setIsProcessing(false);

                // Save error message to DB
                fetch("/api/chat/history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "video",
                        text: botMessage.text,
                        sender: botMessage.sender,
                        timestamp: botMessage.timestamp,
                    }),
                }).catch((e) => console.error("Failed to save error message:", e));

                return;
            }

            const data = await response.json();

            // API luôn trả về taskId (theo KIE flow)
            if (!data?.taskId) {
                const errorMessage: Message = {
                    id: tempId,
                    text: "Lỗi: Không nhận được taskId từ server",
                    sender: "bot",
                    timestamp: new Date(),
                };
                setMessages((prev) => prev.map((m) => (m.id === tempId ? errorMessage : m)));
                setIsProcessing(false);
                setIsLoading(false);
                return;
            }

            // Bắt đầu polling ngay với taskId
            setIsLoading(false);

            // Polling function
            const pollTaskStatus = async () => {
                const TIMEOUT_MS = 5 * 60 * 1000; // 5 phút
                const POLL_INTERVAL_MS = 3000; // 3 giây
                const startTime = Date.now();
                const maxChecks = Math.floor(TIMEOUT_MS / POLL_INTERVAL_MS);

                // Helper function để extract video URL từ response
                const extractVideoUrl = (obj: any): string | null => {
                    // Kiểm tra resultUrls trực tiếp
                    if (Array.isArray(obj?.resultUrls) && obj.resultUrls.length > 0) {
                        return obj.resultUrls[0];
                    }

                    // Kiểm tra trong raw.data.resultJson
                    try {
                        const resultJson = obj?.raw?.data?.resultJson;
                        if (resultJson) {
                            const parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
                            if (Array.isArray(parsed?.resultUrls) && parsed.resultUrls.length > 0) {
                                return parsed.resultUrls[0];
                            }
                        }
                    } catch (e) {}

                    // Kiểm tra các vị trí khác
                    if (Array.isArray(obj?.raw?.resultUrls) && obj.raw.resultUrls.length > 0) {
                        return obj.raw.resultUrls[0];
                    }
                    if (Array.isArray(obj?.data?.resultUrls) && obj.data.resultUrls.length > 0) {
                        return obj.data.resultUrls[0];
                    }

                    return null;
                };

                // Polling loop
                for (let i = 0; i < maxChecks; i++) {
                    const elapsed = Date.now() - startTime;

                    // Kiểm tra timeout
                    if (elapsed >= TIMEOUT_MS) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempId
                                    ? {
                                          ...m,
                                          text: "Lỗi: Quá trình tạo video vượt quá 5 phút. Vui lòng thử lại sau.",
                                          processing: false,
                                      }
                                    : m
                            )
                        );
                        setIsProcessing(false);

                        // Save timeout error to DB
                        fetch("/api/chat/history", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: "video",
                                text: "Lỗi: Quá trình tạo video vượt quá 5 phút. Vui lòng thử lại sau.",
                                sender: "bot",
                                timestamp: new Date(),
                            }),
                        }).catch((e) => console.error("Failed to save timeout error:", e));

                        return;
                    }

                    // Gọi API kiểm tra status
                    try {
                        const statusRes = await fetch(`/api/video/generate/status?taskId=${encodeURIComponent(data.taskId)}`);

                        if (statusRes.ok) {
                            const statusData = await statusRes.json();

                            // Kiểm tra nếu có video
                            const videoUrl = extractVideoUrl(statusData);
                            if (videoUrl) {
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === tempId
                                            ? {
                                                  id: tempId,
                                                  text: "Video đã tạo xong",
                                                  media: { src: videoUrl, type: "video" },
                                                  sender: "bot",
                                                  timestamp: new Date(),
                                              }
                                            : m
                                    )
                                );
                                setIsProcessing(false);

                                // Save success message to DB
                                fetch("/api/chat/history", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        type: "video",
                                        text: "Video đã tạo xong",
                                        sender: "bot",
                                        timestamp: new Date(),
                                        media: { src: videoUrl, type: "video" },
                                    }),
                                }).catch((e) => console.error("Failed to save success message:", e));

                                return;
                            }

                            // Kiểm tra nếu failed
                            if (statusData?.state === "fail" || statusData?.state === "failed") {
                                const failMsg =
                                    statusData?.raw?.data?.failMsg ||
                                    statusData?.failMsg ||
                                    statusData?.raw?.failMsg ||
                                    "Quá trình tạo video thất bại. Vui lòng thử lại với mô tả khác.";

                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === tempId
                                            ? {
                                                  ...m,
                                                  text: `Lỗi: ${failMsg}`,
                                                  processing: false,
                                              }
                                            : m
                                    )
                                );
                                setIsProcessing(false);

                                // Save failure error to DB
                                fetch("/api/chat/history", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        type: "video",
                                        text: `Lỗi: ${failMsg}`,
                                        sender: "bot",
                                        timestamp: new Date(),
                                    }),
                                }).catch((e) => console.error("Failed to save failure error:", e));

                                return;
                            }
                        }
                    } catch (err) {
                        // Bỏ qua lỗi network, tiếp tục polling
                    }

                    // Chờ trước khi poll lần tiếp theo
                    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                }

                // Hết thời gian timeout
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempId
                            ? {
                                  ...m,
                                  text: "Lỗi: Quá trình tạo video vượt quá 5 phút. Vui lòng thử lại sau.",
                                  processing: false,
                              }
                            : m
                    )
                );
                setIsProcessing(false);
            };

            // Gọi polling function
            pollTaskStatus().catch((err) => {
                console.error("Polling error:", err);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempId
                            ? {
                                  ...m,
                                  text: `Lỗi: ${err.message || "Lỗi khi poll task status"}`,
                                  processing: false,
                              }
                            : m
                    )
                );
                setIsProcessing(false);
            });
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

        setIsUploadingImage(true);

        try {
            // Read file as base64 and show preview immediately
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target?.result as string;

                // Hiển thị preview ngay lập tức với base64
                setUploadedImage({
                    src: base64String,
                    fileName: file.name,
                    size: file.size,
                });

                try {
                    // Upload to Cloudinary in background
                    const uploadRes = await fetch("/api/upload/image", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ imageBase64: base64String }),
                    });

                    if (!uploadRes.ok) {
                        const errorData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
                        throw new Error(errorData.error || "Failed to upload image");
                    }

                    const { url } = await uploadRes.json();

                    // Cập nhật với Cloudinary URL sau khi upload xong
                    setUploadedImage({
                        src: url,
                        fileName: file.name,
                        size: file.size,
                    });
                    setIsUploadingImage(false);
                } catch (uploadError: any) {
                    console.error("Cloudinary upload error:", uploadError);
                    alert(`Lỗi khi upload ảnh: ${uploadError.message || "Vui lòng thử lại"}`);
                    // Xóa preview nếu upload thất bại
                    setUploadedImage(null);
                    setIsUploadingImage(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error processing image:", error);
            alert("Lỗi khi xử lý ảnh. Vui lòng thử lại.");
            setIsUploadingImage(false);
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
                image_url: uploadedImage.src, // Now it's a Cloudinary URL
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
            fetch("/api/chat/history?type=video", { method: "DELETE" });
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
                            <h1 className="text-2xl font-bold text-foreground hidden md:block">Chatbot tạo Video/Ảnh</h1>
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
                            title={isLoading || isProcessing ? "Không thể đăng xuất khi đang tạo video" : "Đăng xuất"}
                            className="gap-1.5"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Đăng xuất</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main id="chat-messages-container" className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto h-full flex flex-col">
                    <MessageList messages={messages} messagesEndRef={messagesEndRef} />
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
                isUploadingImage={isUploadingImage}
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
