import { NextResponse } from "next/server";

export async function POST() {
    const res = NextResponse.json({ ok: true });
    try {
        res.cookies.set("auth_ts", "", {
            maxAge: 0,
            path: "/",
        });
    } catch (e) {
        // ignore
    }
    return res;
}
