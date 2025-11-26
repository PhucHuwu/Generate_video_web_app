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
    const cursor = searchParams.get("cursor");

    if (!type) {
        return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    // Default limit to 10 if not specified
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Validate limit
    if (isNaN(limit) || limit <= 0 || limit > 100) {
        return NextResponse.json({ error: "Invalid limit. Must be between 1 and 100" }, { status: 400 });
    }

    try {
        // Build query options
        const queryOptions: any = {
            where: { type },
            orderBy: { timestamp: "desc" }, // Get newest first
            take: limit + 1, // Take one extra to check if there are more
        };

        // If cursor is provided, skip to that message
        if (cursor) {
            queryOptions.skip = 1; // Skip the cursor itself
            queryOptions.cursor = { id: cursor };
        }

        const messages = await prisma.chatMessage.findMany(queryOptions);

        // Check if there are more messages
        const hasMore = messages.length > limit;
        const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

        // Reverse to show oldest first (ascending order for display)
        const reversedMessages = messagesToReturn.reverse();

        // Map Prisma model to frontend Message type
        const formattedMessages = reversedMessages.map(
            (msg: { id: string; text: string; sender: string; timestamp: Date; mediaUrl: string | null; mediaType: string | null }) => ({
                id: msg.id,
                text: msg.text,
                sender: msg.sender,
                timestamp: msg.timestamp,
                media: msg.mediaUrl
                    ? {
                          src: msg.mediaUrl,
                          type: msg.mediaType || "image",
                      }
                    : undefined,
                taskId: (msg as any).taskId,
                status: (msg as any).status,
                failReason: (msg as any).failReason,
                mediaList: (msg as any).mediaList,
            })
        );

        // Get the cursor for the next page (oldest message in current batch)
        const nextCursor =
            hasMore && messagesToReturn.length > 0
                ? messagesToReturn[0].id // First item before reverse (oldest in this batch)
                : null;

        return NextResponse.json({
            messages: formattedMessages,
            hasMore,
            nextCursor,
        });
    } catch (error) {
        console.error("Failed to fetch chat history:", error);
        return NextResponse.json({ error: "Failed to fetch chat history" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { type, text, sender, media, timestamp } = body;

        if (!type || !text || !sender) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newMessage = await prisma.chatMessage.create({
            data: {
                type,
                text,
                sender,
                timestamp: new Date(timestamp || Date.now()),
                mediaUrl: media?.src,
                mediaType: media?.type,
                taskId: body.taskId,
                status: body.status,
                failReason: body.failReason,
                mediaList: body.mediaList,
            },
        });

        return NextResponse.json({
            id: newMessage.id,
            success: true,
        });
    } catch (error) {
        console.error("Failed to save message:", error);
        return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, taskId, status, failReason, media, mediaList, text } = body;

        if (!id && !taskId) {
            return NextResponse.json({ error: "Missing id or taskId" }, { status: 400 });
        }

        // Find the message first
        const whereClause = id ? { id } : { taskId };

        const updatedMessage = await prisma.chatMessage.updateMany({
            where: whereClause,
            data: {
                status,
                failReason,
                mediaUrl: media?.src,
                mediaType: media?.type,
                mediaList: mediaList,
                text,
            },
        });

        return NextResponse.json({
            success: true,
            updatedCount: updatedMessage.count,
        });
    } catch (error) {
        console.error("Failed to update message:", error);
        return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
    }
}
