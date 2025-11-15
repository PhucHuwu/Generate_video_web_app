import { NextResponse } from "next/server";

// GET /api/auth - checks the auth cookie and returns 200 if valid, 401 otherwise
export async function GET(request: Request) {
    try {
        const cookie = request.headers.get("cookie") || "";
        const match = cookie.match(/(^|;)\s*auth_ts=([^;]+)/);
        if (!match) {
            return NextResponse.json({ ok: false }, { status: 401 });
        }
        const ts = parseInt(match[2], 10);
        if (isNaN(ts)) {
            // clear cookie
            const res = NextResponse.json({ ok: false }, { status: 401 });
            try {
                res.cookies.set("auth_ts", "", { maxAge: 0, path: "/" });
            } catch (e) {}
            return res;
        }

        const SESSION_MS = 4 * 60 * 60 * 1000; // 4 hours
        if (Date.now() - ts > SESSION_MS) {
            // expired -> clear cookie and return 401
            const res = NextResponse.json({ ok: false, message: "expired" }, { status: 401 });
            try {
                res.cookies.set("auth_ts", "", { maxAge: 0, path: "/" });
            } catch (e) {}
            return res;
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
