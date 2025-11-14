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
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json(
            { ok: false, message: "Invalid username or password" },
            { status: 401 }
        );
    } catch (err) {
        return NextResponse.json(
            { ok: false, message: "Bad request" },
            { status: 400 }
        );
    }
}

export async function GET() {
    return NextResponse.json(
        { message: "Method not allowed" },
        { status: 405 }
    );
}
