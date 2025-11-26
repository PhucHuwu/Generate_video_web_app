import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, ZoomIn } from "lucide-react";
import { Message } from "@/modules/video/types";
import { downloadMedia } from "@/modules/video/utils/media-utils";
import { cn } from "@/lib/utils";
import { AnimatedEllipsis } from "./ui/animated-ellipsis";

interface MessageItemProps {
    message: Message;
    onViewImage?: (mediaList: { type: "image" | "video"; src: string }[], index: number) => void;
}

export function MessageItem({ message, onViewImage }: MessageItemProps) {
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

                {/* Image Attachment (Result) - Single or Grid */}
                {(message.media?.type === "image" || (message.mediaList && message.mediaList.length > 0)) && (
                    <div className="mt-3 space-y-2">
                        {message.mediaList && message.mediaList.length > 1 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {message.mediaList.map((media, idx) => (
                                    <div key={idx} className="relative group overflow-hidden rounded-lg border border-border bg-background/50 aspect-square">
                                        <img
                                            src={media.src}
                                            alt={`Generated ${idx + 1}`}
                                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onViewImage && message.mediaList) {
                                                    onViewImage(message.mediaList, idx);
                                                } else {
                                                    window.open(media.src, "_blank");
                                                }
                                            }}
                                        />
                                        {/* Download Button - Always visible on mobile, visible on hover on desktop */}
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-background/80 hover:bg-background shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadMedia(media.src, `image-${Date.now()}-${idx}.png`);
                                            }}
                                            title="Tải xuống"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="relative overflow-hidden rounded-lg border border-border bg-background/50">
                                <img
                                    src={message.media?.src || message.mediaList?.[0]?.src || ""}
                                    alt="Generated"
                                    className="max-h-96 w-full object-contain cursor-pointer"
                                    onClick={() => {
                                        if (onViewImage) {
                                            const src = message.media?.src || message.mediaList?.[0]?.src;
                                            if (src) {
                                                onViewImage([{ type: "image", src }], 0);
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {(!message.mediaList || message.mediaList.length <= 1) && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full gap-2 bg-background/80 hover:bg-background shadow-sm transition-all"
                                onClick={() => {
                                    const src = message.media?.src || message.mediaList?.[0]?.src;
                                    if (src) downloadMedia(src, `image-${Date.now()}.png`);
                                }}
                            >
                                <Download className="h-4 w-4" />
                                Tải ảnh xuống
                            </Button>
                        )}
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
