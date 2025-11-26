import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { Message } from "@/modules/video/types";
import { downloadMedia } from "@/modules/video/utils/media-utils";
import { cn } from "@/lib/utils";
import { AnimatedEllipsis } from "./ui/animated-ellipsis";

interface MessageItemProps {
    message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
    const isUser = message.sender === "user";
    const isBot = message.sender === "bot";
    const isError = message.text?.startsWith("Lỗi:");
    const isProcessing = message.processing === true;

    return (
        <div className={cn("flex w-full flex-col gap-2", isUser ? "items-end" : "items-start")}>
            <div
                className={cn(
                    "relative max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[75%]",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : isError
                        ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-none"
                        : isProcessing
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-bl-none"
                        : "bg-muted/50 text-foreground border border-border/50 rounded-bl-none"
                )}
            >
                {/* Image attachment */}
                {message.image && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-border/50 bg-background/50">
                        <img src={message.image.src} alt="Uploaded" className="max-h-64 w-full object-contain" />
                    </div>
                )}

                {/* Text Content */}
                {message.text && (
                    <div className={cn("leading-relaxed whitespace-pre-wrap break-words", isError && "flex items-start gap-2 font-medium")}>
                        {isError && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                        <span>{message.text}</span>
                        {message.processing && <AnimatedEllipsis />}
                    </div>
                )}

                {/* Video/Media Attachment */}
                {message.media && message.media.type === "video" && (
                    <div className="mt-3 space-y-2">
                        <div className="relative overflow-hidden rounded-lg border border-border bg-black shadow-inner">
                            <video
                                src={message.media.src}
                                controls
                                className="max-h-[400px] w-full"
                                poster={message.image?.src}
                                playsInline
                                preload="metadata"
                            />
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full gap-2 bg-background/80 hover:bg-background shadow-sm transition-all"
                            onClick={() => message.media && downloadMedia(message.media.src, `video-${Date.now()}.mp4`)}
                        >
                            <Download className="h-4 w-4" />
                            Tải video xuống
                        </Button>
                    </div>
                )}

                {/* Image Attachment (Result) */}
                {message.media && message.media.type === "image" && (
                    <div className="mt-3 space-y-2">
                        <div className="relative overflow-hidden rounded-lg border border-border bg-background/50">
                            <img src={message.media.src} alt="Generated" className="max-h-96 w-full object-contain" />
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full gap-2 bg-background/80 hover:bg-background shadow-sm transition-all"
                            onClick={() => message.media && downloadMedia(message.media.src, `image-${Date.now()}.png`)}
                        >
                            <Download className="h-4 w-4" />
                            Tải ảnh xuống
                        </Button>
                    </div>
                )}
            </div>
            <div className="px-1 text-[10px] text-muted-foreground/60">
                {`${message.timestamp.getDate().toString().padStart(2, "0")}/${(message.timestamp.getMonth() + 1)
                    .toString()
                    .padStart(2, "0")} ${message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`}
            </div>
        </div>
    );
}
