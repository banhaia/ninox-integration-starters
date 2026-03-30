import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }

  return parsed;
}

export interface EnvConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export function loadEnv(): EnvConfig {
  return {
    baseUrl: getRequiredEnv("NINOX_BASE_URL").replace(/\/+$/, ""),
    token: getRequiredEnv("NINOX_TOKEN"),
    timeoutMs: getOptionalNumber("NINOX_TIMEOUT_MS", 10000)
  };
}
