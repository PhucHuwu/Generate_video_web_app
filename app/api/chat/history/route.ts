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

    if (!type) {
        return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    try {
        const messages = await prisma.chatMessage.findMany({
            where: { type },
            orderBy: { timestamp: "asc" },
        });

        // Map Prisma model to frontend Message type
        const formattedMessages = messages.map((msg) => ({
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
        }));

        return NextResponse.json(formattedMessages);
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

export async function DELETE(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type) {
        return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    try {
        await prisma.chatMessage.deleteMany({
            where: { type },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete chat history:", error);
        return NextResponse.json({ error: "Failed to delete chat history" }, { status: 500 });
    }
}
