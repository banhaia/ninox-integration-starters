import path from "node:path";

const isTest = Boolean(process.env.VITEST);

// Carga .env si existe (Node >= 20.12). Todo es opcional: la app funciona sin .env.
// En tests se ignora para que un .env local no cambie los resultados.
if (!isTest) {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // Sin .env: se usan los defaults y la configuración guardada en SQLite.
  }
}

export type NinoxEnv = "test" | "prod" | "custom";

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNinoxEnv(): NinoxEnv | undefined {
  const raw = process.env.NINOX_ENV?.trim().toLowerCase();
  return raw === "test" || raw === "prod" || raw === "custom" ? raw : undefined;
}

export const config = {
  port: readNumber("PORT", 3030),
  isProduction: process.env.NODE_ENV === "production",
  dataDir: path.resolve(process.env.DATA_DIR?.trim() || "data"),
  catalogSyncMinutes: Math.max(10, readNumber("CATALOG_SYNC_MINUTES", 15)),
  ninoxTimeoutMs: readNumber("NINOX_TIMEOUT_MS", 30000),
  /** Overrides por variable de entorno. Tienen prioridad sobre lo guardado desde la UI. */
  envOverrides: isTest
    ? { env: undefined, baseUrl: undefined, token: undefined }
    : {
        env: readNinoxEnv(),
        baseUrl: process.env.NINOX_BASE_URL?.trim() || undefined,
        token: process.env.NINOX_TOKEN?.trim() || undefined
      }
};

export const NINOX_BASE_URLS: Record<Exclude<NinoxEnv, "custom">, string> = {
  test: "https://api.test-ninox.com.ar",
  prod: "https://api.ninox.com.ar"
};
