export interface RecentItem {
  id: string;
  type: "contact" | "deal" | "company" | "task";
  label: string;
  sublabel?: string;
  path: string;
  timestamp: number;
}

const STORAGE_KEY = "whop-crm-recent-items";
const MAX_RECENTS = 10;

export function getRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const items = JSON.parse(stored) as RecentItem[];
    // Filter out stale items (older than 30 days)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return items.filter((item) => item.timestamp > cutoff);
  } catch {
    return [];
  }
}

export function addRecentItem(item: Omit<RecentItem, "timestamp">) {
  const items = getRecentItems();
  // Remove existing entry for same id+type (dedup)
  const filtered = items.filter(
    (i) => !(i.id === item.id && i.type === item.type)
  );
  // Prepend new item
  filtered.unshift({ ...item, timestamp: Date.now() });
  // Trim to max
  const trimmed = filtered.slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable -- silently ignore
  }
}

export function clearRecentItems() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
