"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaItem } from "../types";
import { groupByDate } from "../utils/dateUtils";
import { DateGroupedGrid } from "./DateGroupedGrid";
import { MediaLightbox } from "./MediaLightbox";

interface GallerySidebarProps {
    type: "image" | "video";
    isOpen: boolean;
    onToggle: () => void;
}

export function GallerySidebar({ type, isOpen, onToggle }: GallerySidebarProps) {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    useEffect(() => {
        fetchMedia();
    }, [type]);

    const fetchMedia = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/gallery?type=${type}`);
            if (!res.ok) {
                throw new Error("Failed to fetch media");
            }

            const data = await res.json();
            setMedia(
                data.media.map((item: any) => ({
                    ...item,
                    timestamp: new Date(item.timestamp),
                }))
            );
        } catch (err: any) {
            console.error("Failed to fetch gallery:", err);
            setError(err.message || "Failed to load gallery");
        } finally {
            setIsLoading(false);
        }
    };

    const handleMediaClick = (item: MediaItem, index: number) => {
        setSelectedIndex(index);
    };

    const handleCloseLightbox = () => {
        setSelectedIndex(null);
    };

    const handleNavigate = (index: number) => {
        setSelectedIndex(index);
    };

    const dateGroups = groupByDate(media);

    return (
        <>
            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:relative top-0 left-0 h-full
                    bg-card border-r border-border
                    transition-transform duration-300 ease-in-out
                    z-20
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                    ${isOpen ? "w-80" : "w-0 lg:w-80"}
                    overflow-hidden
                `}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {type === "video" ? <Video className="h-5 w-5 text-primary" /> : <ImageIcon className="h-5 w-5 text-primary" />}
                            <h2 className="font-semibold text-foreground">{type === "video" ? "Video Gallery" : "Image Gallery"}</h2>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onToggle} className="lg:hidden" title="Đóng gallery">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-sm text-muted-foreground">Đang tải...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                <p className="text-sm text-destructive mb-2">Lỗi: {error}</p>
                                <Button size="sm" variant="outline" onClick={fetchMedia}>
                                    Thử lại
                                </Button>
                            </div>
                        ) : media.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                {type === "video" ? (
                                    <Video className="h-12 w-12 text-muted-foreground/50 mb-2" />
                                ) : (
                                    <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-2" />
                                )}
                                <p className="text-sm text-muted-foreground">
                                    {type === "video" ? "Chưa có video nào. Hãy tạo video đầu tiên!" : "Chưa có ảnh nào. Hãy tạo ảnh đầu tiên!"}
                                </p>
                            </div>
                        ) : (
                            <DateGroupedGrid groups={dateGroups} onMediaClick={handleMediaClick} />
                        )}
                    </div>
                </div>
            </aside>

            {/* Lightbox */}
            {selectedIndex !== null && <MediaLightbox media={media} currentIndex={selectedIndex} onClose={handleCloseLightbox} onNavigate={handleNavigate} />}
        </>
    );
}
