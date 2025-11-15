import { NextResponse } from "next/server";

const KIE_CREDIT_URL = "https://api.kie.ai/api/v1/chat/credit";
const API_KEY = process.env.KIE_API_KEY || "";

export async function GET() {
    if (!API_KEY) {
        return NextResponse.json(
            { error: "KIE_API_KEY chưa được cấu hình trên server" },
            { status: 500 }
        );
    }

    try {
        const res = await fetch(KIE_CREDIT_URL, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
            },
        });

        const txt = await res.text().catch(() => "");
        // Try to parse JSON, otherwise return raw text
        try {
            const json = txt
                ? JSON.parse(txt)
                : { code: res.status, msg: res.statusText };
            return NextResponse.json(json, { status: res.status });
        } catch (e) {
            return NextResponse.json(
                { code: res.status, msg: txt || res.statusText },
                { status: res.status }
            );
        }
    } catch (err: any) {
        console.error("/api/credits proxy error", err);
        return NextResponse.json(
            { error: String(err?.message || err) },
            { status: 500 }
        );
    }
}
