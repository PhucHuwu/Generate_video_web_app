"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                // backend sets an HTTP-only cookie; frontend only redirects
                router.push("/");
            } else {
                const data = await res.json();
                setError(data?.message || "Invalid credentials");
            }
        } catch (err) {
            setError("Request failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md p-8 border border-border bg-card rounded-lg shadow-sm">
                <h1 className="text-2xl font-bold text-foreground mb-4">Đăng nhập</h1>
                <form onSubmit={handleSubmit}>
                    <label className="block mb-2">
                        <span className="text-sm text-muted-foreground">Tên đăng nhập</span>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 block w-full border border-border px-3 py-2 rounded bg-transparent text-foreground"
                            required
                        />
                    </label>

                    <label className="block mb-4">
                        <span className="text-sm text-muted-foreground">Mật khẩu</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full border border-border px-3 py-2 rounded bg-transparent text-foreground"
                            required
                        />
                    </label>

                    {error && <div className="text-red-600 mb-2">{error}</div>}

                    <button type="submit" className="w-full bg-primary text-primary-foreground px-4 py-2 rounded" disabled={loading}>
                        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                    </button>
                </form>
            </div>
        </main>
    );
}
