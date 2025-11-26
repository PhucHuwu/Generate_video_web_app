import { Button } from "@/components/ui/button";
import { Send, Upload, Trash, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface InputAreaProps {
    input: string;
    setInput: (val: string) => void;
    uploadedImage?: { src: string; fileName: string; size: number } | null;
    onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearImage?: () => void;
    onSend: (e: React.FormEvent) => void;
    isLoading: boolean;
    isUploadingImage?: boolean;
    isGeneratingPrompt?: boolean;
    onGeneratePrompt?: () => void;
    onRandomPrompt?: () => void;
    onSettingsClick?: () => void;
    fileInputRef?: React.RefObject<HTMLInputElement | null>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    credits?: number | null;
}

export function InputArea({
    input,
    setInput,
    uploadedImage,
    onImageUpload,
    onClearImage,
    onSend,
    isLoading,
    isUploadingImage,
    isGeneratingPrompt,
    onGeneratePrompt,
    onRandomPrompt,
    onSettingsClick,
    fileInputRef,
    textareaRef,
    credits,
}: InputAreaProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend(e as any);
        }
    };

    // Auto-resize textarea based on content
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        el.style.height = "auto";
        const maxHeight = 200; // Max height in pixels

        if (el.scrollHeight > maxHeight) {
            el.style.height = `${maxHeight}px`;
            el.style.overflowY = "auto";
        } else {
            el.style.height = `${el.scrollHeight}px`;
            el.style.overflowY = "hidden";
        }
    }, [input, textareaRef]);

    return (
        <div className="border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto max-w-3xl">
                {/* Image Preview */}
                {uploadedImage && onClearImage && (
                    <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3 animate-in slide-in-from-bottom-2">
                        <div className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                            <img src={uploadedImage.src} alt="Preview" className="h-full w-full object-cover" />
                            {/* Loading overlay khi đang upload */}
                            {isUploadingImage && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium">{uploadedImage.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                                {isUploadingImage ? (
                                    <span className="text-primary">Đang tải lên...</span>
                                ) : (
                                    `${(uploadedImage.size / 1024 / 1024).toFixed(2)} MB`
                                )}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClearImage}
                            className="text-muted-foreground hover:text-destructive"
                            disabled={isUploadingImage}
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <form onSubmit={onSend} className="relative flex gap-3 items-end">
                    <input type="file" ref={fileInputRef} onChange={onImageUpload} accept="image/*" className="hidden" />
                    {onImageUpload && fileInputRef && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 shrink-0 rounded-xl"
                            onClick={() => fileInputRef?.current?.click()}
                            disabled={isLoading}
                        >
                            <Upload className="h-5 w-5" />
                        </Button>
                    )}

                    <div className="relative flex-1">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Mô tả video bạn muốn tạo..."
                            className="flex min-h-[48px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            rows={1}
                            disabled={isLoading}
                        />
                        {uploadedImage && !input && onGeneratePrompt && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-2 h-8 gap-1.5 text-xs bg-gradient-to-r from-[#8AB4F8] via-[#C58AF9] to-[#F48FB1] text-white hover:opacity-90 disabled:opacity-50"
                                onClick={onGeneratePrompt}
                                disabled={isGeneratingPrompt || isLoading}
                            >
                                <Sparkles className="h-3 w-3" />
                                {isGeneratingPrompt ? "Đang tạo..." : "Gen Prompt"}
                            </Button>
                        )}
                        {!uploadedImage && !input && onRandomPrompt && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-2 h-8 gap-1.5 text-xs bg-gradient-to-r from-[#8AB4F8] via-[#C58AF9] to-[#F48FB1] text-white hover:opacity-90 disabled:opacity-50"
                                onClick={onRandomPrompt}
                                disabled={isGeneratingPrompt || isLoading}
                            >
                                <Sparkles className="h-3 w-3" />
                                {isGeneratingPrompt ? "Đang tạo..." : "Gen Prompt"}
                            </Button>
                        )}
                    </div>

                    <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-xl" disabled={isLoading || (!input && !uploadedImage)}>
                        <Send className="h-5 w-5" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
