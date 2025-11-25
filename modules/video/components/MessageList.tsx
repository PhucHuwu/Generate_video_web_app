import React from "react";
import { Message } from "@/modules/video/types";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function MessageList({ messages, messagesEndRef }: MessageListProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
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
