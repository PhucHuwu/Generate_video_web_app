import React from "react";
import { cn } from "@/lib/utils";
import { Video, Image } from "lucide-react";

interface ModeToggleProps {
    currentMode: "video" | "image";
    onToggle: () => void;
}

export function ModeToggle({ currentMode, onToggle }: ModeToggleProps) {
    return (
        <button
            onClick={onToggle}
            className="relative inline-flex items-center h-8 rounded-full bg-muted p-1 transition-all hover:bg-muted/80"
            aria-label="Toggle mode"
        >
            <div
                className={cn(
                    "absolute h-6 rounded-full bg-primary transition-all duration-200 ease-in-out",
                    // Mobile: icon-only width
                    currentMode === "video" ? "left-1 w-8 sm:w-[72px]" : "left-9 sm:left-[77px] w-8 sm:w-[60px]"
                )}
            />
            <div className="relative flex items-center gap-1 px-2 sm:px-3 z-10">
                <Video className="h-3.5 w-3.5 shrink-0" />
                <span
                    className={cn(
                        "hidden sm:inline text-xs font-medium transition-colors",
                        currentMode === "video" ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                >
                    Video
                </span>
            </div>
            <div className="relative flex items-center gap-1 px-2 sm:px-3 z-10">
                <Image className="h-3.5 w-3.5 shrink-0" />
                <span
                    className={cn(
                        "hidden sm:inline text-xs font-medium transition-colors",
                        currentMode === "image" ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                >
                    Ảnh
                </span>
            </div>
        </button>
    );
}
