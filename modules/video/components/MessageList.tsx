import React from "react";
import { Message } from "@/modules/video/types";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    hasMoreHistory?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
}

export function MessageList({ messages, messagesEndRef, hasMoreHistory, isLoadingMore, onLoadMore }: MessageListProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
            {hasMoreHistory && onLoadMore && (
                <div className="flex justify-center mb-4">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="px-4 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoadingMore ? "Đang tải..." : "Tải thêm tin nhắn cũ"}
                    </button>
                </div>
            )}
            {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in duration-500">
                    <div className="mb-4 rounded-full bg-muted/50 p-6">
                        {/* Assuming icon.svg is in public folder */}
                        <img src="/icon.svg" alt="Logo" className="h-12 w-12 opacity-50 grayscale" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground/80">Chưa có tin nhắn nào</h3>
                    <p className="max-w-xs text-sm">Tải lên một bức ảnh và nhập mô tả để bắt đầu tạo video.</p>
                </div>
            ) : (
                messages.map((message) => <MessageItem key={message.id} message={message} />)
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}
