"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NativeConfirmProps {
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function NativeConfirm({
    open,
    title = "Xác nhận",
    description = "Bạn có chắc không?",
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy",
    onConfirm,
    onCancel,
}: NativeConfirmProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
            <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-md p-4">
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1 text-red-500">{title}</h3>
                        <div className="text-sm text-muted-foreground mb-4">{description}</div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button variant="destructive" className="bg-red-500 hover:bg-red-400 dark:bg-red-500 dark:hover:bg-red-400 text-white" onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
