import { NextResponse } from "next/server";

type Body = {
    username?: string;
    password?: string;
};

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as Body;
        const username = body.username ?? "";
        const password = body.password ?? "";

        const envUser = process.env.LOGIN_USER ?? "";
        const envPass = process.env.LOGIN_PASS ?? "";

        if (username === envUser && password === envPass) {
            // On success, set an HTTP-only cookie containing the login timestamp.
            const res = NextResponse.json({ ok: true });
            try {
                const ts = Date.now().toString();
                // set cookie for 4 hours
                res.cookies.set("auth_ts", ts, {
                    httpOnly: true,
                    maxAge: 4 * 60 * 60, // 4 hours in seconds
                    path: "/",
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                });
            } catch (e) {
                // ignore cookie errors, still return success
            }
            return res;
        }

        return NextResponse.json({ ok: false, message: "Invalid username or password" }, { status: 401 });
    } catch (err) {
        return NextResponse.json({ ok: false, message: "Bad request" }, { status: 400 });
    }
}

export async function GET() {
    return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}
