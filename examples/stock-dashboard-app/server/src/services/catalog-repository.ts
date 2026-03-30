import fs from "node:fs/promises";
import path from "node:path";
import type { CatalogSnapshot } from "../types/catalog.js";

const defaultSnapshot: CatalogSnapshot = {
  sourceId: null,
  syncedAt: null,
  products: []
};

export class CatalogRepository {
  private readonly filePath = path.resolve(process.cwd(), "data", "catalog-cache.json");

  async read(): Promise<CatalogSnapshot> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as CatalogSnapshot;
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

  async write(snapshot: CatalogSnapshot): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(snapshot, null, 2), "utf8");
  }
}
