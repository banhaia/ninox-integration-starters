import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.resolve(__dirname, "..", "..", "..", "data", "preventa-history.json");

export interface PreventaHistoryEntry {
  id: string;
  timestamp: string;
  type: "preventa" | "venta";
  payload: unknown;
  result: unknown;
}

function readHistory(): PreventaHistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PreventaHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: PreventaHistoryEntry[]): void {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

export function appendHistoryEntry(
  type: "preventa" | "venta",
  payload: unknown,
  result: unknown
): PreventaHistoryEntry {
  const entry: PreventaHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    payload,
    result
  };
  const history = readHistory();
  history.push(entry);
  writeHistory(history);
  return entry;
}

export function getHistory(): PreventaHistoryEntry[] {
  return readHistory();
}
