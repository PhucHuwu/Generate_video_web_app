import { NextResponse } from "next/server";

const KIE_CREDIT_URL = "https://api.kie.ai/api/v1/chat/credit";
const API_KEY = process.env.KIE_API_KEY || "";

export async function GET() {
    if (!API_KEY) {
        return NextResponse.json({ code: 500, msg: "KIE_API_KEY chưa được cấu hình trên server", data: 0 }, { status: 500 });
    }

    try {
        const res = await fetch(KIE_CREDIT_URL, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
            },
        });

        const txt = await res.text().catch(() => "");

        // Normalize response to { code, msg, data }
        // If upstream returns JSON object, prefer its fields; otherwise try to extract a numeric value from raw text.
        try {
            if (txt) {
                const parsed = JSON.parse(txt);
                // If parsed is a number
                if (typeof parsed === "number") {
                    return NextResponse.json({ code: res.status, msg: res.statusText || "success", data: parsed }, { status: res.status });
                }

                // If parsed is an object and already matches shape, try to normalize
                if (parsed && typeof parsed === "object") {
                    const code = typeof parsed.code === "number" ? parsed.code : res.status;
                    const msg = typeof parsed.msg === "string" ? parsed.msg : parsed.message || res.statusText || "";
                    // Try common field names that might contain remaining credits
                    let data: number | null = null;
                    if (typeof parsed.data === "number") data = parsed.data;
                    else if (typeof parsed.remaining === "number") data = parsed.remaining;
                    else if (typeof parsed.credit === "number") data = parsed.credit;
                    else if (typeof parsed.credits === "number") data = parsed.credits;

                    // Fallback: scan object values for a numeric value
                    if (data === null) {
                        for (const v of Object.values(parsed)) {
                            if (typeof v === "number") {
                                data = v;
                                break;
                            }
                        }
                    }

                    return NextResponse.json({ code, msg, data: data ?? 0 }, { status: res.status });
                }
            }

            // If not JSON, check if text is a plain number
            const maybeNum = txt?.trim();
            if (maybeNum && /^\d+$/.test(maybeNum)) {
                const n = parseInt(maybeNum, 10);
                return NextResponse.json({ code: res.status, msg: res.statusText || "success", data: n }, { status: res.status });
            }

            // Default fallback: return status and raw text as message with data 0
            return NextResponse.json({ code: res.status, msg: txt || res.statusText || "", data: 0 }, { status: res.status });
        } catch (e) {
            // JSON.parse may throw; handle same as above for raw text
            const maybeNum = txt?.trim();
            if (maybeNum && /^\d+$/.test(maybeNum)) {
                const n = parseInt(maybeNum, 10);
                return NextResponse.json({ code: res.status, msg: res.statusText || "success", data: n }, { status: res.status });
            }
            return NextResponse.json({ code: res.status, msg: txt || res.statusText || String(e), data: 0 }, { status: res.status });
        }
    } catch (err: any) {
        console.error("/api/credits proxy error", err);
        return NextResponse.json({ code: 500, msg: String(err?.message || err), data: 0 }, { status: 500 });
    }
}
