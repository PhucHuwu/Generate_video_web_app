"use client";

import React, { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaItem } from "../types";
import { downloadMedia } from "@/modules/video/utils/media-utils";

interface MediaLightboxProps {
    media: MediaItem[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

export function MediaLightbox({ media, currentIndex, onClose, onNavigate }: MediaLightboxProps) {
    const currentItem = media[currentIndex];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowLeft" && currentIndex > 0) {
                onNavigate(currentIndex - 1);
            } else if (e.key === "ArrowRight" && currentIndex < media.length - 1) {
                onNavigate(currentIndex + 1);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, media.length, onClose, onNavigate]);

    if (!currentItem) return null;

    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < media.length - 1;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
            <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-10" onClick={onClose}>
                    <X className="h-6 w-6" />
                </Button>

                {/* Download Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-16 text-white hover:bg-white/20 z-10"
                    onClick={() => downloadMedia(currentItem.mediaUrl, `image-${Date.now()}.png`)}
                    title="Tải xuống"
                >
                    <Download className="h-6 w-6" />
                </Button>

                {/* Previous Button */}
                {hasPrevious && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
                        onClick={() => onNavigate(currentIndex - 1)}
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                )}

                {/* Next Button */}
                {hasNext && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
                        onClick={() => onNavigate(currentIndex + 1)}
                    >
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                )}

                {/* Media Content */}
                <div className="flex flex-col items-center justify-center max-w-7xl w-full">
                    {currentItem.mediaType === "video" ? (
                        <video src={currentItem.mediaUrl} controls autoPlay className="max-w-full max-h-[70vh] rounded-lg" />
                    ) : (
                        <img src={currentItem.mediaUrl} alt={currentItem.text} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
                    )}

                    {/* Info Section */}
                    <div className="mt-4 text-center max-w-3xl">
                        <p className="text-white text-sm mb-2">{currentItem.text}</p>
                        <p className="text-white/60 text-xs">
                            {currentIndex + 1} / {media.length}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
