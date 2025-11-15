"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Load theme from localStorage on mount (no OS preference)
        const stored = localStorage.getItem("app_theme") as Theme | null;
        if (stored === "dark" || stored === "light") {
            setTheme(stored);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // Apply theme class to html element
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(theme);

        // Save to localStorage
        localStorage.setItem("app_theme", theme);
    }, [theme, mounted]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    // Prevent flash of unstyled content
    if (!mounted) {
        return <>{children}</>;
    }

    return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        // Return a safe default during SSR or before ThemeProvider mounts
        return {
            theme: "light" as Theme,
            toggleTheme: () => {},
        };
    }
    return context;
}
