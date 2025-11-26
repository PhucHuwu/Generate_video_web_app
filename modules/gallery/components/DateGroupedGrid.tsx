"use client";

import React from "react";
import { Play } from "lucide-react";
import { DateGroup, MediaItem } from "../types";

interface DateGroupedGridProps {
    groups: DateGroup[];
    onMediaClick: (item: MediaItem, globalIndex: number) => void;
}

export function DateGroupedGrid({ groups, onMediaClick }: DateGroupedGridProps) {
    // Calculate global index for lightbox navigation
    let globalIndex = 0;

    return (
        <div className="space-y-6">
            {groups.map((group, groupIdx) => (
                <div key={`${group.date}-${groupIdx}`}>
                    {/* Date Header */}
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">{group.date}</h3>

                    {/* Grid of thumbnails */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-2">
                        {group.items.map((item) => {
                            const itemGlobalIndex = globalIndex++;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onMediaClick(item, itemGlobalIndex)}
                                    className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all group"
                                >
                                    {item.mediaType === "video" ? (
                                        <>
                                            <video src={item.mediaUrl} className="w-full h-full object-cover" preload="metadata" />
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                                <Play className="h-8 w-8 text-white drop-shadow-lg" />
                                            </div>
                                        </>
                                    ) : (
                                        <img src={item.mediaUrl} alt={item.text} className="w-full h-full object-cover" loading="lazy" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
