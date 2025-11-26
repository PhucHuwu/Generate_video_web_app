export const downloadMedia = async (url: string, filename?: string) => {
    if (!url) return;

    // Use proxy API for download to avoid CORS issues
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || "download")}`;

    try {
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (err) {
        console.error("Failed to trigger download:", err);
        // Fallback: open in new tab
        window.open(url, "_blank", "noopener,noreferrer");
    }
};
