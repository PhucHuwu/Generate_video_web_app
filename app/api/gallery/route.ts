import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
    const cookie = req.cookies.get("auth_ts");
    if (!cookie) return false;

    const ts = parseInt(cookie.value, 10);
    if (isNaN(ts)) return false;

    const SESSION_MS = 4 * 60 * 60 * 1000; // 4 hours
    if (Date.now() - ts > SESSION_MS) return false;

    return true;
}

export async function GET(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const limitParam = searchParams.get("limit");

    if (!type || (type !== "image" && type !== "video")) {
        return NextResponse.json({ error: "Type is required and must be 'image' or 'video'" }, { status: 400 });
    }

    // Default limit to 50
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Validate limit
    if (isNaN(limit) || limit <= 0 || limit > 200) {
        return NextResponse.json({ error: "Invalid limit. Must be between 1 and 200" }, { status: 400 });
    }

    try {
        // Fetch media items from database
        const messages = await prisma.chatMessage.findMany({
            where: {
                type,
                mediaUrl: { not: null },
                sender: "bot", // Only bot messages (generated media)
            },
            orderBy: { timestamp: "desc" }, // Newest first
            take: limit,
            select: {
                id: true,
                text: true,
                mediaUrl: true,
                mediaType: true,
                timestamp: true,
            },
        });

        // Map to MediaItem format
        const media = messages.map((msg: { id: string; text: string; mediaUrl: string | null; mediaType: string | null; timestamp: Date }) => ({
            id: msg.id,
            mediaUrl: msg.mediaUrl!,
            mediaType: msg.mediaType || type,
            text: msg.text,
            timestamp: msg.timestamp,
        }));

        return NextResponse.json({ media });
    } catch (error) {
        console.error("Failed to fetch gallery media:", error);
        return NextResponse.json({ error: "Failed to fetch gallery media" }, { status: 500 });
    }
}
