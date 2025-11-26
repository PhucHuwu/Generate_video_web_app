import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || "download";

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Content-Disposition", `attachment; filename="${filename}"`);
        headers.set("Content-Length", buffer.length.toString());

        return new NextResponse(buffer, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error("Download proxy error:", error);
        return NextResponse.json({ error: error.message || "Failed to download file" }, { status: 500 });
    }
}
