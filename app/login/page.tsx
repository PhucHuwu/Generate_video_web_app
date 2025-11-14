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
                // On success, navigate to the home page (or change as desired)
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
        <main className="min-h-screen flex items-center justify-center bg-white">
            <div className="w-full max-w-md p-8 border rounded-lg shadow-sm">
                <h1 className="text-2xl mb-4">Login</h1>
                <form onSubmit={handleSubmit}>
                    <label className="block mb-2">
                        <span className="text-sm">Username</span>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 block w-full border px-3 py-2 rounded"
                            required
                        />
                    </label>

                    <label className="block mb-4">
                        <span className="text-sm">Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full border px-3 py-2 rounded"
                            required
                        />
                    </label>

                    {error && <div className="text-red-600 mb-2">{error}</div>}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>
                <p className="mt-4 text-sm text-muted-foreground">
                    Use the credentials set in your `.ENV` (LOGIN_USER /
                    LOGIN_PASS).
                </p>
            </div>
        </main>
    );
}
