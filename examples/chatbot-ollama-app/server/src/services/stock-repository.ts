import fs from "node:fs/promises";
import path from "node:path";
import type { StockSnapshot } from "../types/stock.js";

const defaultSnapshot: StockSnapshot = {
  sourceId: null,
  syncedAt: null,
  products: []
};

export class StockRepository {
  private readonly filePath = path.resolve(process.cwd(), "data", "stock-cache.json");

  async read(): Promise<StockSnapshot> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StockSnapshot;

      return {
        sourceId: parsed.sourceId ?? null,
        syncedAt: parsed.syncedAt ?? null,
        products: Array.isArray(parsed.products) ? parsed.products : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await this.write(defaultSnapshot);
        return defaultSnapshot;
      }

      throw error;
    }
  }

  async write(snapshot: StockSnapshot): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(snapshot, null, 2), "utf8");
  }
}

