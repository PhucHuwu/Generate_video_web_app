import { MediaItem, DateGroup } from "../types";

/**
 * Format a date into a human-readable label
 * Returns "Hôm nay", "Hôm qua", or "DD/MM/YYYY"
 */
export function formatDateLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemDate = new Date(date);
    itemDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return "Hôm nay";
    } else if (diffDays === 1) {
        return "Hôm qua";
    } else {
        // Format as DD/MM/YYYY
        const day = itemDate.getDate().toString().padStart(2, "0");
        const month = (itemDate.getMonth() + 1).toString().padStart(2, "0");
        const year = itemDate.getFullYear();
        return `${day}/${month}/${year}`;
    }
}

/**
 * Get the date key for grouping (YYYY-MM-DD format for consistent grouping)
 */
function getDateKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Group media items by date
 * Returns array of DateGroups sorted by date (newest first)
 */
export function groupByDate(items: MediaItem[]): DateGroup[] {
    // Group items by date key
    const groups = new Map<string, MediaItem[]>();

    for (const item of items) {
        const dateKey = getDateKey(item.timestamp);
        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(item);
    }

    // Convert to DateGroup array and format labels
    const dateGroups: DateGroup[] = [];
    for (const [dateKey, groupItems] of groups.entries()) {
        // Use the first item's timestamp to generate the label
        const date = formatDateLabel(groupItems[0].timestamp);
        dateGroups.push({
            date,
            items: groupItems,
        });
    }

    // Sort by date (newest first) - compare using the first item's timestamp
    dateGroups.sort((a, b) => {
        const timeA = a.items[0]?.timestamp.getTime() || 0;
        const timeB = b.items[0]?.timestamp.getTime() || 0;
        return timeB - timeA;
    });

    return dateGroups;
}
