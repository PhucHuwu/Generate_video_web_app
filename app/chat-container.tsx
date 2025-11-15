"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Send,
    Upload,
    Sun,
    Moon,
    Settings,
    Trash,
    Sparkles,
    Download,
} from "lucide-react";
import { useTheme } from "@/components/theme-toggle-provider";
import NativeConfirm from "@/components/ui/native-confirm";

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
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [credits, setCredits] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(false);
    const [creditsError, setCreditsError] = useState<string | null>(null);
    // Track if component has mounted on client to avoid hydration mismatch
    const [isClient, setIsClient] = useState(false);
    // Track if we've loaded chat history from localStorage (to prevent overwriting on mount)
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
    // Check authentication with the backend; frontend only calls the API
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
        // fetch credits on mount
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
                const msg =
                    parsed?.msg || parsed?.error || txt || `HTTP ${res.status}`;
                setCredits(null);
                setCreditsError(String(msg));
                return;
            }

            // Expected shape: { code: 200, msg: 'success', data: 100 }
            const dataVal = parsed?.data ?? parsed;
            const value =
                typeof dataVal === "number" ? dataVal : Number(dataVal);
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
    const STORAGE_KEY = "chat_history_v1";
    // Start with empty messages to match server-side render
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [input, setInput] = useState("");
    const [uploadedImage, setUploadedImage] = useState<{
        src: string;
        fileName: string;
        size: number;
    } | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<{
        googleApiKey?: string;
        openrouterApiKey?: string;
        groqApiKey?: string;
    }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // maximum height in pixels for the prompt textarea before internal scrolling
    const TEXTAREA_MAX_HEIGHT = 240;
    // removed fake streaming timers

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

    // fake thinking stream removed — server now returns description/groqOutput directly

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-adjust textarea height when `input` changes programmatically (e.g., cleared on submit)
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

    // cleanup on unmount (no fake timers to clear)
    useEffect(() => {
        return () => {};
    }, []);

    // Load chat history and API keys on mount (client-side only to avoid hydration mismatch)
    useEffect(() => {
        setIsClient(true);
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Validate that parsed data is an array before mapping
                if (Array.isArray(parsed)) {
                    const restored: Message[] = parsed.map((m) => ({
                        ...m,
                        timestamp: m.timestamp
                            ? new Date(m.timestamp)
                            : new Date(),
                    }));
                    setMessages(restored);
                } else {
                    console.warn(
                        "Invalid chat history format (not an array), clearing storage"
                    );
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.warn("Failed to load chat history:", e);
            // If parsing fails, clear corrupted data
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (removeErr) {
                // ignore
            }
        }
        try {
            const s = localStorage.getItem("api_keys_v1");
            if (s) setSettings(JSON.parse(s));
        } catch (e) {
            // ignore
        }
        // Mark that we've loaded history to prevent overwriting on mount
        setHasLoadedHistory(true);
    }, []);

    // Persist chat history to localStorage whenever messages change (but not on initial mount)
    useEffect(() => {
        // Don't save until we've loaded the history first to avoid overwriting with empty array
        if (!hasLoadedHistory) return;

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
    }, [messages, hasLoadedHistory]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        // Require an image and a prompt for all requests; disallow prompt-only submissions
        if (!uploadedImage) {
            alert(
                "Vui lòng chọn ảnh (bắt buộc). Trường hợp chỉ nhập prompt không được hỗ trợ."
            );
            return;
        }

        if (!input || input.trim() === "") {
            alert(
                "Vui lòng tạo hoặc nhập mô tả trước khi bắt đầu tạo video. Nhấn 'Gen Prompt' để sinh mô tả từ ảnh."
            );
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
        // Capture image info before clearing preview so we can send it in the request
        const imageToSend = uploadedImage
            ? {
                  src: uploadedImage.src,
                  fileName: uploadedImage.fileName,
              }
            : undefined;
        // Clear the small preview immediately when the user sends the message
        setUploadedImage(null);
        setInput("");
        setIsLoading(true);

        try {
            // Call our backend generate endpoint which handles the external API and polling
            const body: any = { prompt: input };
            // Use captured image data (we cleared `uploadedImage` above)
            if (imageToSend) {
                body.imageBase64 = imageToSend.src;
                body.fileName = imageToSend.fileName;
            }
            // Include optional API key overrides from settings (if set)
            if (settings.googleApiKey)
                body.googleApiKey = settings.googleApiKey;
            if (settings.openrouterApiKey)
                body.openrouterApiKey = settings.openrouterApiKey;
            if (settings.groqApiKey) body.groqApiKey = settings.groqApiKey;

            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                // Try to extract a useful error message from the body
                const txt = await response.text().catch(() => "");
                let friendlyRaw = txt || `Status ${response.status}`;
                let parsed: any = undefined;
                try {
                    parsed = JSON.parse(txt || "{}");
                } catch (e) {
                    // ignore
                }

                // Extract possible KIE code and message from known shapes
                const code =
                    parsed?.code ||
                    parsed?.createResp?.code ||
                    parsed?.raw?.code ||
                    parsed?.data?.code;
                const rawMsg =
                    parsed?.error ||
                    parsed?.msg ||
                    parsed?.createResp?.msg ||
                    parsed?.raw?.msg ||
                    friendlyRaw;

                // Map known KIE status codes to friendly Vietnamese messages
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
                if (
                    parsed &&
                    typeof parsed.error === "string" &&
                    parsed.error.trim().startsWith("Lỗi")
                ) {
                    // The server already returned a localized 'Lỗi ...' message — use it verbatim
                    friendly = parsed.error;
                } else if (typeof code === "number" && kieCodeMap[code]) {
                    friendly =
                        `Lỗi ${code}: ${kieCodeMap[code]}` +
                        (rawMsg ? ` (${rawMsg})` : "");
                } else if (parsed && (parsed.error || parsed.msg)) {
                    friendly = parsed.error || parsed.msg;
                }

                const botText =
                    typeof friendly === "string" &&
                    friendly.trim().startsWith("Lỗi")
                        ? friendly
                        : `Lỗi: ${friendly}`;

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
                    text: "Đang tạo video — quá trình có thể mất khoảng 3 - 5 phút. Vui lòng chờ trong giây lát. Vui lòng không đóng hay tải lại trang này",
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

                // no fake thinking stream — server returns description/groq directly

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
                                                  // collapse thinking when finished
                                                  collapsed: true,
                                              }
                                            : undefined,
                                };

                                // no fake-stream timers to clear

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
                                                  collapsed: true,
                                              }
                                            : undefined,
                                };

                                // no fake-stream timers to clear

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
        } catch (error: any) {
            console.error("Error sending message:", error);
            let friendly =
                (error && error.message) ||
                "Không nhận được phản hồi từ dịch vụ.";

            // If the error message contains a JSON response, try to extract code/msg
            try {
                const jsonMatch = String(friendly).match(/(\{[\s\S]*\})/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[1]);
                    const code = parsed?.code || parsed?.createResp?.code;
                    const rawMsg =
                        parsed?.msg ||
                        parsed?.error ||
                        parsed?.createResp?.msg ||
                        parsed?.raw?.msg;
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
                        friendly =
                            `Lỗi ${code}: ${kieCodeMap[code]}` +
                            (rawMsg ? ` (${rawMsg})` : "");
                    } else if (rawMsg) {
                        friendly = String(rawMsg);
                    }
                }
            } catch (e) {
                // ignore parse errors
            }

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

    // Download media (video) helper: try fetch->blob then fallback to opening in new tab
    const downloadMedia = async (url: string) => {
        if (!url) return;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Network response not ok");
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            try {
                const pathname = new URL(url).pathname;
                a.download = pathname.split("/").pop() || "video.mp4";
            } catch (e) {
                a.download = "video.mp4";
            }
            document.body.appendChild(a);
            a.click();
            a.remove();
            // revoke after a short delay to ensure download started
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err) {
            // Fallback: open in new tab so user can manually save
            try {
                window.open(url, "_blank", "noopener,noreferrer");
            } catch (e) {
                console.error("Failed to download or open media:", e);
            }
        }
    };

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    // Perform the actual clearing of chat history (no confirmation here)
    const doClearHistory = () => {
        setMessages([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // ignore
        }
        // After clearing, we need to allow saving again
        setHasLoadedHistory(true);
        setIsConfirmOpen(false);
    };

    // Perform logout (called after user confirms)
    const doLogout = async () => {
        // Prevent logout if we're in the middle of creating a video
        if (isLoading || isProcessing) {
            setIsLogoutConfirmOpen(false);
            try {
                // fallback simple notification
                alert(
                    "Không thể đăng xuất khi đang tạo video. Vui lòng đợi quá trình hoàn tất."
                );
            } catch (e) {}
            return;
        }

        setIsLogoutConfirmOpen(false);
        try {
            await fetch("/api/logout", { method: "POST" });
        } catch (e) {
            // ignore errors
        } finally {
            // Note: không xóa localStorage để giữ lịch sử chat khi đăng nhập lại
            router.replace("/login");
        }
    };

    // Open the confirmation dialog (replaces native window.confirm)
    const clearHistory = () => {
        setIsConfirmOpen(true);
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            Chatbot tạo video
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Tạo video từ mô tả văn bản và ảnh
                        </p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={fetchCredits}
                                disabled={isFetchingCredits}
                                title={
                                    creditsError
                                        ? `Lỗi: ${creditsError}`
                                        : "Lấy số dư hiện tại"
                                }
                            >
                                <span className="text-sm">
                                    {isFetchingCredits ? (
                                        <span className="inline-flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                                            <span>$...</span>
                                        </span>
                                    ) : credits === null ? (
                                        <span>$-</span>
                                    ) : (
                                        <span>${credits}</span>
                                    )}
                                </span>
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={toggleTheme}
                                title={
                                    theme === "light"
                                        ? "Chuyển sang chế độ tối"
                                        : "Chuyển sang chế độ sáng"
                                }
                            >
                                {theme === "light" ? (
                                    <Moon className="h-4 w-4" />
                                ) : (
                                    <Sun className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsSettingsOpen(true)}
                                title="Cài đặt API Keys"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={clearHistory}
                                disabled={
                                    messages.length === 0 ||
                                    isLoading ||
                                    isProcessing
                                }
                                title="Xóa lịch sử chat"
                            >
                                <Trash className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsLogoutConfirmOpen(true)}
                                disabled={isLoading || isProcessing}
                                title={
                                    isLoading || isProcessing
                                        ? "Không thể đăng xuất khi đang tạo video"
                                        : undefined
                                }
                            >
                                Đăng xuất
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Messages Container */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-4 space-y-4">
                    {isClient && messages.length === 0 && (
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
                                                    {message.thinking
                                                        .description && (
                                                        <div>
                                                            <div className="font-semibold text-xs">
                                                                Tôi sẽ phân tích
                                                                bức ảnh trước
                                                                tiên
                                                            </div>
                                                            <div className="whitespace-pre-wrap">
                                                                {
                                                                    message
                                                                        .thinking
                                                                        .description
                                                                }
                                                            </div>
                                                        </div>
                                                    )}
                                                    {message.thinking
                                                        .groqOutput && (
                                                        <div>
                                                            <div className="font-semibold text-xs">
                                                                Gợi ý hành động
                                                                tiếp theo
                                                            </div>
                                                            <div className="whitespace-pre-wrap">
                                                                {
                                                                    message
                                                                        .thinking
                                                                        .groqOutput
                                                                }
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
                                                <div className="mt-2 flex items-center justify-between">
                                                    <p className="text-xs opacity-70">
                                                        Video kết quả
                                                    </p>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            downloadMedia(
                                                                message.media!
                                                                    .src
                                                            )
                                                        }
                                                        aria-label="Tải xuống video"
                                                    >
                                                        <Download
                                                            className="w-4 h-4"
                                                            aria-hidden
                                                        />
                                                    </Button>
                                                </div>
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
                    {/* delete button moved to header next to theme toggle */}
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
                    {/* Gen Prompt will be shown next to the send button */}
                    <form
                        onSubmit={handleSendMessage}
                        className="flex gap-2 items-center"
                    >
                        <div className="flex items-center">
                            <Button
                                type="button"
                                disabled={isLoading || isProcessing}
                                size="icon"
                                className="bg-muted-foreground hover:bg-muted-foreground/90"
                                onClick={() => fileInputRef.current?.click()}
                                title="Upload ảnh"
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
                        </div>

                        <div className="relative flex-1">
                            <textarea
                                ref={textareaRef}
                                placeholder={
                                    isGeneratingPrompt
                                        ? ""
                                        : "Nhập mô tả (bắt buộc kèm ảnh)..."
                                }
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onInput={() => {
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
                                }}
                                disabled={isLoading || isProcessing}
                                className="w-full resize-none overflow-hidden rounded-md border border-border px-3 py-2 bg-transparent focus:outline-none"
                            />

                            {isGeneratingPrompt &&
                                (!input || input.trim() === "") && (
                                    <div className="absolute inset-0 flex items-start pl-3 pt-2 pointer-events-none text-muted-foreground">
                                        <span className="whitespace-pre">
                                            Đang tạo prompt từ ảnh
                                        </span>
                                        <span className="ml-1 inline-block">
                                            <AnimatedEllipsis />
                                        </span>
                                    </div>
                                )}
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <Button
                                size="sm"
                                onClick={async () => {
                                    if (!uploadedImage) return;
                                    setIsGeneratingPrompt(true);
                                    try {
                                        const body: any = {
                                            imageBase64: uploadedImage.src,
                                        };
                                        if (settings.googleApiKey)
                                            body.googleApiKey =
                                                settings.googleApiKey;
                                        if (settings.openrouterApiKey)
                                            body.openrouterApiKey =
                                                settings.openrouterApiKey;
                                        if (settings.groqApiKey)
                                            body.groqApiKey =
                                                settings.groqApiKey;

                                        const res = await fetch(
                                            "/api/describe",
                                            {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type":
                                                        "application/json",
                                                },
                                                body: JSON.stringify(body),
                                            }
                                        );

                                        if (!res.ok) {
                                            const txt = await res
                                                .text()
                                                .catch(() => "");
                                            // Try to extract a friendly message from JSON if possible
                                            let friendly = txt;
                                            try {
                                                const parsed = JSON.parse(
                                                    txt || "{}"
                                                );
                                                if (parsed?.error)
                                                    friendly = parsed.error;
                                            } catch (e) {
                                                // leave friendly as raw text
                                            }
                                            console.error(
                                                "Describe failed:",
                                                res.status,
                                                friendly
                                            );
                                            alert(
                                                `Lỗi khi sinh prompt: ${friendly}`
                                            );
                                            return;
                                        }

                                        const data = await res.json();
                                        const suggested =
                                            data?.groqOutput ||
                                            data?.description ||
                                            "";
                                        setInput(suggested);
                                        textareaRef.current?.focus();
                                    } catch (err) {
                                        console.error("Gen Prompt error:", err);
                                        alert(
                                            "Lỗi khi sinh prompt từ ảnh. Vui lòng thử lại."
                                        );
                                    } finally {
                                        setIsGeneratingPrompt(false);
                                    }
                                }}
                                disabled={
                                    isGeneratingPrompt ||
                                    isProcessing ||
                                    !uploadedImage
                                }
                                title={
                                    !uploadedImage
                                        ? "Vui lòng upload ảnh trước khi sinh prompt"
                                        : "Sinh prompt từ ảnh"
                                }
                                className="bg-gradient-to-r from-[#8AB4F8] via-[#C58AF9] to-[#F48FB1] text-white hover:opacity-90 disabled:opacity-50"
                            >
                                <span className="sr-only">Gen Prompt</span>
                                <Sparkles className="w-4 h-4" aria-hidden />
                            </Button>

                            <Button
                                type="submit"
                                disabled={
                                    isLoading ||
                                    isProcessing ||
                                    isGeneratingPrompt ||
                                    !uploadedImage ||
                                    !input ||
                                    input.trim() === ""
                                }
                                size="icon"
                                className="bg-primary hover:bg-primary/90"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </form>
                    {/* Settings modal */}
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center">
                            <div
                                className="absolute inset-0 bg-black/40"
                                onClick={() => setIsSettingsOpen(false)}
                            />
                            <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-md p-4">
                                <h3 className="text-lg font-semibold mb-2">
                                    Cài đặt API Keys
                                </h3>
                                <p className="text-xs text-amber-600 mb-2">
                                    Lưu ý: API sẽ được lưu trên browser storage
                                    (localStorage). Chỉ nhập API Key miễn phí
                                    hoặc key mà bạn sẵn sàng để lộ.
                                </p>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-xs">
                                            GEMINI_API_KEY
                                        </label>
                                        <Input
                                            value={settings.googleApiKey || ""}
                                            onChange={(e) =>
                                                setSettings((s) => ({
                                                    ...s,
                                                    googleApiKey:
                                                        e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs">
                                            OPENROUTER_API_KEY
                                        </label>
                                        <Input
                                            value={
                                                settings.openrouterApiKey || ""
                                            }
                                            onChange={(e) =>
                                                setSettings((s) => ({
                                                    ...s,
                                                    openrouterApiKey:
                                                        e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs">
                                            GROQ_API_KEY
                                        </label>
                                        <Input
                                            value={settings.groqApiKey || ""}
                                            onChange={(e) =>
                                                setSettings((s) => ({
                                                    ...s,
                                                    groqApiKey: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            // revert to persisted values
                                            try {
                                                const s =
                                                    localStorage.getItem(
                                                        "api_keys_v1"
                                                    );
                                                if (s)
                                                    setSettings(JSON.parse(s));
                                                else setSettings({});
                                            } catch (e) {
                                                setSettings({});
                                            }
                                            setIsSettingsOpen(false);
                                        }}
                                    >
                                        Hủy
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            try {
                                                localStorage.setItem(
                                                    "api_keys_v1",
                                                    JSON.stringify(
                                                        settings || {}
                                                    )
                                                );
                                            } catch (e) {
                                                console.error(
                                                    "Failed to save API keys",
                                                    e
                                                );
                                            }
                                            setIsSettingsOpen(false);
                                        }}
                                    >
                                        Lưu
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {isConfirmOpen && (
                        <NativeConfirm
                            open={isConfirmOpen}
                            title="Xóa lịch sử chat"
                            description="Bạn có chắc muốn xóa toàn bộ lịch sử chat? Hành động này không thể hoàn tác."
                            confirmLabel="Xóa"
                            cancelLabel="Hủy"
                            onConfirm={doClearHistory}
                            onCancel={() => setIsConfirmOpen(false)}
                        />
                    )}
                    {isLogoutConfirmOpen && (
                        <NativeConfirm
                            open={isLogoutConfirmOpen}
                            title="Đăng xuất"
                            description="Bạn có chắc muốn đăng xuất khỏi tài khoản hiện tại? Bạn sẽ cần đăng nhập lại để tiếp tục."
                            confirmLabel="Đăng xuất"
                            cancelLabel="Hủy"
                            onConfirm={doLogout}
                            onCancel={() => setIsLogoutConfirmOpen(false)}
                        />
                    )}
                </div>
            </footer>
        </div>
    );
}
