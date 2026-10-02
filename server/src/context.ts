import { config } from "./config.js";
import type { Db } from "./db/connection.js";
import { HttpError } from "./lib/http.js";
import { NinoxClient } from "./ninox/client.js";
import { RateLimiter, type RateLimiterOptions } from "./ninox/rate-limiter.js";
import { SettingsService } from "./modules/settings/service.js";

/**
 * Dependencias compartidas por los módulos. Se arma una vez en index.ts y en los
 * tests se puede crear con una base en memoria y un fetch simulado.
 */
export interface AppContext {
  db: Db;
  settings: SettingsService;
  limiter: RateLimiter;
  secureCookies: boolean;
  /** Devuelve un cliente con la conexión vigente. Falla con 412 si falta configurar el token. */
  ninox: () => NinoxClient;
  hasNinoxConnection: () => boolean;
}

export interface ContextOptions {
  fetchImpl?: typeof fetch;
  secureCookies?: boolean;
  /** Reloj y espera inyectables (tests). */
  limiter?: RateLimiterOptions;
}

export function createContext(db: Db, options: ContextOptions = {}): AppContext {
  const settings = new SettingsService(db);
  const limiter = new RateLimiter(db, () => settings.getNinoxEnv(), options.limiter);

  const hasNinoxConnection = (): boolean => {
    const connection = settings.getConnection();
    return Boolean(connection.token && connection.baseUrl);
  };

  return {
    db,
    settings,
    limiter,
    secureCookies: options.secureCookies ?? config.isProduction,
    hasNinoxConnection,
    ninox: () => {
      const connection = settings.getConnection();
      if (!connection.token || !connection.baseUrl) {
        throw new HttpError(412, "Falta configurar el token de Ninox en Configuración");
      }
      return new NinoxClient({
        baseUrl: connection.baseUrl,
        token: connection.token,
        timeoutMs: config.ninoxTimeoutMs,
        limiter,
        fetchImpl: options.fetchImpl
      });
    }
  };
}
