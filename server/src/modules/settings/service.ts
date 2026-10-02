import { config, NINOX_BASE_URLS, type NinoxEnv } from "../../config.js";
import type { Db } from "../../db/connection.js";
import type { NinoxConfig } from "../../ninox/types.js";

const KEYS = {
  env: "ninox.env",
  baseUrl: "ninox.baseUrl",
  token: "ninox.token",
  config: "ninox.config",
  ordenIdBase: "orders.ordenIdBase"
} as const;

export interface NinoxConnection {
  env: NinoxEnv;
  baseUrl: string;
  token: string | null;
}

export interface NinoxSettingsView {
  env: NinoxEnv;
  baseUrl: string;
  hasToken: boolean;
  tokenLast4: string | null;
  /** De dónde sale cada valor: variable de entorno (.env) o lo guardado desde la UI. */
  source: { env: "env" | "db"; baseUrl: "env" | "db"; token: "env" | "db" | "none" };
  ordenIdBase: number;
}

export interface StoredNinoxConfig {
  fetchedAt: string;
  config: NinoxConfig;
}

/**
 * Configuración persistida en la tabla settings. El token de Ninox se guarda en la
 * base local (gitignoreada) y nunca se devuelve completo por la API.
 */
export class SettingsService {
  constructor(private readonly db: Db) {}

  get(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value, new Date().toISOString());
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  getNinoxEnv(): NinoxEnv {
    const stored = this.get(KEYS.env);
    return config.envOverrides.env ?? (stored === "prod" || stored === "custom" ? stored : "test");
  }

  getConnection(): NinoxConnection {
    const env = this.getNinoxEnv();
    const customUrl = config.envOverrides.baseUrl ?? this.get(KEYS.baseUrl) ?? "";
    const baseUrl = env === "custom" ? customUrl : NINOX_BASE_URLS[env];
    const token = config.envOverrides.token ?? this.get(KEYS.token);
    return { env, baseUrl: baseUrl.replace(/\/+$/, ""), token: token || null };
  }

  view(): NinoxSettingsView {
    const connection = this.getConnection();
    const storedToken = this.get(KEYS.token);
    return {
      env: connection.env,
      baseUrl: connection.baseUrl,
      hasToken: Boolean(connection.token),
      tokenLast4: connection.token ? connection.token.slice(-4) : null,
      source: {
        env: config.envOverrides.env ? "env" : "db",
        baseUrl: config.envOverrides.baseUrl ? "env" : "db",
        token: config.envOverrides.token ? "env" : storedToken ? "db" : "none"
      },
      ordenIdBase: this.getOrdenIdBase()
    };
  }

  saveNinox(input: { env?: NinoxEnv; baseUrl?: string; token?: string; clearToken?: boolean }): void {
    this.db.transaction(() => {
      if (input.env) this.set(KEYS.env, input.env);
      if (input.baseUrl !== undefined) this.set(KEYS.baseUrl, input.baseUrl.trim());
      if (input.clearToken) this.delete(KEYS.token);
      else if (input.token) this.set(KEYS.token, input.token.trim());
      // La config descargada corresponde a la conexión anterior.
      if (input.env || input.baseUrl !== undefined || input.token || input.clearToken) this.delete(KEYS.config);
    })();
  }

  getNinoxConfig(): StoredNinoxConfig | null {
    const raw = this.get(KEYS.config);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredNinoxConfig;
    } catch {
      return null;
    }
  }

  setNinoxConfig(value: NinoxConfig): StoredNinoxConfig {
    const stored = { fetchedAt: new Date().toISOString(), config: value };
    this.set(KEYS.config, JSON.stringify(stored));
    return stored;
  }

  getOrdenIdBase(): number {
    const value = Number(this.get(KEYS.ordenIdBase));
    return Number.isInteger(value) && value > 0 ? value : 1;
  }

  setOrdenIdBase(value: number): void {
    this.set(KEYS.ordenIdBase, String(value));
  }
}
