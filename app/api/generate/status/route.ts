import { NextRequest, NextResponse } from "next/server";
import { fetchTaskInfo } from "@/backend/generate-service";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get("taskId");
        if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

        const info = await fetchTaskInfo(taskId);
        return NextResponse.json(info);
    } catch (err: any) {
        console.error("/api/generate/status error", err);
        return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
    }
}
